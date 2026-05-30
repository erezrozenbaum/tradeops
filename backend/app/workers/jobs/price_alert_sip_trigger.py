"""Daily worker: auto-stage SIP allocations when a linked price alert fires.

Runs at 20:45 UTC — 15 minutes after price_alert_checker (20:30) to ensure
all alerts are committed before we query them.

For each alert triggered today, checks whether any active RecurringPlan has
an allocation for the same ticker with trigger_on_alert=True.  If so, stages
a buy order as if the plan ran manually — using the allocation's amount as
both quantity=1 and unit_price=amount (same convention as run_plan).

Deduplication: order notes carry [alert_trigger:{alert_id}] so re-running
the worker on the same day never creates duplicates.
"""
import logging
from datetime import datetime, timezone

log = logging.getLogger(__name__)


def trigger_sip_on_price_alerts() -> None:
    from app.db.session import SessionLocal
    from app.models.price_alert import PriceAlert
    from app.models.recurring_plan import RecurringPlan
    from app.models.staged_order import StagedOrder
    from app.audit.service import log_event

    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        # Alerts triggered today (is_active=False means checker already fired them)
        triggered_today = (
            db.query(PriceAlert)
            .filter(
                PriceAlert.triggered_at >= today_start,
                PriceAlert.is_active.is_(False),
            )
            .all()
        )

        if not triggered_today:
            log.info("[price_alert_sip_trigger] No alerts triggered today.")
            return

        staged_count = 0

        for alert in triggered_today:
            marker = f"[alert_trigger:{alert.id}]"

            # Find all active plans for this investor that have trigger_on_alert for this ticker
            plans = (
                db.query(RecurringPlan)
                .filter(
                    RecurringPlan.investor_id == alert.investor_id,
                    RecurringPlan.is_active.is_(True),
                )
                .all()
            )

            for plan in plans:
                for alloc in (plan.allocations or []):
                    if not alloc.get("trigger_on_alert"):
                        continue
                    if alloc.get("ticker", "").upper() != alert.ticker.upper():
                        continue

                    # Deduplication: skip if we already staged for this alert+plan+ticker today
                    already = (
                        db.query(StagedOrder)
                        .filter(
                            StagedOrder.investor_id == alert.investor_id,
                            StagedOrder.notes.contains(marker),
                        )
                        .first()
                    )
                    if already:
                        log.debug(
                            "[price_alert_sip_trigger] Already staged for alert %s plan %s — skipping",
                            alert.id, plan.id,
                        )
                        continue

                    amount = alloc.get("amount", 0.0)
                    order = StagedOrder(
                        investor_id=plan.investor_id,
                        ticker=alloc.get("ticker"),
                        name=alloc.get("name", "Unnamed"),
                        action="buy",
                        quantity=1.0,
                        unit_price=amount,
                        currency=alloc.get("currency", "USD"),
                        estimated_value=amount,
                        asset_type=alloc.get("asset_type"),
                        status="pending",
                        goal_id=alloc.get("goal_id"),
                        notes=(
                            f"Auto-staged by price alert: {alert.ticker} "
                            f"{alert.alert_type} {alert.target_price} "
                            f"(plan: {plan.name}) {marker}"
                        ),
                    )
                    db.add(order)
                    staged_count += 1

                    try:
                        log_event(
                            db,
                            investor_id=plan.investor_id,
                            event_type="sip_alert_triggered",
                            description=(
                                f"Price alert triggered SIP order: {alert.ticker} "
                                f"{alert.alert_type} {alert.target_price} "
                                f"→ staged {alloc.get('name')} {amount} {alloc.get('currency', 'USD')}"
                            ),
                            metadata={
                                "alert_id": str(alert.id),
                                "plan_id": str(plan.id),
                                "ticker": alert.ticker,
                            },
                        )
                    except Exception:
                        pass

        if staged_count:
            db.commit()

        log.info(
            "[price_alert_sip_trigger] Processed %d triggered alert(s) — staged %d SIP order(s)",
            len(triggered_today), staged_count,
        )
    except Exception as exc:
        log.error("[price_alert_sip_trigger] Failed: %s", exc)
        db.rollback()
    finally:
        db.close()

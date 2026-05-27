"""Daily worker: populate outcome_snapshots on executed staged orders.

For each executed order, checks whether the 30 / 90 / 180-day milestone
has been reached and, if so, appends a snapshot of the actual portfolio state
at that point so the Outcome Tracking view can compare projected vs actual.
"""
import logging
from datetime import datetime, timezone

log = logging.getLogger(__name__)

_MILESTONES = [30, 90, 180]
_TIER_MAP = {
    "bond": "low_risk", "fund": "low_risk",
    "etf": "growth", "stock": "growth", "real_estate": "growth",
    "crypto": "high_risk",
}


def populate_outcome_snapshots() -> None:
    from app.db.session import SessionLocal
    from app.models.staged_order import StagedOrder
    from app.models.portfolio_snapshot import PortfolioSnapshot

    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        orders = (
            db.query(StagedOrder)
            .filter(
                StagedOrder.status == "executed",
                StagedOrder.executed_at.isnot(None),
                StagedOrder.projected_metrics.isnot(None),
            )
            .all()
        )

        written = 0
        for order in orders:
            try:
                executed_at = order.executed_at
                if executed_at.tzinfo is None:
                    executed_at = executed_at.replace(tzinfo=timezone.utc)
                days_since = (now - executed_at).days

                existing_days = {s["days"] for s in (order.outcome_snapshots or [])}
                needed = [m for m in _MILESTONES if days_since >= m and m not in existing_days]
                if not needed:
                    continue

                snap = (
                    db.query(PortfolioSnapshot)
                    .filter(PortfolioSnapshot.investor_id == order.investor_id)
                    .order_by(PortfolioSnapshot.snapshot_at.desc())
                    .first()
                )
                if not snap:
                    continue

                aa = snap.asset_allocation or {}
                low_risk_pct = round(sum(v for k, v in aa.items() if _TIER_MAP.get(k) == "low_risk"), 1) or None
                growth_pct = round(sum(v for k, v in aa.items() if _TIER_MAP.get(k) == "growth"), 1) or None
                high_risk_pct = round(sum(v for k, v in aa.items() if _TIER_MAP.get(k) == "high_risk"), 1) or None

                snapshots = list(order.outcome_snapshots or [])
                for milestone in needed:
                    snapshots.append({
                        "days": milestone,
                        "snapshot_at": now.isoformat(),
                        "portfolio_value": float(snap.total_value),
                        "low_risk_pct": low_risk_pct,
                        "growth_pct": growth_pct,
                        "high_risk_pct": high_risk_pct,
                    })
                    written += 1

                order.outcome_snapshots = snapshots
                db.add(order)
            except Exception as exc:
                log.warning("[outcome_tracking] Order %s skipped: %s", order.id, exc)

        db.commit()
        log.info("[outcome_tracking] Written %d snapshots across %d executed orders", written, len(orders))
    except Exception as exc:
        log.error("[outcome_tracking] Fatal: %s", exc)
        db.rollback()
    finally:
        db.close()

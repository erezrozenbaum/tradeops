"""Checks active price alerts against current market prices and triggers them.

Runs at 20:30 UTC daily — 30 minutes after the price_refresh job completes.
"""
import logging
from datetime import datetime, timezone

log = logging.getLogger(__name__)


def check_price_alerts() -> None:
    from app.db.session import SessionLocal
    from app.models.price_alert import PriceAlert
    from app.models.price_snapshot import PriceSnapshot

    db = SessionLocal()
    try:
        active_alerts = (
            db.query(PriceAlert)
            .filter(PriceAlert.is_active == True)  # noqa: E712
            .all()
        )

        if not active_alerts:
            log.info("[price_alert_checker] No active alerts")
            return

        # Group by ticker to minimise DB queries
        tickers = {a.ticker for a in active_alerts}
        price_map: dict[str, float] = {}
        for ticker in tickers:
            snap = (
                db.query(PriceSnapshot)
                .filter(PriceSnapshot.ticker == ticker)
                .order_by(PriceSnapshot.fetched_at.desc())
                .first()
            )
            if snap:
                price_map[ticker] = snap.price

        triggered = 0
        for alert in active_alerts:
            current_price = price_map.get(alert.ticker)
            if current_price is None:
                continue

            hit = (
                (alert.alert_type == "above" and current_price >= alert.target_price) or
                (alert.alert_type == "below" and current_price <= alert.target_price)
            )
            if hit:
                alert.is_active = False
                alert.triggered_at = datetime.now(timezone.utc)
                alert.triggered_price = current_price
                triggered += 1
                log.info(
                    "[price_alert_checker] Triggered: %s %s %.4f (current=%.4f)",
                    alert.ticker, alert.alert_type, alert.target_price, current_price,
                )

        if triggered:
            db.commit()

        log.info(
            "[price_alert_checker] Checked %d alerts for %d tickers — %d triggered",
            len(active_alerts), len(tickers), triggered,
        )
    except Exception as exc:
        log.error("[price_alert_checker] Failed: %s", exc)
    finally:
        db.close()

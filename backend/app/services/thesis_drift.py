"""Thesis Expiry Monitor — read-only advisory for executed buy orders.

Checks each executed buy order that has thesis_params set and determines
whether the investor's documented stop-loss, take-profit, or time horizon
has been breached. Results are surfaced in the Morning Brief as thesis_alerts.
Never modifies orders or positions.

Statuses:
  RISK_BREACHED        current price ≤ entry × (1 + stop_loss_pct/100)
  TAKE_PROFIT_REACHED  current price ≥ entry × (1 + take_profit_pct/100)
  TIMELINE_EXPIRED     days held > horizon_days
  INSUFFICIENT_DATA    thesis_params set but no price snapshot for ticker
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

log = logging.getLogger(__name__)


def get_thesis_alerts(db: Session, investor_id: uuid.UUID) -> list[dict[str, Any]]:
    """
    Return breach alerts for all executed buy orders with thesis_params.
    Only RISK_BREACHED, TAKE_PROFIT_REACHED, TIMELINE_EXPIRED, and
    INSUFFICIENT_DATA (when price thresholds are set but no snapshot exists)
    are included — ALIGNED orders are silently skipped.
    """
    from app.models.staged_order import StagedOrder
    from app.models.price_snapshot import PriceSnapshot

    orders = (
        db.query(StagedOrder)
        .filter(
            StagedOrder.investor_id == investor_id,
            StagedOrder.status == "executed",
            StagedOrder.action == "buy",
            StagedOrder.thesis_params.isnot(None),
            StagedOrder.executed_at.isnot(None),
        )
        .order_by(StagedOrder.executed_at.desc())
        .all()
    )

    now = datetime.now(timezone.utc)
    alerts: list[dict[str, Any]] = []

    for order in orders:
        tp = order.thesis_params
        if not isinstance(tp, dict):
            continue

        horizon_days: int | None = tp.get("horizon_days")
        stop_loss_pct: float | None = tp.get("stop_loss_pct")
        take_profit_pct: float | None = tp.get("take_profit_pct")

        entry_price = order.unit_price
        days_held = (now - order.executed_at).days

        # Fetch latest price snapshot
        current_price: float | None = None
        if order.ticker:
            try:
                snap = (
                    db.query(PriceSnapshot)
                    .filter(PriceSnapshot.ticker == order.ticker)
                    .order_by(PriceSnapshot.fetched_at.desc())
                    .first()
                )
                if snap and snap.price > 0:
                    current_price = snap.price
            except Exception as exc:
                log.debug("[thesis_drift] price lookup failed for %s: %s", order.ticker, exc)

        status: str = "ALIGNED"
        insight: str = ""

        needs_price = stop_loss_pct is not None or take_profit_pct is not None
        if needs_price and order.ticker and current_price is None:
            status = "INSUFFICIENT_DATA"
            insight = (
                f"No price snapshot found for {order.ticker}. "
                "Cannot evaluate stop-loss or take-profit thresholds."
            )
        elif current_price is not None and entry_price > 0:
            current_return_pct = (current_price - entry_price) / entry_price * 100

            if stop_loss_pct is not None and current_return_pct <= stop_loss_pct:
                status = "RISK_BREACHED"
                insight = (
                    f"Stop-loss breached: {order.ticker or order.name} is at "
                    f"{current_return_pct:+.1f}% from your entry — past your "
                    f"{stop_loss_pct:+.1f}% threshold. Review for exit or update thesis."
                )
            elif take_profit_pct is not None and current_return_pct >= take_profit_pct:
                status = "TAKE_PROFIT_REACHED"
                insight = (
                    f"Take-profit reached: {order.ticker or order.name} is at "
                    f"{current_return_pct:+.1f}% from entry — your "
                    f"+{take_profit_pct:.1f}% target has been hit. Consider locking in gains."
                )

        # Timeline check runs independently of price (can layer with price breach)
        if status == "ALIGNED" and horizon_days is not None and days_held > horizon_days:
            status = "TIMELINE_EXPIRED"
            insight = (
                f"Investment horizon exceeded: {order.ticker or order.name} has been held for "
                f"{days_held} days, past your documented target of {horizon_days} days. "
                "Revisit the original thesis or document an updated hold rationale."
            )

        if status != "ALIGNED":
            alerts.append({
                "order_id": str(order.id),
                "ticker": order.ticker,
                "name": order.name,
                "status": status,
                "insight": insight,
                "days_held": days_held,
                "entry_price": entry_price,
                "current_price": current_price,
                "currency": order.currency,
                "executed_at": order.executed_at.isoformat(),
                "thesis_params": tp,
            })

    return alerts

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.decision_timeline.schemas import TimelineEvent, TimelinePage
from app.models.behavioral_risk_event import BehavioralRiskEvent
from app.models.holding_transaction import HoldingTransaction
from app.models.portfolio_snapshot import PortfolioSnapshot
from app.models.recommendation_decision import RecommendationDecision

_DECISION_TYPE_LABELS: dict[str, str] = {
    "ai_recommendation": "AI Recommendation",
    "ai_recommendation_replay": "AI Recommendation (Replay)",
    "coach_insight": "AI Coach Insight",
    "rebalance": "Rebalance Analysis",
}

_TRANSACTION_TYPE_LABELS: dict[str, str] = {
    "buy": "Purchase",
    "sell": "Sale",
    "dividend": "Dividend",
    "fee": "Fee",
    "split": "Stock Split",
    "bonus": "Bonus",
}


def _causal_note(
    event_at: datetime,
    snapshots: list[PortfolioSnapshot],
    window_days: int = 7,
) -> str | None:
    """
    Find portfolio value change in the window after the event.
    Requires snapshot list pre-loaded and sorted ascending by snapshot_at.
    """
    if not snapshots:
        return None

    # Find baseline snapshot closest to but before the event
    baseline: PortfolioSnapshot | None = None
    for s in snapshots:
        if s.snapshot_at <= event_at:
            baseline = s

    if baseline is None:
        return None

    # Find latest snapshot within window after event
    window_end = event_at + timedelta(days=window_days)
    subsequent: PortfolioSnapshot | None = None
    for s in snapshots:
        if event_at < s.snapshot_at <= window_end:
            subsequent = s

    if subsequent is None:
        return None

    change = subsequent.total_value - baseline.total_value
    pct = (change / baseline.total_value * 100) if baseline.total_value else 0
    direction = "gain" if change >= 0 else "drawdown"
    return (
        f"Portfolio {direction} of {abs(pct):.1f}% ({abs(change):,.0f} {subsequent.currency}) "
        f"in the {window_days} days following this event."
    )


def get_timeline(
    db: Session,
    investor_id: uuid.UUID,
    days: int = 30,
    limit: int = 50,
) -> TimelinePage:
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=days)
    since_date = since.date()

    # Pre-load portfolio snapshots for causal notes (last 60 days, sorted asc)
    snapshots: list[PortfolioSnapshot] = (
        db.query(PortfolioSnapshot)
        .filter(
            PortfolioSnapshot.investor_id == investor_id,
            PortfolioSnapshot.snapshot_at >= now - timedelta(days=days + 30),
        )
        .order_by(PortfolioSnapshot.snapshot_at.asc())
        .all()
    )

    events: list[TimelineEvent] = []

    # --- Provenance decisions ---
    decisions: list[RecommendationDecision] = (
        db.query(RecommendationDecision)
        .filter(
            RecommendationDecision.investor_id == investor_id,
            RecommendationDecision.triggered_at >= since,
        )
        .order_by(RecommendationDecision.triggered_at.desc())
        .limit(limit)
        .all()
    )

    for d in decisions:
        label = _DECISION_TYPE_LABELS.get(d.decision_type, d.decision_type)
        out: dict[str, Any] = d.output_summary or {}
        count = d.recommendation_count or 0

        if d.decision_type == "ai_recommendation":
            description = (
                f"Generated {count} investment recommendation(s)."
                if count
                else "AI recommendation run with no output."
            )
        elif d.decision_type == "coach_insight":
            description = f"Coach surfaced {count} insight(s)."
        elif d.decision_type == "rebalance":
            trades = out.get("suggested_trade_count", 0)
            description = f"Rebalance analysis: {trades} suggested trade(s)."
        else:
            description = label

        causal = (
            _causal_note(d.triggered_at, snapshots, window_days=7)
            if d.decision_type in ("ai_recommendation", "rebalance")
            else None
        )

        events.append(
            TimelineEvent(
                event_id=str(d.id),
                event_type=d.decision_type,
                occurred_at=d.triggered_at,
                title=label,
                description=description,
                amount=None,
                currency=None,
                ticker=None,
                metadata={
                    "decision_type": d.decision_type,
                    "recommendation_count": count,
                    "model_used": d.model_used,
                },
                causal_note=causal,
            )
        )

    # --- Transactions ---
    transactions: list[HoldingTransaction] = (
        db.query(HoldingTransaction)
        .filter(
            HoldingTransaction.investor_id == investor_id,
            HoldingTransaction.transaction_date >= since_date,
        )
        .order_by(HoldingTransaction.transaction_date.desc())
        .limit(limit)
        .all()
    )

    for t in transactions:
        tx_label = _TRANSACTION_TYPE_LABELS.get(t.transaction_type, t.transaction_type.title())
        ticker_part = f" {t.ticker}" if t.ticker else ""
        name_part = f" ({t.asset_name})" if t.asset_name and not t.ticker else ""
        title = f"{tx_label}{ticker_part}{name_part}"

        qty_str = f"{t.quantity:,.4g} units @ " if t.quantity else ""
        price_str = f"{t.price_per_unit:,.2f}" if t.price_per_unit else ""
        description = f"{qty_str}{price_str} — {t.total_amount:,.2f} {t.currency}".strip(" — ")

        occurred_at = datetime.combine(
            t.transaction_date, datetime.min.time()
        ).replace(tzinfo=timezone.utc)

        events.append(
            TimelineEvent(
                event_id=str(t.id),
                event_type="transaction",
                occurred_at=occurred_at,
                title=title,
                description=description,
                amount=t.total_amount,
                currency=t.currency,
                ticker=t.ticker,
                metadata={
                    "transaction_type": t.transaction_type,
                    "fees": t.fees,
                },
                causal_note=None,
            )
        )

    # --- Behavioral risk events ---
    from app.behavioral_risk.schemas import EVENT_TYPE_LABELS as _RISK_LABELS
    risk_events: list[BehavioralRiskEvent] = (
        db.query(BehavioralRiskEvent)
        .filter(
            BehavioralRiskEvent.investor_id == investor_id,
            BehavioralRiskEvent.detected_at >= since,
        )
        .order_by(BehavioralRiskEvent.detected_at.desc())
        .limit(limit)
        .all()
    )

    for re in risk_events:
        label = _RISK_LABELS.get(re.event_type, re.event_type)
        event_type_key = "behavioral_risk_resolved" if re.status == "resolved" else "behavioral_risk_detected"
        events.append(
            TimelineEvent(
                event_id=str(re.id),
                event_type=event_type_key,
                occurred_at=re.detected_at,
                title=f"Risk Alert: {label}",
                description=re.description,
                amount=None,
                currency=None,
                ticker=None,
                metadata={
                    "event_type": re.event_type,
                    "severity": re.severity,
                    "status": re.status,
                    "resolved_at": re.resolved_at.isoformat() if re.resolved_at else None,
                },
                causal_note=None,
            )
        )

    # Sort all events by occurred_at descending
    events.sort(key=lambda e: e.occurred_at, reverse=True)
    total = len(events)
    events = events[:limit]

    return TimelinePage(
        investor_id=investor_id,
        events=events,
        total=total,
        days=days,
        generated_at=now,
    )

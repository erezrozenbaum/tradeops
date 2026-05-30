"""Investor Evolution — rolling 90-day behavioral improvement tracker.

Compares the current 90-day window against the previous 90-day window across
four metrics: DQS, documentation rate, risk overrides, and behavioral alpha.

No schema migration.  All computation runs on existing staged_orders data
using the same scorer functions as Decision Intelligence and Behavioral Alpha.
"""
import uuid
from datetime import date, datetime, timedelta, timezone
from statistics import mean

from sqlalchemy.orm import Session

from app.investor_evolution.schemas import (
    InvestorEvolutionReport,
    MetricDelta,
    WindowMetrics,
)
from app.models.staged_order import StagedOrder

_MIN_WINDOW_ORDERS = 3
_WINDOW_DAYS = 90


def _get_all_orders(db: Session, investor_id: uuid.UUID) -> list[StagedOrder]:
    return (
        db.query(StagedOrder)
        .filter(StagedOrder.investor_id == investor_id)
        .order_by(StagedOrder.created_at.asc())
        .all()
    )


def _filter_window(orders: list[StagedOrder], start: datetime, end: datetime) -> list[StagedOrder]:
    return [o for o in orders if start <= o.created_at.replace(tzinfo=timezone.utc) < end]


def _doc_rate(orders: list[StagedOrder]) -> float | None:
    if not orders:
        return None
    documented = sum(1 for o in orders if o.rationale and o.rationale.strip())
    return round(documented / len(orders) * 100, 1)


def _risk_overrides(orders: list[StagedOrder]) -> int:
    return sum(
        1 for o in orders
        if o.status == "executed" and (o.pre_flight_review or {}).get("verdict") == "reconsider"
    )


def _behavioral_alpha(db: Session, orders: list[StagedOrder]) -> float | None:
    """Documentation alpha for the window: avg return documented − avg return undocumented."""
    from app.market_data.service import get_cached_price

    executed_buys = [
        o for o in orders
        if o.status == "executed" and o.action == "buy"
        and o.ticker and o.unit_price and o.unit_price > 0
    ]
    if not executed_buys:
        return None

    priced: list[tuple[StagedOrder, float]] = []
    for o in executed_buys:
        snap = get_cached_price(db, o.ticker)
        if snap and snap.price > 0:
            ret = round((snap.price - o.unit_price) / o.unit_price * 100, 2)
            priced.append((o, ret))

    if len(priced) < 3:
        return None

    doc_returns = [r for o, r in priced if o.rationale and o.rationale.strip()]
    undoc_returns = [r for o, r in priced if not (o.rationale and o.rationale.strip())]

    if not doc_returns or not undoc_returns:
        return None

    return round(mean(doc_returns) - mean(undoc_returns), 2)


def _compute_window(db: Session, orders: list[StagedOrder]) -> WindowMetrics:
    from app.decision_intelligence.service import compute_monthly_dqs
    return WindowMetrics(
        dqs=compute_monthly_dqs(db, orders),
        doc_rate_pct=_doc_rate(orders),
        risk_overrides=_risk_overrides(orders),
        behavioral_alpha_pct=_behavioral_alpha(db, orders),
        order_count=len(orders),
    )


def _delta_direction(delta: float | None, invert: bool = False) -> str:
    if delta is None:
        return "insufficient_data"
    effective = -delta if invert else delta
    if effective > 0.5:
        return "improving"
    if effective < -0.5:
        return "declining"
    return "stable"


def _build_deltas(current: WindowMetrics, previous: WindowMetrics | None) -> list[MetricDelta]:
    def _delta(curr: float | None, prev: float | None) -> float | None:
        if curr is None or prev is None:
            return None
        return round(curr - prev, 2)

    deltas: list[MetricDelta] = []

    dqs_delta = _delta(current.dqs, previous.dqs if previous else None)
    deltas.append(MetricDelta(
        key="dqs", title="Decision Quality Score",
        previous=previous.dqs if previous else None,
        current=current.dqs,
        delta=dqs_delta,
        direction=_delta_direction(dqs_delta),
        unit="points",
    ))

    doc_delta = _delta(current.doc_rate_pct, previous.doc_rate_pct if previous else None)
    deltas.append(MetricDelta(
        key="doc_rate", title="Documentation Rate",
        previous=previous.doc_rate_pct if previous else None,
        current=current.doc_rate_pct,
        delta=doc_delta,
        direction=_delta_direction(doc_delta),
        unit="%",
    ))

    prev_overrides = previous.risk_overrides if previous else None
    curr_overrides = current.risk_overrides
    override_delta = _delta(float(curr_overrides), float(prev_overrides) if prev_overrides is not None else None)
    deltas.append(MetricDelta(
        key="risk_overrides", title="Risk Overrides",
        previous=float(prev_overrides) if prev_overrides is not None else None,
        current=float(curr_overrides),
        delta=override_delta,
        direction=_delta_direction(override_delta, invert=True),  # fewer = improving
        unit="count",
    ))

    alpha_delta = _delta(current.behavioral_alpha_pct, previous.behavioral_alpha_pct if previous else None)
    deltas.append(MetricDelta(
        key="behavioral_alpha", title="Behavioral Alpha",
        previous=previous.behavioral_alpha_pct if previous else None,
        current=current.behavioral_alpha_pct,
        delta=alpha_delta,
        direction=_delta_direction(alpha_delta),
        unit="%",
    ))

    return deltas


def _build_strengths_concerns(
    deltas: list[MetricDelta],
    current: WindowMetrics,
) -> tuple[list[str], list[str]]:
    strengths: list[str] = []
    concerns: list[str] = []

    for d in deltas:
        if d.direction == "improving":
            if d.key == "dqs" and d.delta and d.delta >= 5:
                strengths.append(f"Decision Quality Score improved by {d.delta:+.0f} points — a significant leap in process discipline.")
            elif d.key == "doc_rate" and d.delta and d.delta >= 10:
                strengths.append(f"Documentation rate rose {d.delta:+.0f}% — the single highest-impact habit for long-term DQS growth.")
            elif d.key == "risk_overrides" and d.delta and d.delta <= -2:
                strengths.append(f"Risk overrides dropped by {abs(d.delta):.0f} — you're more likely to respect the pre-flight engine.")
            elif d.key == "behavioral_alpha" and d.delta and d.delta >= 2:
                strengths.append(f"Behavioral alpha rose {d.delta:+.1f}% — documented decisions are generating a larger return advantage.")
        elif d.direction == "declining":
            if d.key == "dqs":
                concerns.append("Decision Quality Score is trending down. Review your last 30 days: are you skipping rationale or overriding warnings more often?")
            elif d.key == "doc_rate":
                concerns.append(f"Documentation rate fell {d.delta:.0f}%. Undocumented trades erode outcome correlation — the engine loses its feedback signal.")
            elif d.key == "risk_overrides":
                concerns.append(f"Risk overrides increased by {abs(d.delta):.0f}. Each blind override removes a safety checkpoint between you and a costly mistake.")
            elif d.key == "behavioral_alpha":
                concerns.append("Behavioral alpha is contracting — documented trades are losing their return edge vs undocumented ones. Review your thesis quality.")

    # Absolute level checks (independent of trend)
    if current.doc_rate_pct is not None and current.doc_rate_pct >= 80 and "doc_rate" not in [d.key for d in deltas if d.direction == "improving"]:
        strengths.append(f"Documentation rate at {current.doc_rate_pct:.0f}% — consistently above the threshold where outcome correlation becomes statistically reliable.")
    if current.risk_overrides == 0:
        strengths.append("Zero risk overrides this window — every executed order cleared pre-flight without a Reconsider verdict.")

    return strengths[:4], concerns[:4]


def get_investor_evolution(db: Session, investor_id: uuid.UUID) -> InvestorEvolutionReport:
    now = datetime.now(timezone.utc)
    curr_end = now
    curr_start = now - timedelta(days=_WINDOW_DAYS)
    prev_end = curr_start
    prev_start = now - timedelta(days=_WINDOW_DAYS * 2)

    all_orders = _get_all_orders(db, investor_id)

    curr_orders = _filter_window(all_orders, curr_start, curr_end)
    prev_orders = _filter_window(all_orders, prev_start, prev_end)

    has_sufficient_data = len(curr_orders) >= _MIN_WINDOW_ORDERS
    has_comparison = has_sufficient_data and len(prev_orders) >= _MIN_WINDOW_ORDERS

    if not has_sufficient_data:
        return InvestorEvolutionReport(
            investor_id=investor_id,
            has_sufficient_data=False,
            has_comparison=False,
            current_window_start=curr_start.date(),
            current_window_end=curr_end.date(),
            previous_window_start=prev_start.date(),
            previous_window_end=prev_end.date(),
            current=WindowMetrics(dqs=None, doc_rate_pct=None, risk_overrides=0, behavioral_alpha_pct=None, order_count=len(curr_orders)),
            previous=None,
            deltas=[],
            strengths=[],
            concerns=[],
            generated_at=now,
        )

    current_metrics = _compute_window(db, curr_orders)
    previous_metrics = _compute_window(db, prev_orders) if has_comparison else None

    deltas = _build_deltas(current_metrics, previous_metrics)
    strengths, concerns = _build_strengths_concerns(deltas, current_metrics)

    return InvestorEvolutionReport(
        investor_id=investor_id,
        has_sufficient_data=True,
        has_comparison=has_comparison,
        current_window_start=curr_start.date(),
        current_window_end=curr_end.date(),
        previous_window_start=prev_start.date() if has_comparison else None,
        previous_window_end=prev_end.date() if has_comparison else None,
        current=current_metrics,
        previous=previous_metrics,
        deltas=deltas,
        strengths=strengths,
        concerns=concerns,
        generated_at=now,
    )

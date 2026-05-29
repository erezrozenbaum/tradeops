"""Behavioral Alpha — measures how much decision-making behavior impacts returns.

For each behavioral dimension (documentation, goal alignment, risk compliance)
we split executed buy orders into two groups, compute average return using the
live price cache, and report the alpha (disciplined group minus comparison group).

No external API calls — uses only the existing price cache.
"""
import uuid
from datetime import datetime, timezone
from statistics import mean
from typing import Callable

from sqlalchemy.orm import Session

from app.behavioral_alpha.schemas import (
    AlphaDimension,
    BehavioralAlphaReport,
    DecisionHighlight,
    MistakePattern,
)
from app.models.staged_order import StagedOrder

_MIN_PRICED = 3   # minimum priced orders needed before showing comparisons


def _verdict(o: StagedOrder) -> str | None:
    return (o.pre_flight_review or {}).get("verdict")


def _get_executed_buys(db: Session, investor_id: uuid.UUID) -> list[StagedOrder]:
    return (
        db.query(StagedOrder)
        .filter(
            StagedOrder.investor_id == investor_id,
            StagedOrder.status == "executed",
            StagedOrder.action == "buy",
            StagedOrder.ticker.isnot(None),
            StagedOrder.unit_price > 0,
            StagedOrder.executed_at.isnot(None),
        )
        .order_by(StagedOrder.executed_at.desc())
        .all()
    )


def _price_orders(
    db: Session, orders: list[StagedOrder]
) -> list[tuple[StagedOrder, float]]:
    """Return (order, return_pct) for orders with a cached live price."""
    from app.market_data.service import get_cached_price

    result = []
    for o in orders:
        snap = get_cached_price(db, o.ticker)
        if snap is None or snap.price <= 0:
            continue
        ret = round((snap.price - o.unit_price) / o.unit_price * 100, 2)
        result.append((o, ret))
    return result


def _alpha_dimension(
    data: list[tuple[StagedOrder, float]],
    group_a_fn: Callable[[StagedOrder], bool],
    label: str,
    group_a_label: str,
    group_b_label: str,
) -> AlphaDimension:
    group_a = [r for o, r in data if group_a_fn(o)]
    group_b = [r for o, r in data if not group_a_fn(o)]

    a_avg = round(mean(group_a), 2) if group_a else None
    b_avg = round(mean(group_b), 2) if group_b else None
    alpha = round(a_avg - b_avg, 2) if (a_avg is not None and b_avg is not None) else None

    return AlphaDimension(
        label=label,
        group_a_label=group_a_label,
        group_b_label=group_b_label,
        group_a_avg_return=a_avg,
        group_b_avg_return=b_avg,
        alpha_pct=alpha,
        group_a_win_rate=round(sum(1 for r in group_a if r > 0) / len(group_a), 3) if group_a else None,
        group_b_win_rate=round(sum(1 for r in group_b if r > 0) / len(group_b), 3) if group_b else None,
        group_a_count=len(group_a),
        group_b_count=len(group_b),
        has_data=len(group_a) + len(group_b) >= _MIN_PRICED,
    )


def _build_highlight(o: StagedOrder, ret: float) -> DecisionHighlight:
    snippet = None
    if o.rationale:
        snippet = o.rationale[:120] + ("…" if len(o.rationale) > 120 else "")
    return DecisionHighlight(
        order_id=str(o.id),
        ticker=o.ticker,
        name=o.name,
        action=o.action,
        executed_at=o.executed_at.isoformat() if o.executed_at else None,
        estimated_value=o.estimated_value,
        currency=o.currency,
        return_pct=ret,
        had_rationale=bool(o.rationale),
        was_goal_linked=bool(o.goal_id),
        pre_flight_verdict=_verdict(o),
        rationale_snippet=snippet,
    )


def _detect_patterns(
    all_executed: list[StagedOrder],
    priced: list[tuple[StagedOrder, float]],
) -> list[MistakePattern]:
    priced_map = {o.id: ret for o, ret in priced}
    patterns: list[MistakePattern] = []

    # ── Blind overrides (reconsider + no rationale)
    blind = [o for o in all_executed if _verdict(o) == "reconsider" and not o.rationale]
    if blind:
        costs = [priced_map[o.id] for o in blind if o.id in priced_map]
        patterns.append(MistakePattern(
            pattern_key="blind_override",
            label="Blind Risk Override",
            description=(
                "Executed against a 'Reconsider' pre-flight verdict with no written rationale. "
                "Overriding the risk engine without a documented thesis removes the only safeguard "
                "between impulse and execution."
            ),
            frequency=len(blind),
            estimated_avg_return_pct=round(mean(costs), 2) if costs else None,
        ))

    # ── Undocumented losses (recurring undocumented trades with negative return)
    undoc_losses = [(o, priced_map[o.id]) for o in all_executed
                    if not o.rationale and o.id in priced_map and priced_map[o.id] < -3]
    if len(undoc_losses) >= 2:
        avg_loss = mean(r for _, r in undoc_losses)
        patterns.append(MistakePattern(
            pattern_key="undocumented_loss",
            label="Recurring Undocumented Losses",
            description=(
                f"{len(undoc_losses)} undocumented trades resulted in losses. "
                "Without a written thesis at entry, there's no framework to evaluate whether "
                "the loss was bad luck or a bad decision — and no way to improve."
            ),
            frequency=len(undoc_losses),
            estimated_avg_return_pct=round(avg_loss, 2),
        ))

    # ── Large reactive trades (high value, no rationale, no goal)
    if all_executed:
        avg_val = mean(o.estimated_value for o in all_executed)
        reactive_large = [o for o in all_executed
                          if not o.rationale and not o.goal_id and o.estimated_value > avg_val * 1.5]
        if reactive_large:
            costs = [priced_map[o.id] for o in reactive_large if o.id in priced_map]
            patterns.append(MistakePattern(
                pattern_key="reactive_large_trade",
                label="Large Unplanned Trades",
                description=(
                    f"{len(reactive_large)} above-average-size trades with no written rationale "
                    "and no goal linkage. Large positions without a documented thesis carry "
                    "disproportionate risk relative to the decision quality invested."
                ),
                frequency=len(reactive_large),
                estimated_avg_return_pct=round(mean(costs), 2) if costs else None,
            ))

    # ── Goal drift (systemic low goal-linkage on executed orders)
    if len(all_executed) >= 5:
        goal_rate = sum(1 for o in all_executed if o.goal_id) / len(all_executed)
        if goal_rate < 0.25:
            patterns.append(MistakePattern(
                pattern_key="goal_drift",
                label="Systematic Goal Drift",
                description=(
                    f"Only {goal_rate*100:.0f}% of executed trades are linked to financial goals. "
                    "Trading consistently outside your goal framework suggests activity is driven "
                    "by market noise rather than personal financial objectives."
                ),
                frequency=len(all_executed),
                estimated_avg_return_pct=None,
            ))

    return patterns[:4]


def compute_behavioral_alpha(
    db: Session,
    investor_id: uuid.UUID,
) -> BehavioralAlphaReport:
    executed_buys = _get_executed_buys(db, investor_id)
    priced = _price_orders(db, executed_buys)
    now = datetime.now(timezone.utc)

    coverage = round(len(priced) / len(executed_buys) * 100, 1) if executed_buys else 0.0

    doc_alpha = _alpha_dimension(
        priced,
        lambda o: bool(o.rationale and o.rationale.strip()),
        label="Documentation Alpha",
        group_a_label="Documented",
        group_b_label="Undocumented",
    )
    goal_alpha = _alpha_dimension(
        priced,
        lambda o: bool(o.goal_id),
        label="Goal Alignment Alpha",
        group_a_label="Goal-Linked",
        group_b_label="Reactive",
    )
    risk_alpha = _alpha_dimension(
        priced,
        lambda o: _verdict(o) != "reconsider",
        label="Risk Compliance Alpha",
        group_a_label="Risk-Compliant",
        group_b_label="Warning Override",
    )

    # Best / worst decisions (by return, from priced orders)
    sorted_priced = sorted(priced, key=lambda x: x[1], reverse=True)
    best = [_build_highlight(o, r) for o, r in sorted_priced[:3]]
    worst = [_build_highlight(o, r) for o, r in sorted_priced[-3:] if r < 0]

    patterns = _detect_patterns(executed_buys, priced)

    return BehavioralAlphaReport(
        investor_id=investor_id,
        documentation_alpha=doc_alpha,
        goal_alignment_alpha=goal_alpha,
        risk_compliance_alpha=risk_alpha,
        best_decisions=best,
        worst_decisions=worst,
        mistake_patterns=patterns,
        total_executed=len(executed_buys),
        priced_orders=len(priced),
        price_coverage_pct=coverage,
        sufficient_data=len(priced) >= _MIN_PRICED,
        generated_at=now,
    )

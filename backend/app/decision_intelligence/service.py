"""Decision Intelligence — deterministic Decision Quality Score engine.

Computes a 0-100 score measuring HOW an investor makes decisions, not whether
markets cooperated.  Four components:

  Documentation Discipline (0-35)  — does the investor write a thesis?
  Risk Intelligence        (0-30)  — does pre-flight guidance get respected?
  Goal Alignment           (0-20)  — are trades linked to financial goals?
  Outcome Correlation      (0-15)  — do documented trades outperform undocumented?
                                      (uses live price cache; proxied to process
                                       quality when price data unavailable)

No external API calls.  Pure DB + cache queries.
"""
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from statistics import mean
from typing import Any

from sqlalchemy.orm import Session

from app.decision_intelligence.schemas import (
    BehavioralInsight,
    DecisionIntelligenceReport,
    DQSComponents,
    DQSHistoryPoint,
    OutcomeComparison,
)
from app.models.staged_order import StagedOrder

_MIN_ORDERS_FOR_INSIGHTS = 2
_MIN_PRICE_SAMPLES = 3   # minimum executed orders with live prices for outcome correlation


# ─── helpers ──────────────────────────────────────────────────────────────────

def _verdict(order: StagedOrder) -> str | None:
    return (order.pre_flight_review or {}).get("verdict")


def _dqs_label(score: float) -> str:
    if score >= 80:
        return "Excellent"
    if score >= 65:
        return "Good"
    if score >= 45:
        return "Fair"
    return "Needs Work"


def _get_orders(db: Session, investor_id: uuid.UUID) -> list[StagedOrder]:
    return (
        db.query(StagedOrder)
        .filter(StagedOrder.investor_id == investor_id)
        .order_by(StagedOrder.created_at.desc())
        .all()
    )


# ─── component scorers ────────────────────────────────────────────────────────

def _documentation_score(orders: list[StagedOrder]) -> tuple[float, float]:
    """Returns (score 0-35, rate 0-1)."""
    if not orders:
        return 0.0, 0.0
    documented = sum(1 for o in orders if o.rationale and o.rationale.strip())
    rate = documented / len(orders)
    return round(rate * 35, 2), round(rate, 4)


def _risk_intelligence_score(
    orders: list[StagedOrder],
) -> tuple[float, float, int, int]:
    """Returns (score 0-30, compliance_rate, reconsider_overrides, reconsider_total)."""
    executed = [o for o in orders if o.status == "executed"]
    if not executed:
        return 15.0, 1.0, 0, 0  # neutral default when no executions yet

    reconsider_executed = [o for o in executed if _verdict(o) == "reconsider"]
    reconsider_total = len(reconsider_executed)
    reconsider_with_rationale = sum(1 for o in reconsider_executed if o.rationale)
    non_reconsider = [o for o in executed if _verdict(o) != "reconsider"]

    # Base: fraction of executed orders that did NOT override a reconsider warning
    base_rate = len(non_reconsider) / len(executed)
    base_score = base_rate * 20.0

    # Bonus: of reconsider overrides, what fraction had documented rationale?
    if reconsider_total > 0:
        documented_rate = reconsider_with_rationale / reconsider_total
        bonus = documented_rate * 10.0
    else:
        bonus = 10.0  # never overrode a warning → full bonus

    score = round(min(30.0, base_score + bonus), 2)
    compliance_rate = round(
        (len(non_reconsider) + reconsider_with_rationale) / len(executed), 4
    )
    return score, compliance_rate, reconsider_total, reconsider_with_rationale


def _goal_alignment_score(orders: list[StagedOrder]) -> tuple[float, float]:
    """Returns (score 0-20, rate 0-1)."""
    if not orders:
        return 0.0, 0.0
    goal_linked = sum(1 for o in orders if o.goal_id)
    rate = goal_linked / len(orders)
    return round(rate * 20.0, 2), round(rate, 4)


def _outcome_correlation(
    db: Session,
    orders: list[StagedOrder],
) -> OutcomeComparison | None:
    """Compare returns of documented vs. undocumented executed BUY orders.

    Uses the live price cache (no external calls).  Returns None when fewer
    than _MIN_PRICE_SAMPLES orders have a cached price.
    """
    from app.market_data.service import get_cached_price

    executed_buys = [
        o for o in orders
        if o.status == "executed" and o.ticker and o.action == "buy" and o.unit_price and o.unit_price > 0
    ]
    if not executed_buys:
        return None

    results: list[dict[str, Any]] = []
    for o in executed_buys:
        snap = get_cached_price(db, o.ticker)
        if snap is None or snap.price <= 0:
            continue
        ret_pct = round((snap.price - o.unit_price) / o.unit_price * 100, 2)
        results.append({
            "documented": bool(o.rationale and o.rationale.strip()),
            "return_pct": ret_pct,
        })

    if len(results) < _MIN_PRICE_SAMPLES:
        return None

    doc_returns = [r["return_pct"] for r in results if r["documented"]]
    undoc_returns = [r["return_pct"] for r in results if not r["documented"]]

    doc_avg = round(mean(doc_returns), 2) if doc_returns else None
    undoc_avg = round(mean(undoc_returns), 2) if undoc_returns else None
    outperformance = round(doc_avg - undoc_avg, 2) if (doc_avg is not None and undoc_avg is not None) else None

    return OutcomeComparison(
        documented_avg_return_pct=doc_avg,
        undocumented_avg_return_pct=undoc_avg,
        documented_win_rate=round(sum(1 for r in doc_returns if r > 0) / len(doc_returns), 3) if doc_returns else None,
        undocumented_win_rate=round(sum(1 for r in undoc_returns if r > 0) / len(undoc_returns), 3) if undoc_returns else None,
        outperformance_pct=outperformance,
        sample_documented=len(doc_returns),
        sample_undocumented=len(undoc_returns),
        has_sufficient_data=len(results) >= _MIN_PRICE_SAMPLES,
    )


def _outcome_or_process_score(
    db: Session,
    orders: list[StagedOrder],
    oc: OutcomeComparison | None,
) -> float:
    """Returns outcome correlation score 0-15.

    When live price data is available, rewards documented outperformance.
    When unavailable, uses process quality as proxy.
    """
    if oc and oc.has_sufficient_data:
        op = oc.outperformance_pct
        if op is None:
            # Only one group exists
            return 10.0
        if op >= 5:
            return 15.0
        if op >= 0:
            return 11.0
        if op >= -5:
            return 7.0
        return 4.0
    else:
        # Process quality proxy
        score = 7.5  # neutral base
        executed = [o for o in orders if o.status == "executed"]
        # Depth of rationale (avg word count)
        rationales = [o.rationale for o in orders if o.rationale]
        if rationales:
            avg_words = mean(len(r.split()) for r in rationales)
            if avg_words >= 30:
                score = min(score + 4.5, 15.0)
            elif avg_words >= 15:
                score = min(score + 2.5, 15.0)
        # Outcome snapshots exist (invested 30+ days)
        if any(o.outcome_snapshots for o in executed):
            score = min(score + 3.0, 15.0)
        return round(score, 2)


def compute_monthly_dqs(db: Session, orders: list[StagedOrder]) -> float | None:
    """Compute DQS for any subset of orders (e.g. a single month).

    Used by reflection_report to ensure monthly DQS is identical to the
    full Decision Intelligence calculation — not a separate proxy formula.
    """
    if not orders:
        return None
    d_score, _ = _documentation_score(orders)
    r_score, _, _, _ = _risk_intelligence_score(orders)
    g_score, _ = _goal_alignment_score(orders)
    oc = _outcome_correlation(db, orders)
    op_score = _outcome_or_process_score(db, orders, oc)
    return round(min(100.0, d_score + r_score + g_score + op_score), 1)


# ─── insight generation ───────────────────────────────────────────────────────

def _generate_insights(
    orders: list[StagedOrder],
    doc_rate: float,
    goal_rate: float,
    reconsider_overrides: int,
    outcome_comparison: OutcomeComparison | None,
    trend: str,
    trend_delta: float | None,
) -> list[BehavioralInsight]:
    insights: list[BehavioralInsight] = []
    executed = [o for o in orders if o.status == "executed"]
    total = len(orders)

    # ── Documentation
    if doc_rate >= 0.75:
        insights.append(BehavioralInsight(
            category="strength",
            title="Strong Documentation Habit",
            body=(
                f"You document {doc_rate*100:.0f}% of your decisions — well above average. "
                "Consistent documentation creates a feedback loop that accelerates "
                "decision quality improvement over time."
            ),
            metric=f"{doc_rate*100:.0f}% documented",
        ))
    elif doc_rate >= 0.4:
        undoc = sum(1 for o in orders if not o.rationale)
        insights.append(BehavioralInsight(
            category="opportunity",
            title="Documentation Gap",
            body=(
                f"{undoc} of your orders have no written rationale. "
                "Adding even one sentence before you stage a trade unlocks outcome correlation "
                "tracking and meaningfully improves your Decision Quality Score."
            ),
            metric=f"{undoc} orders without rationale",
        ))
    elif total >= _MIN_ORDERS_FOR_INSIGHTS:
        insights.append(BehavioralInsight(
            category="warning",
            title="Low Documentation Rate",
            body=(
                f"Only {doc_rate*100:.0f}% of decisions have a written rationale. "
                "Without a thesis, it's impossible to know whether a good outcome "
                "was skill or luck — or learn from a bad one."
            ),
            metric=f"{doc_rate*100:.0f}% documented",
        ))

    # ── Risk overrides
    if reconsider_overrides > 0:
        blind_overrides = sum(
            1 for o in executed
            if _verdict(o) == "reconsider" and not o.rationale
        )
        if blind_overrides > 0:
            insights.append(BehavioralInsight(
                category="warning",
                title="Blind Risk Overrides Detected",
                body=(
                    f"You executed {blind_overrides} order{'s' if blind_overrides > 1 else ''} "
                    "flagged 'Reconsider' with no written rationale. "
                    "These are your highest-risk blind spots — executing against the risk engine "
                    "without a documented reason is where most costly mistakes originate."
                ),
                metric=f"{blind_overrides} undocumented override{'s' if blind_overrides > 1 else ''}",
            ))
        else:
            insights.append(BehavioralInsight(
                category="strength",
                title="Disciplined Override Behavior",
                body=(
                    f"You overrode risk warnings {reconsider_overrides} "
                    f"time{'s' if reconsider_overrides > 1 else ''} and always documented your reasoning. "
                    "Conscious, documented overrides show mature risk awareness — "
                    "you disagreed with the engine, but you knew exactly why."
                ),
                metric=f"{reconsider_overrides} documented override{'s' if reconsider_overrides > 1 else ''}",
            ))
    elif executed:
        insights.append(BehavioralInsight(
            category="strength",
            title="Perfect Pre-Flight Record",
            body=(
                "You've never executed an order against a 'Reconsider' verdict without documented reasoning. "
                "This single discipline significantly reduces the risk of costly impulsive decisions."
            ),
            metric="0 blind overrides",
        ))

    # ── Goal alignment
    if goal_rate >= 0.65:
        insights.append(BehavioralInsight(
            category="strength",
            title="Purpose-Driven Portfolio",
            body=(
                f"{goal_rate*100:.0f}% of your trades are linked to financial goals. "
                "Goal-linked investing creates measurable success criteria, reduces reactive trading, "
                "and makes outcome review more meaningful."
            ),
            metric=f"{goal_rate*100:.0f}% goal-linked",
        ))
    elif goal_rate < 0.3 and total >= _MIN_ORDERS_FOR_INSIGHTS:
        unlinked = sum(1 for o in orders if not o.goal_id)
        insights.append(BehavioralInsight(
            category="opportunity",
            title="Connect Trades to Goals",
            body=(
                f"{unlinked} of your orders aren't linked to a financial goal. "
                "Linking a trade to a goal forces you to answer 'why does this trade serve my plan?' — "
                "the clearest filter against reactive investing."
            ),
            metric=f"{unlinked} unlinked orders",
        ))

    # ── Outcome correlation — the killer insight
    if outcome_comparison and outcome_comparison.has_sufficient_data:
        doc_avg = outcome_comparison.documented_avg_return_pct
        undoc_avg = outcome_comparison.undocumented_avg_return_pct
        op = outcome_comparison.outperformance_pct

        if op is not None and doc_avg is not None and undoc_avg is not None:
            if op > 3:
                insights.append(BehavioralInsight(
                    category="strength",
                    title="Documentation Predicts Your Returns",
                    body=(
                        f"Your documented decisions return {doc_avg:+.1f}% on average "
                        f"vs {undoc_avg:+.1f}% for undocumented ones — "
                        f"a {op:.1f}% edge. Your own data proves that writing a thesis before "
                        "trading improves performance. This is not a theory — it's your history."
                    ),
                    metric=f"{op:+.1f}% documented advantage",
                ))
            elif op < -3:
                insights.append(BehavioralInsight(
                    category="pattern",
                    title="Undocumented Trades Currently Outperform",
                    body=(
                        f"Your undocumented decisions return {undoc_avg:+.1f}% vs "
                        f"{doc_avg:+.1f}% documented. This may reflect that you document "
                        "higher-conviction, higher-risk bets, or that the sample is still small. "
                        "Watch this metric as your history grows."
                    ),
                    metric=f"Undocumented: {undoc_avg:+.1f}% | Documented: {doc_avg:+.1f}%",
                ))
            else:
                insights.append(BehavioralInsight(
                    category="pattern",
                    title="Performance Parity Across Documentation",
                    body=(
                        f"Documented ({doc_avg:+.1f}%) and undocumented ({undoc_avg:+.1f}%) "
                        "decisions return similarly. Continue building your history — "
                        "a clearer pattern typically emerges after 10+ executed orders."
                    ),
                    metric=f"Delta: {op:+.1f}%",
                ))
        elif doc_avg is not None:
            insights.append(BehavioralInsight(
                category="pattern",
                title="Documented Decision Performance",
                body=(
                    f"Your documented decisions return {doc_avg:+.1f}% on average. "
                    "Document a few more undocumented orders to unlock the full comparison."
                ),
                metric=f"Avg return: {doc_avg:+.1f}%",
            ))

    # ── Trend
    if trend == "improving" and trend_delta is not None and trend_delta >= 5:
        insights.append(BehavioralInsight(
            category="strength",
            title="Decision Quality Improving",
            body=(
                f"Your Decision Quality Score rose {trend_delta:.0f} points in recent months. "
                "Consistent improvement in discipline is a stronger long-term predictor of "
                "investing success than any short-term return."
            ),
            metric=f"+{trend_delta:.0f} DQS points",
        ))
    elif trend == "declining" and trend_delta is not None and abs(trend_delta) >= 5:
        insights.append(BehavioralInsight(
            category="warning",
            title="Decision Quality Declining",
            body=(
                f"Your Decision Quality Score dropped {abs(trend_delta):.0f} points recently. "
                "Review recent orders: are you documenting less? Skipping pre-flight? "
                "These habits erode the feedback loop that protects you from costly mistakes."
            ),
            metric=f"{trend_delta:.0f} DQS points",
        ))

    return insights[:6]  # cap to avoid overwhelming


# ─── DQS history ──────────────────────────────────────────────────────────────

def _dqs_history(
    db: Session,
    orders: list[StagedOrder],
) -> list[DQSHistoryPoint]:
    by_month: dict[str, list[StagedOrder]] = defaultdict(list)
    for o in orders:
        key = o.created_at.strftime("%Y-%m")
        by_month[key].append(o)

    history: list[DQSHistoryPoint] = []
    for month, month_orders in sorted(by_month.items()):
        monthly_dqs = compute_monthly_dqs(db, month_orders) or 0.0
        history.append(DQSHistoryPoint(
            month=month,
            score=monthly_dqs,
            order_count=len(month_orders),
        ))

    return history[-12:]


def _compute_trend(history: list[DQSHistoryPoint]) -> tuple[str, float | None]:
    if len(history) < 2:
        return "insufficient_data", None
    recent = history[-min(3, len(history)):]
    older = history[:-min(3, len(history))]
    if not older:
        return "insufficient_data", None
    delta = round(mean(p.score for p in recent) - mean(p.score for p in older), 1)
    if delta >= 5:
        return "improving", delta
    if delta <= -5:
        return "declining", delta
    return "stable", delta


# ─── coach notes ──────────────────────────────────────────────────────────────

def _generate_coach_notes(
    doc_rate: float,
    goal_rate: float,
    reconsider_overrides: int,
    executed_count: int,
    outcome_comparison: OutcomeComparison | None,
    orders: list[StagedOrder],
) -> list[str]:
    notes: list[str] = []

    if doc_rate < 0.5:
        notes.append(
            "Before staging your next order, write one sentence explaining WHY you're making this trade. "
            "This single habit has the highest per-action impact on your Decision Quality Score."
        )

    executed_reconsiders = [
        o for o in orders
        if o.status == "executed" and _verdict(o) == "reconsider" and not o.rationale
    ]
    if executed_reconsiders:
        notes.append(
            f"You have {len(executed_reconsiders)} undocumented 'Reconsider' override"
            f"{'s' if len(executed_reconsiders) > 1 else ''}. "
            "Before your next override, write specifically why you disagree with the pre-flight assessment."
        )

    if goal_rate < 0.4 and executed_count >= 2:
        notes.append(
            "Link your next trade to a financial goal — even a broad one like 'growth portfolio'. "
            "It forces the question: does this trade serve my plan, or react to noise?"
        )

    if outcome_comparison and outcome_comparison.has_sufficient_data:
        op = outcome_comparison.outperformance_pct
        doc_avg = outcome_comparison.documented_avg_return_pct
        undoc_avg = outcome_comparison.undocumented_avg_return_pct
        if op is not None and op > 3 and doc_avg is not None and undoc_avg is not None:
            notes.append(
                f"Your data confirms it: documented trades return {doc_avg:+.1f}% "
                f"vs {undoc_avg:+.1f}% undocumented. You already know the right behavior — "
                "apply it consistently to compound the advantage."
            )

    if not notes:
        notes.append(
            "Your decision process is solid. Maintain consistency — the DQS compounds "
            "over time the same way a well-constructed portfolio does."
        )

    return notes[:3]


# ─── main entry point ─────────────────────────────────────────────────────────

def compute_decision_intelligence(
    db: Session,
    investor_id: uuid.UUID,
) -> DecisionIntelligenceReport:
    orders = _get_orders(db, investor_id)
    executed = [o for o in orders if o.status == "executed"]
    documented = [o for o in orders if o.rationale and o.rationale.strip()]

    now = datetime.now(timezone.utc)

    if not orders:
        return DecisionIntelligenceReport(
            investor_id=investor_id,
            dqs=0.0,
            dqs_label="No Data",
            components=DQSComponents(
                documentation=0, risk_intelligence=0,
                goal_alignment=0, outcome_correlation=0,
            ),
            trend="insufficient_data",
            trend_delta=None,
            dqs_history=[],
            insights=[],
            outcome_comparison=None,
            coach_notes=[
                "Stage your first order to start building your Decision Quality profile. "
                "Add a rationale to unlock the outcome correlation feature."
            ],
            total_orders=0,
            executed_orders=0,
            documented_orders=0,
            sufficient_data=False,
            generated_at=now,
        )

    doc_score, doc_rate = _documentation_score(orders)
    risk_score, compliance_rate, reconsider_overrides, _ = _risk_intelligence_score(orders)
    goal_score, goal_rate = _goal_alignment_score(orders)
    oc = _outcome_correlation(db, orders)
    op_score = _outcome_or_process_score(db, orders, oc)

    dqs = round(min(100.0, doc_score + risk_score + goal_score + op_score), 1)

    history = _dqs_history(db, orders)
    trend, trend_delta = _compute_trend(history)

    insights = _generate_insights(
        orders, doc_rate, goal_rate, reconsider_overrides,
        oc, trend, trend_delta,
    )

    coach_notes = _generate_coach_notes(
        doc_rate, goal_rate, reconsider_overrides, len(executed), oc, orders,
    )

    return DecisionIntelligenceReport(
        investor_id=investor_id,
        dqs=dqs,
        dqs_label=_dqs_label(dqs),
        components=DQSComponents(
            documentation=doc_score,
            risk_intelligence=risk_score,
            goal_alignment=goal_score,
            outcome_correlation=op_score,
        ),
        trend=trend,
        trend_delta=trend_delta,
        dqs_history=history,
        insights=insights,
        outcome_comparison=oc,
        coach_notes=coach_notes,
        total_orders=len(orders),
        executed_orders=len(executed),
        documented_orders=len(documented),
        sufficient_data=len(orders) >= _MIN_ORDERS_FOR_INSIGHTS,
        generated_at=now,
    )

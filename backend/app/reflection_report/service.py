"""Monthly Investor Reflection Report — deterministic narrative engine.

Generates a structured month-in-review for an investor's decision activity:
headline, decision quality narrative, behavioral narrative, improvement focus,
achievements, and watch items.  No external API calls.  Pure data → text.
"""
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from statistics import mean

from sqlalchemy.orm import Session

from app.models.staged_order import StagedOrder
from app.reflection_report.schemas import (
    MonthlyReflectionReport,
    MonthlyStats,
)

_MONTH_NAMES = {
    "01": "January", "02": "February", "03": "March", "04": "April",
    "05": "May", "06": "June", "07": "July", "08": "August",
    "09": "September", "10": "October", "11": "November", "12": "December",
}


def _month_label(month: str) -> str:
    """'2026-05' → 'May 2026'"""
    parts = month.split("-")
    if len(parts) != 2:
        return month
    return f"{_MONTH_NAMES.get(parts[1], parts[1])} {parts[0]}"


def _verdict(o: StagedOrder) -> str | None:
    return (o.pre_flight_review or {}).get("verdict")


def _get_all_orders(db: Session, investor_id: uuid.UUID) -> list[StagedOrder]:
    return (
        db.query(StagedOrder)
        .filter(StagedOrder.investor_id == investor_id)
        .order_by(StagedOrder.created_at.asc())
        .all()
    )


def _group_by_month(orders: list[StagedOrder]) -> dict[str, list[StagedOrder]]:
    by_month: dict[str, list[StagedOrder]] = defaultdict(list)
    for o in orders:
        key = o.created_at.strftime("%Y-%m")
        by_month[key].append(o)
    return dict(by_month)


def _compute_stats(orders: list[StagedOrder]) -> MonthlyStats:
    executed = [o for o in orders if o.status == "executed"]
    cancelled = [o for o in orders if o.status == "cancelled"]
    documented = [o for o in orders if o.rationale and o.rationale.strip()]
    goal_linked = [o for o in orders if o.goal_id]
    overrides = [o for o in executed if _verdict(o) == "reconsider"]

    n = len(orders)
    return MonthlyStats(
        total_decisions=n,
        executed_decisions=len(executed),
        cancelled_decisions=len(cancelled),
        documented_decisions=len(documented),
        goal_linked_decisions=len(goal_linked),
        documentation_rate=round(len(documented) / n, 3) if n else 0.0,
        goal_alignment_rate=round(len(goal_linked) / n, 3) if n else 0.0,
        risk_override_count=len(overrides),
    )


def _monthly_dqs(orders: list[StagedOrder]) -> float | None:
    """Simple DQS proxy for a single month's orders (matches decision_intelligence logic)."""
    if not orders:
        return None
    n = len(orders)
    documented = sum(1 for o in orders if o.rationale)
    doc_score = (documented / n) * 35

    executed = [o for o in orders if o.status == "executed"]
    if executed:
        reconsider = sum(1 for o in executed if _verdict(o) == "reconsider")
        non_rec = len(executed) - reconsider
        risk_score = (non_rec / len(executed)) * 20 + (10.0 if reconsider == 0 else 5.0)
    else:
        risk_score = 15.0

    goal_linked = sum(1 for o in orders if o.goal_id)
    goal_score = (goal_linked / n) * 20

    return round(min(100.0, doc_score + risk_score + goal_score + 7.5), 1)


# ─── Narrative generators ──────────────────────────────────────────────────────

def _headline(
    month_label: str,
    stats: MonthlyStats,
    dqs: float | None,
    dqs_change: float | None,
) -> str:
    if stats.total_decisions == 0:
        return f"No decisions recorded in {month_label}."
    if dqs_change is not None:
        if dqs_change >= 15:
            return f"Breakthrough month: decision quality jumped {dqs_change:.0f} points in {month_label}."
        if dqs_change >= 7:
            return f"{month_label} — meaningful improvement in decision discipline."
        if dqs_change <= -15:
            return f"Decision discipline declined sharply in {month_label} — worth a close review."
        if dqs_change <= -7:
            return f"Slight regression in {month_label}: discipline metrics dipped."
    if dqs is not None and dqs >= 75:
        return f"Strong month: {stats.total_decisions} decisions with high discipline score ({dqs:.0f}/100)."
    if stats.documentation_rate >= 0.85:
        return (
            f"Excellent documentation month: {stats.documented_decisions} of "
            f"{stats.total_decisions} decisions had written rationale."
        )
    if stats.documentation_rate < 0.2 and stats.total_decisions >= 3:
        return f"{stats.total_decisions} decisions in {month_label}, but most without a written thesis."
    return (
        f"{stats.total_decisions} investment decision{'s' if stats.total_decisions != 1 else ''} "
        f"recorded in {month_label}."
    )


def _decision_quality_narrative(
    stats: MonthlyStats,
    dqs: float | None,
    dqs_change: float | None,
) -> str:
    parts = []

    if dqs is not None:
        label = (
            "Excellent" if dqs >= 80 else
            "Good" if dqs >= 65 else
            "Fair" if dqs >= 45 else
            "Needs Work"
        )
        parts.append(f"Decision Quality Score: {dqs:.0f}/100 ({label}).")

    if dqs_change is not None:
        if dqs_change >= 5:
            parts.append(f"That's {dqs_change:+.0f} points vs. last month — you're building momentum.")
        elif dqs_change <= -5:
            parts.append(
                f"That's {dqs_change:+.0f} points vs. last month. "
                "Review which habits slipped: documentation rate, goal linkage, or pre-flight compliance."
            )
        else:
            parts.append("Score held steady month-over-month.")

    if stats.documentation_rate >= 0.8:
        parts.append(
            f"Documentation: {stats.documentation_rate*100:.0f}% — "
            "you consistently wrote your thesis before trading this month."
        )
    elif stats.documentation_rate >= 0.5:
        undoc = stats.total_decisions - stats.documented_decisions
        parts.append(
            f"Documentation: {stats.documentation_rate*100:.0f}%. "
            f"{undoc} order{'s' if undoc > 1 else ''} still missing a rationale."
        )
    else:
        parts.append(
            f"Documentation: {stats.documentation_rate*100:.0f}%. "
            "Writing your thesis on every trade is the single highest-leverage habit to develop."
        )

    return " ".join(parts) if parts else "Insufficient data for quality analysis."


def _behavioral_narrative(stats: MonthlyStats) -> str:
    parts = []

    if stats.goal_alignment_rate >= 0.7:
        parts.append(
            f"{stats.goal_alignment_rate*100:.0f}% of trades were linked to financial goals — "
            "your portfolio activity stayed aligned with your plan."
        )
    elif stats.goal_alignment_rate < 0.3 and stats.total_decisions >= 3:
        unlinked = stats.total_decisions - stats.goal_linked_decisions
        parts.append(
            f"{unlinked} trade{'s' if unlinked > 1 else ''} had no goal linkage. "
            "Reactive trading without goal context tends to add noise rather than progress."
        )

    if stats.risk_override_count == 0 and stats.executed_decisions > 0:
        parts.append("You respected all pre-flight verdicts this month — no reconsider overrides.")
    elif stats.risk_override_count > 0:
        parts.append(
            f"{stats.risk_override_count} order{'s were' if stats.risk_override_count > 1 else ' was'} "
            "executed against a 'Reconsider' pre-flight verdict. "
            "Whether right or wrong, always document why you disagree with the risk engine."
        )

    if stats.cancelled_decisions > 0:
        parts.append(
            f"{stats.cancelled_decisions} order{'s' if stats.cancelled_decisions > 1 else ''} cancelled — "
            "discipline to not execute is as important as the discipline to execute."
        )

    return " ".join(parts) if parts else "Not enough activity for behavioral analysis this month."


def _improvement_focus(stats: MonthlyStats, dqs: float | None) -> str:
    if stats.total_decisions == 0:
        return "Stage and document your first order to start building your decision quality profile."

    if stats.documentation_rate < 0.5:
        return (
            "Focus: write a one-sentence rationale before every staged order. "
            "Even 'I believe X because Y' is enough — the habit of articulating the thesis "
            "is more valuable than the length of the text."
        )
    if stats.goal_alignment_rate < 0.3:
        return (
            "Focus: link each new order to a financial goal before staging. "
            "Forcing the question 'which goal does this serve?' is the strongest filter against reactive trading."
        )
    if stats.risk_override_count >= 2:
        return (
            "Focus: when the pre-flight engine returns 'Reconsider', pause and write your counter-argument "
            "before executing. A documented disagreement is valid; an undocumented one is just impulse."
        )
    if dqs is not None and dqs >= 70:
        return (
            "You're in good shape. Focus on consistency: apply the same discipline to every order, "
            "especially lower-value or 'obvious' trades that tempt you to skip the process."
        )
    return (
        "Focus on all three core habits: written rationale, goal linkage, pre-flight review. "
        "Each one compounds the others."
    )


def _achievements(stats: MonthlyStats, dqs: float | None, dqs_change: float | None) -> list[str]:
    items = []
    if stats.documentation_rate >= 1.0 and stats.total_decisions >= 3:
        items.append("Perfect Documentation Month — 100% of orders had written rationale")
    elif stats.documentation_rate >= 0.8:
        items.append(f"Strong Documentation — {stats.documentation_rate*100:.0f}% of orders documented")
    if stats.risk_override_count == 0 and stats.executed_decisions >= 2:
        items.append("Clean Pre-Flight Record — no reconsider overrides this month")
    if stats.goal_alignment_rate >= 0.8 and stats.total_decisions >= 3:
        items.append(f"Purpose-Driven — {stats.goal_alignment_rate*100:.0f}% of trades goal-linked")
    if dqs_change is not None and dqs_change >= 10:
        items.append(f"DQS Up {dqs_change:+.0f} — decision quality meaningfully improved")
    if stats.total_decisions >= 5:
        items.append(f"Active month — {stats.total_decisions} decisions staged")
    return items[:4]


def _watch_list(stats: MonthlyStats) -> list[str]:
    items = []
    if stats.documentation_rate < 0.4:
        items.append(f"{stats.total_decisions - stats.documented_decisions} orders without rationale — document before next execution")
    if stats.risk_override_count >= 2:
        items.append(f"{stats.risk_override_count} reconsider overrides — review outcomes carefully")
    if stats.goal_alignment_rate < 0.25 and stats.total_decisions >= 4:
        items.append("Low goal alignment — check if current trading activity serves your plan")
    return items[:3]


# ─── Main entry point ─────────────────────────────────────────────────────────

def compute_reflection_report(
    db: Session,
    investor_id: uuid.UUID,
    month: str | None = None,
) -> MonthlyReflectionReport:
    all_orders = _get_all_orders(db, investor_id)
    by_month = _group_by_month(all_orders)
    available = sorted(by_month.keys())
    now = datetime.now(timezone.utc)
    current_month = now.strftime("%Y-%m")

    target = month or current_month
    # Fallback to most recent month if target has no data
    if target not in by_month and available:
        target = available[-1]

    orders = by_month.get(target, [])
    stats = _compute_stats(orders)
    dqs = _monthly_dqs(orders)

    # Previous month
    prev_month = None
    prev_dqs = None
    if available:
        idx = available.index(target) if target in available else -1
        if idx > 0:
            prev_month = available[idx - 1]
            prev_dqs = _monthly_dqs(by_month.get(prev_month, []))

    dqs_change = round(dqs - prev_dqs, 1) if (dqs is not None and prev_dqs is not None) else None
    if prev_dqs is None and dqs is not None:
        dqs_trend = "first_month"
    elif dqs_change is None:
        dqs_trend = "no_data"
    elif dqs_change >= 5:
        dqs_trend = "improved"
    elif dqs_change <= -5:
        dqs_trend = "declined"
    else:
        dqs_trend = "stable"

    label = _month_label(target)

    return MonthlyReflectionReport(
        investor_id=investor_id,
        month=target,
        month_label=label,
        stats=stats,
        dqs_this_month=dqs,
        dqs_previous_month=prev_dqs,
        dqs_change=dqs_change,
        dqs_trend=dqs_trend,
        headline=_headline(label, stats, dqs, dqs_change),
        decision_quality_narrative=_decision_quality_narrative(stats, dqs, dqs_change),
        behavioral_narrative=_behavioral_narrative(stats),
        improvement_focus=_improvement_focus(stats, dqs),
        achievements=_achievements(stats, dqs, dqs_change),
        watch_list=_watch_list(stats),
        available_months=available,
        sufficient_data=stats.total_decisions >= 2,
        generated_at=now,
    )

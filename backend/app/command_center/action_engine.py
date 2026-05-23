from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.command_center.schemas import ActionSeverity, PrioritizedAction
from app.models.behavioral_risk_event import BehavioralRiskEvent


_STAGE_ACTION_STYLE: dict[str, str] = {
    "foundation": "plain",
    "discipline": "comparative",
    "optimization": "quantitative",
    "advanced_cognition": "institutional",
}

# Action candidate: (title, rationale, severity, impact, urgent, category, composite_score, link)
_Candidate = tuple[str, str, ActionSeverity, str, bool, str, float, str | None]


def _ef_actions(fp, ef_months: float, style: str) -> list[_Candidate]:
    if fp is None:
        return []
    actions = []
    if ef_months < 1.0:
        if style == "plain":
            title = "Build your emergency fund first"
            rationale = "You have less than 1 month of expenses saved. This is the most important financial safety step."
        else:
            title = "Emergency fund critically low"
            rationale = f"Current buffer: {ef_months:.1f} months. Target: 3+ months. Risk of forced asset liquidation during income disruption."
        actions.append((title, rationale, ActionSeverity.critical, "high", True, "safety", 100.0, "/financial"))
    elif ef_months < 3.0:
        if style == "plain":
            title = "Grow your emergency fund"
            rationale = f"You have {ef_months:.1f} months saved. Aim for at least 3 months of expenses."
        else:
            title = "Emergency fund below 3-month threshold"
            rationale = f"Buffer: {ef_months:.1f}mo vs recommended 3–6mo. Limits ability to avoid forced selling in a downturn."
        actions.append((title, rationale, ActionSeverity.high, "high", False, "safety", 80.0, "/financial"))
    return actions


def _behavioral_actions(active_risks: list[BehavioralRiskEvent], style: str) -> list[_Candidate]:
    actions = []
    for risk in active_risks:
        if risk.severity == "high":
            rec = risk.recommendation or "Review your recent trading activity."
            if style == "plain":
                title = f"Attention: {risk.event_type.replace('_', ' ').title()}"
                rationale = risk.description or rec
            else:
                title = f"Behavioral alert: {risk.event_type.replace('_', ' ')}"
                rationale = f"{risk.description or ''} {rec}".strip()
            actions.append((title, rationale, ActionSeverity.high, "high", True, "behavior", 75.0, "/behavioral-risk"))
        elif risk.severity == "medium":
            actions.append((
                f"Monitor: {risk.event_type.replace('_', ' ').title()}",
                risk.description or risk.recommendation or "",
                ActionSeverity.medium, "medium", False, "behavior", 45.0, "/behavioral-risk",
            ))
    return actions


def _concentration_actions(db: Session, investor_id: uuid.UUID, style: str) -> list[_Candidate]:
    from app.models.investment_account import InvestmentHolding
    from sqlalchemy import func

    rows = (
        db.query(InvestmentHolding.ticker, func.sum(InvestmentHolding.current_value).label("val"))
        .filter(InvestmentHolding.investor_id == investor_id)
        .group_by(InvestmentHolding.ticker)
        .all()
    )
    if not rows:
        return []
    total = sum(r.val or 0 for r in rows)
    if total <= 0:
        return []
    top = max(rows, key=lambda r: r.val or 0)
    pct = (top.val or 0) / total
    if pct > 0.40:
        if style == "plain":
            title = f"Too much in one position ({top.ticker})"
            rationale = f"{top.ticker} makes up {pct*100:.0f}% of your portfolio. Spreading risk is safer."
        else:
            title = f"Concentration risk: {top.ticker} at {pct*100:.0f}%"
            rationale = f"Single-asset weight {pct*100:.0f}% exceeds 40% threshold. Increases idiosyncratic risk and drawdown exposure."
        return [(title, rationale, ActionSeverity.high, "high", False, "portfolio", 70.0, "/investments")]
    return []


def _contribution_actions(db: Session, investor_id: uuid.UUID, style: str) -> list[_Candidate]:
    from app.models.holding_transaction import HoldingTransaction
    from datetime import datetime, timedelta, timezone

    cutoff = datetime.now(timezone.utc) - timedelta(days=45)
    recent = (
        db.query(HoldingTransaction)
        .filter(
            HoldingTransaction.investor_id == investor_id,
            HoldingTransaction.transaction_type == "buy",
            HoldingTransaction.executed_at >= cutoff,
        )
        .count()
    )
    if recent == 0:
        if style == "plain":
            title = "Resume regular contributions"
            rationale = "You haven't made any investments in over 6 weeks. Consistent investing builds long-term discipline."
        else:
            title = "Contribution gap detected (>45 days)"
            rationale = "No buy transactions in 45+ days. Contribution consistency is a weighted dimension of the maturity score."
        return [(title, rationale, ActionSeverity.medium, "medium", False, "contribution", 40.0, "/paper-trading")]
    return []


def generate_top_actions(
    db: Session,
    investor_id: uuid.UUID,
    maturity_stage: str | None,
) -> list[PrioritizedAction]:
    from app.financial_profiles.service import compute_effective_ef_months, get_by_investor

    stage = maturity_stage or "foundation"
    style = _STAGE_ACTION_STYLE.get(stage, "plain")

    candidates: list[_Candidate] = []

    fp = get_by_investor(db, investor_id)
    if fp:
        ef = compute_effective_ef_months(db, investor_id, fp)
        candidates.extend(_ef_actions(fp, ef, style))

    active_risks = (
        db.query(BehavioralRiskEvent)
        .filter(
            BehavioralRiskEvent.investor_id == investor_id,
            BehavioralRiskEvent.status == "active",
        )
        .order_by(BehavioralRiskEvent.detected_at.desc())
        .limit(5)
        .all()
    )
    candidates.extend(_behavioral_actions(active_risks, style))
    candidates.extend(_concentration_actions(db, investor_id, style))
    candidates.extend(_contribution_actions(db, investor_id, style))

    # Deduplicate by category (keep highest-score per category)
    seen: dict[str, _Candidate] = {}
    for c in sorted(candidates, key=lambda x: x[6], reverse=True):
        if c[5] not in seen:
            seen[c[5]] = c

    top3 = sorted(seen.values(), key=lambda x: x[6], reverse=True)[:3]

    return [
        PrioritizedAction(
            title=c[0], rationale=c[1], severity=c[2],
            impact=c[3], urgent=c[4], category=c[5], link=c[7],
        )
        for c in top3
    ]

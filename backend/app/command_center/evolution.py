from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.command_center.schemas import EvolutionItem
from app.models.behavioral_risk_event import BehavioralRiskEvent
from app.models.financial_twin_snapshot import FinancialTwinSnapshot
from app.models.investor_maturity_snapshot import InvestorMaturitySnapshot

_THRESHOLD = 1.0   # minimum delta to surface an item


def _direction(delta: float) -> str:
    if delta > _THRESHOLD:
        return "up"
    if delta < -_THRESHOLD:
        return "down"
    return "flat"


def _severity(metric: str, delta: float) -> str:
    positive_metrics = {
        "twin_overall_score", "maturity_composite_score",
        "financial_stability", "behavioral_discipline",
        "financial_resilience", "contribution_momentum",
        "risk_alignment", "long_term_discipline",
    }
    negative_metrics = {"emotional_risk"}
    if metric in positive_metrics:
        return "positive" if delta > _THRESHOLD else ("negative" if delta < -_THRESHOLD else "neutral")
    if metric in negative_metrics:
        # lower emotional_risk is better
        return "positive" if delta < -_THRESHOLD else ("negative" if delta > _THRESHOLD else "neutral")
    return "neutral"


def _fmt_delta(delta: float, is_pct: bool = False) -> str:
    sign = "+" if delta >= 0 else ""
    if is_pct:
        return f"{sign}{delta:.1f}%"
    return f"{sign}{delta:.1f} pts"


def generate_evolution_feed(db: Session, investor_id: uuid.UUID) -> list[EvolutionItem]:
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=8)  # slight buffer

    items: list[EvolutionItem] = []

    # ── Twin snapshot deltas ─────────────────────────────────────────────────
    twin_current = (
        db.query(FinancialTwinSnapshot)
        .filter(FinancialTwinSnapshot.investor_id == investor_id)
        .order_by(FinancialTwinSnapshot.computed_at.desc())
        .first()
    )
    twin_prev = (
        db.query(FinancialTwinSnapshot)
        .filter(
            FinancialTwinSnapshot.investor_id == investor_id,
            FinancialTwinSnapshot.computed_at <= week_ago,
        )
        .order_by(FinancialTwinSnapshot.computed_at.desc())
        .first()
    )

    if twin_current and twin_prev:
        twin_metrics = [
            ("twin_overall_score", "Financial Twin Score", twin_current.overall_score, twin_prev.overall_score),
            ("financial_stability", "Financial Stability", twin_current.financial_stability, twin_prev.financial_stability),
            ("behavioral_discipline", "Behavioral Discipline", twin_current.behavioral_discipline, twin_prev.behavioral_discipline),
            ("emotional_risk", "Emotional Risk Control", twin_current.emotional_risk, twin_prev.emotional_risk),
            ("financial_resilience", "Financial Resilience", twin_current.financial_resilience, twin_prev.financial_resilience),
            ("contribution_momentum", "Contribution Momentum", twin_current.contribution_momentum, twin_prev.contribution_momentum),
        ]
        for metric, label, curr, prev in twin_metrics:
            if curr is None or prev is None:
                continue
            delta = curr - prev
            if abs(delta) < _THRESHOLD:
                continue
            direction = _direction(delta)
            # emotional_risk: higher is worse, so flip direction label
            if metric == "emotional_risk":
                direction = "down" if delta > _THRESHOLD else ("up" if delta < -_THRESHOLD else "flat")
            items.append(EvolutionItem(
                metric=metric,
                label=label,
                direction=direction,
                from_value=round(prev, 1),
                to_value=round(curr, 1),
                delta_display=_fmt_delta(delta),
                cause=None,
                item_severity=_severity(metric, delta),
            ))

    # ── Maturity snapshot deltas ─────────────────────────────────────────────
    mat_current = (
        db.query(InvestorMaturitySnapshot)
        .filter(InvestorMaturitySnapshot.investor_id == investor_id)
        .order_by(InvestorMaturitySnapshot.computed_at.desc())
        .first()
    )
    mat_prev = (
        db.query(InvestorMaturitySnapshot)
        .filter(
            InvestorMaturitySnapshot.investor_id == investor_id,
            InvestorMaturitySnapshot.computed_at <= week_ago,
        )
        .order_by(InvestorMaturitySnapshot.computed_at.desc())
        .first()
    )

    if mat_current and mat_prev:
        delta = mat_current.composite_score - mat_prev.composite_score
        if abs(delta) >= _THRESHOLD:
            items.append(EvolutionItem(
                metric="maturity_composite_score",
                label="Maturity Score",
                direction=_direction(delta),
                from_value=round(mat_prev.composite_score, 1),
                to_value=round(mat_current.composite_score, 1),
                delta_display=_fmt_delta(delta),
                cause="Based on savings consistency, behavioral discipline and portfolio complexity." if abs(delta) >= 3 else None,
                item_severity="positive" if delta > 0 else "negative",
            ))

    # ── New behavioral risk events this week ─────────────────────────────────
    new_risks = (
        db.query(BehavioralRiskEvent)
        .filter(
            BehavioralRiskEvent.investor_id == investor_id,
            BehavioralRiskEvent.detected_at >= week_ago,
        )
        .order_by(BehavioralRiskEvent.detected_at.desc())
        .limit(3)
        .all()
    )
    for risk in new_risks:
        items.append(EvolutionItem(
            metric=f"behavioral_risk_{risk.event_type}",
            label=f"Behavioral warning: {risk.event_type.replace('_', ' ').title()}",
            direction="down",
            from_value=None,
            to_value=None,
            delta_display="New alert",
            cause=risk.description,
            item_severity="negative",
        ))

    # ── Resolved behavioral risks this week ──────────────────────────────────
    resolved_risks = (
        db.query(BehavioralRiskEvent)
        .filter(
            BehavioralRiskEvent.investor_id == investor_id,
            BehavioralRiskEvent.status == "resolved",
            BehavioralRiskEvent.detected_at >= week_ago,
        )
        .limit(2)
        .all()
    )
    for risk in resolved_risks:
        items.append(EvolutionItem(
            metric=f"resolved_{risk.event_type}",
            label=f"Resolved: {risk.event_type.replace('_', ' ').title()}",
            direction="up",
            from_value=None,
            to_value=None,
            delta_display="Resolved",
            cause=None,
            item_severity="positive",
        ))

    # Sort: negatives first (most urgent), then positives
    def _sort_key(item: EvolutionItem) -> tuple:
        order = {"negative": 0, "neutral": 1, "positive": 2}
        return (order.get(item.item_severity, 1),)

    items.sort(key=_sort_key)
    return items[:8]

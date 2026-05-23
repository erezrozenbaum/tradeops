from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.command_center.schemas import ReplayHighlight
from app.models.simulation_run import SimulationRun

_COUNTERFACTUAL_TYPES = {
    "counterfactual_rebalance",
    "counterfactual_constraint",
    "counterfactual_hold",
}

_INSIGHT_TEMPLATES: dict[str, str] = {
    "counterfactual_rebalance": "If the recommended rebalance had been followed, portfolio volatility and risk-adjusted value would likely differ by {delta_pct:.1f}%.",
    "counterfactual_constraint": "If the allocation constraint had been enforced from the first violation, the estimated portfolio impact is {delta_pct:.1f}%.",
    "counterfactual_hold": "If the panic-sell had been avoided, the estimated forgone portfolio gain is {delta_pct:.1f}%.",
}


def select_best_replay(db: Session, investor_id: uuid.UUID) -> ReplayHighlight | None:
    runs = (
        db.query(SimulationRun)
        .filter(
            SimulationRun.investor_id == investor_id,
            SimulationRun.scenario_type.in_(_COUNTERFACTUAL_TYPES),
            SimulationRun.status == "completed",
        )
        .order_by(SimulationRun.computed_at.desc())
        .limit(10)
        .all()
    )
    if not runs:
        return None

    best: SimulationRun | None = None
    best_delta_abs = 0.0

    for run in runs:
        results = run.results or {}
        delta = results.get("delta")
        if delta is None:
            continue
        if abs(delta) > best_delta_abs:
            best_delta_abs = abs(delta)
            best = run

    if not best:
        return None

    results = best.results or {}
    delta = results.get("delta", 0.0)
    delta_pct = results.get("delta_pct", 0.0)
    reference_date = results.get("reference_date")

    template = _INSIGHT_TEMPLATES.get(best.scenario_type, "This replay shows a {delta_pct:.1f}% estimated impact.")
    insight_text = template.format(delta_pct=abs(delta_pct))

    return ReplayHighlight(
        scenario_type=best.scenario_type,
        insight_text=insight_text,
        delta=delta,
        delta_pct=delta_pct,
        reference_date=str(reference_date) if reference_date else None,
    )

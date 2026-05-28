import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.goals_analysis import service
from app.goals_analysis.schemas import GoalsAnalysisResult

router = APIRouter()


@router.get("", response_model=GoalsAnalysisResult)
def get_goals_analysis(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    result = service.get_analysis(db, investor_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Investor not found")
    return result


# ── Goal type → suggested asset type mapping ─────────────────────────────────
_GOAL_ASSET_MAP: dict[str, str] = {
    "emergency_fund": "fund",
    "house_purchase": "bond",
    "retirement": "etf",
    "child_education": "etf",
    "wealth_growth": "stock",
    "passive_income": "etf",
    "debt_reduction": "bond",
    "custom": "etf",
}


@router.get("/action-plan")
def get_goal_action_plan(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    """Monthly action plan: per-goal recommended buy order to stay on track."""
    result = service.get_analysis(db, investor_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Investor not found")

    monthly_surplus = result.monthly_surplus or 0.0
    total_needed = result.total_monthly_contribution_needed or 0.0

    actions = []
    for ga in result.goals:
        if ga.status in ("complete", "needs_log"):
            continue
        if ga.monthly_contribution_needed is None or ga.monthly_contribution_needed <= 0:
            continue
        if ga.tracking_mode == "debt_reduction":
            priority = "high" if ga.status == "at_risk" else "medium"
            message = f"Pay {ga.currency} {ga.monthly_contribution_needed:,.0f}/mo toward this debt"
            asset_type = None
        else:
            priority = "high" if ga.status == "at_risk" else ("medium" if not ga.on_track else "low")
            gap = ga.gap or 0.0
            if gap > 0:
                message = f"Increase to {ga.currency} {ga.monthly_contribution_needed:,.0f}/mo — you're {ga.currency} {gap:,.0f} short"
            else:
                message = f"Stage {ga.currency} {ga.monthly_contribution_needed:,.0f}/mo to stay on track"
            asset_type = _GOAL_ASSET_MAP.get(ga.goal_type, "etf")

        actions.append({
            "goal_id": str(ga.id),
            "goal_name": ga.name,
            "goal_type": ga.goal_type,
            "status": ga.status,
            "progress_pct": ga.progress_pct,
            "monthly_needed": ga.monthly_contribution_needed,
            "gap": ga.gap or 0.0,
            "currency": ga.currency,
            "suggested_asset_type": asset_type,
            "priority": priority,
            "message": message,
            "on_track": ga.on_track,
        })

    # Sort: high priority first, then at_risk, then by monthly_needed desc
    priority_order = {"high": 0, "medium": 1, "low": 2}
    actions.sort(key=lambda a: (priority_order.get(a["priority"], 3), -a["monthly_needed"]))

    return {
        "monthly_surplus": monthly_surplus,
        "total_needed": total_needed,
        "surplus_remaining": max(monthly_surplus - total_needed, 0.0),
        "actions": actions,
    }

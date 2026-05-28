import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.goals import service as goals_service
from app.goals import progress_service
from app.schemas.goal_progress_log import GoalProgressLogCreate, GoalProgressLogOut

router = APIRouter()


def _get_goal_or_404(db: Session, investor_id: uuid.UUID, goal_id: uuid.UUID):
    goal = goals_service.get(db, goal_id)
    if not goal or goal.investor_profile_id != investor_id:
        raise HTTPException(status_code=404, detail="Goal not found")
    return goal


@router.post(
    "/{goal_id}/progress",
    response_model=GoalProgressLogOut,
    status_code=status.HTTP_200_OK,
)
def log_progress(
    investor_id: uuid.UUID,
    goal_id: uuid.UUID,
    data: GoalProgressLogCreate,
    db: Session = Depends(get_db),
):
    _get_goal_or_404(db, investor_id, goal_id)
    return progress_service.upsert(db, goal_id, data)


@router.get("/{goal_id}/progress", response_model=list[GoalProgressLogOut])
def get_progress(
    investor_id: uuid.UUID,
    goal_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    _get_goal_or_404(db, investor_id, goal_id)
    return progress_service.get_by_goal(db, goal_id)


@router.get("/{goal_id}/progress-timeline")
def get_progress_timeline(
    investor_id: uuid.UUID,
    goal_id: uuid.UUID,
    months: int = 12,
    db: Session = Depends(get_db),
):
    """Return last N months of goal progress, filling missing months with zeros."""
    goal = _get_goal_or_404(db, investor_id, goal_id)
    logs = progress_service.get_by_goal(db, goal_id)
    log_map = {(l.period_year, l.period_month): l for l in logs}

    today = date.today()
    timeline = []
    for i in range(months - 1, -1, -1):
        month = (today.month - i - 1) % 12 + 1
        year = today.year - ((i - today.month + 1) // 12 + (1 if (today.month - i - 1) < 0 else 0))
        entry = log_map.get((year, month))
        timeline.append({
            "year": year,
            "month": month,
            "label": f"{year}-{month:02d}",
            "planned": entry.planned_amount if entry else 0.0,
            "actual": entry.actual_amount if entry else 0.0,
        })

    from app.goals_analysis import service as analysis_svc
    analysis = analysis_svc.get_analysis(db, investor_id)
    monthly_needed = None
    if analysis:
        ga = next((g for g in analysis.goals if str(g.id) == str(goal_id)), None)
        if ga:
            monthly_needed = ga.monthly_contribution_needed

    return {
        "goal_id": str(goal_id),
        "goal_name": goal.name,
        "currency": goal.currency,
        "monthly_contribution_needed": monthly_needed,
        "timeline": timeline,
    }

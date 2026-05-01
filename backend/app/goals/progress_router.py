import uuid

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

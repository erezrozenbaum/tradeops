import uuid

from sqlalchemy.orm import Session

from app.models.goal_progress_log import GoalProgressLog
from app.schemas.goal_progress_log import GoalProgressLogCreate


def upsert(
    db: Session, goal_id: uuid.UUID, data: GoalProgressLogCreate
) -> GoalProgressLog:
    """Insert or update a progress log for (goal_id, year, month)."""
    existing = (
        db.query(GoalProgressLog)
        .filter(
            GoalProgressLog.goal_id == goal_id,
            GoalProgressLog.period_year == data.period_year,
            GoalProgressLog.period_month == data.period_month,
        )
        .first()
    )
    if existing:
        existing.planned_amount = data.planned_amount
        existing.actual_amount = data.actual_amount
        existing.notes = data.notes
        db.commit()
        db.refresh(existing)
        return existing

    log = GoalProgressLog(
        id=uuid.uuid4(),
        goal_id=goal_id,
        period_year=data.period_year,
        period_month=data.period_month,
        planned_amount=data.planned_amount,
        actual_amount=data.actual_amount,
        notes=data.notes,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def get_by_goal(db: Session, goal_id: uuid.UUID) -> list[GoalProgressLog]:
    return (
        db.query(GoalProgressLog)
        .filter(GoalProgressLog.goal_id == goal_id)
        .order_by(GoalProgressLog.period_year, GoalProgressLog.period_month)
        .all()
    )

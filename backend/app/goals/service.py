import uuid

from sqlalchemy.orm import Session

from app.models.financial_goal import FinancialGoal
from app.models.investor_profile import InvestorProfile
from app.schemas.financial_goal import FinancialGoalCreate, FinancialGoalUpdate
from app.audit import service as audit


def get(db: Session, goal_id: uuid.UUID) -> FinancialGoal | None:
    return db.get(FinancialGoal, goal_id)


def get_by_investor(db: Session, investor_id: uuid.UUID) -> list[FinancialGoal]:
    return (
        db.query(FinancialGoal)
        .filter(FinancialGoal.investor_profile_id == investor_id)
        .order_by(FinancialGoal.priority)
        .all()
    )


def create(
    db: Session, investor_id: uuid.UUID, data: FinancialGoalCreate
) -> FinancialGoal | None:
    if not db.get(InvestorProfile, investor_id):
        return None
    goal = FinancialGoal(investor_profile_id=investor_id, **data.model_dump())
    db.add(goal)
    db.flush()
    audit.log_event(
        db,
        event_type="financial_goal.created",
        description=f"Goal '{goal.name}' created",
        investor_profile_id=investor_id,
        metadata={"goal_id": str(goal.id), "goal_type": goal.goal_type},
    )
    db.commit()
    db.refresh(goal)
    return goal


def update(
    db: Session, investor_id: uuid.UUID, goal_id: uuid.UUID, data: FinancialGoalUpdate
) -> FinancialGoal | None:
    goal = get(db, goal_id)
    if not goal or goal.investor_profile_id != investor_id:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(goal, field, value)
    db.flush()
    audit.log_event(
        db,
        event_type="financial_goal.updated",
        description=f"Goal '{goal.name}' updated",
        investor_profile_id=investor_id,
        metadata=data.model_dump(exclude_none=True),
    )
    db.commit()
    db.refresh(goal)
    return goal


def delete(db: Session, investor_id: uuid.UUID, goal_id: uuid.UUID) -> bool:
    goal = get(db, goal_id)
    if not goal or goal.investor_profile_id != investor_id:
        return False
    audit.log_event(
        db,
        event_type="financial_goal.deleted",
        description=f"Goal '{goal.name}' deleted",
        investor_profile_id=investor_id,
        metadata={"goal_id": str(goal_id)},
    )
    db.delete(goal)
    db.commit()
    return True

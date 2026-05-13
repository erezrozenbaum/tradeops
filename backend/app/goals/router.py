import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.goals import service
from app.schemas.financial_goal import FinancialGoalCreate, FinancialGoalOut, FinancialGoalUpdate

router = APIRouter()


def _enrich(goal, db: Session) -> FinancialGoalOut:
    """Resolve linked_account_name for the response."""
    out = FinancialGoalOut.model_validate(goal)
    if goal.linked_account_id:
        from app.models.investment_account import InvestmentAccount
        acc = db.get(InvestmentAccount, goal.linked_account_id)
        if acc:
            out.linked_account_name = acc.account_name or acc.provider_name
    return out


@router.post("", response_model=FinancialGoalOut, status_code=status.HTTP_201_CREATED)
def create_goal(
    investor_id: uuid.UUID, data: FinancialGoalCreate, db: Session = Depends(get_db)
):
    goal = service.create(db, investor_id, data)
    if not goal:
        raise HTTPException(status_code=404, detail="Investor profile not found")
    return _enrich(goal, db)


@router.get("", response_model=list[FinancialGoalOut])
def list_goals(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    goals = service.get_by_investor(db, investor_id)
    return [_enrich(g, db) for g in goals]


@router.get("/{goal_id}", response_model=FinancialGoalOut)
def get_goal(investor_id: uuid.UUID, goal_id: uuid.UUID, db: Session = Depends(get_db)):
    goal = service.get(db, goal_id)
    if not goal or goal.investor_profile_id != investor_id:
        raise HTTPException(status_code=404, detail="Goal not found")
    return _enrich(goal, db)


@router.put("/{goal_id}", response_model=FinancialGoalOut)
def update_goal(
    investor_id: uuid.UUID,
    goal_id: uuid.UUID,
    data: FinancialGoalUpdate,
    db: Session = Depends(get_db),
):
    goal = service.update(db, investor_id, goal_id, data)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    return _enrich(goal, db)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(
    investor_id: uuid.UUID, goal_id: uuid.UUID, db: Session = Depends(get_db)
):
    if not service.delete(db, investor_id, goal_id):
        raise HTTPException(status_code=404, detail="Goal not found")

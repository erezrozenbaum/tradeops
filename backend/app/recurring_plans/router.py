import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.recurring_plans import service
from app.recurring_plans.schemas import RecurringPlanCreate, RecurringPlanOut, RecurringPlanUpdate

router = APIRouter()


def _plan_out(plan) -> RecurringPlanOut:
    total = sum(float(a.get("amount", 0)) for a in (plan.allocations or []))
    return RecurringPlanOut(
        id=plan.id,
        investor_id=plan.investor_id,
        name=plan.name,
        frequency=plan.frequency,
        day_of_month=plan.day_of_month,
        allocations=plan.allocations or [],
        is_active=plan.is_active,
        next_run_at=plan.next_run_at,
        last_run_at=plan.last_run_at,
        created_at=plan.created_at,
        total_monthly_amount=total,
    )


@router.get("", response_model=list[RecurringPlanOut])
def list_plans(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    return [_plan_out(p) for p in service.list_plans(db, investor_id)]


@router.post("", response_model=RecurringPlanOut, status_code=status.HTTP_201_CREATED)
def create_plan(investor_id: uuid.UUID, body: RecurringPlanCreate, db: Session = Depends(get_db)):
    if not body.allocations:
        raise HTTPException(status_code=422, detail="At least one allocation is required")
    plan = service.create_plan(db, investor_id, body)
    return _plan_out(plan)


@router.put("/{plan_id}", response_model=RecurringPlanOut)
def update_plan(investor_id: uuid.UUID, plan_id: uuid.UUID, body: RecurringPlanUpdate, db: Session = Depends(get_db)):
    plan = service.get_plan(db, plan_id)
    if not plan or plan.investor_id != investor_id:
        raise HTTPException(status_code=404, detail="Plan not found")
    return _plan_out(service.update_plan(db, plan, body))


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plan(investor_id: uuid.UUID, plan_id: uuid.UUID, db: Session = Depends(get_db)):
    plan = service.get_plan(db, plan_id)
    if not plan or plan.investor_id != investor_id:
        raise HTTPException(status_code=404, detail="Plan not found")
    service.delete_plan(db, plan)


@router.post("/{plan_id}/run-now", response_model=dict)
def run_now(investor_id: uuid.UUID, plan_id: uuid.UUID, db: Session = Depends(get_db)):
    plan = service.get_plan(db, plan_id)
    if not plan or plan.investor_id != investor_id:
        raise HTTPException(status_code=404, detail="Plan not found")
    count = service.run_plan(db, plan)
    return {"staged": count, "message": f"Staged {count} order(s) from plan '{plan.name}'"}

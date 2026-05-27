"""Recurring Investment Plan service — CRUD + execution."""
import uuid
from calendar import monthrange
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.recurring_plan import RecurringPlan
from app.recurring_plans.schemas import RecurringPlanCreate, RecurringPlanUpdate


def list_plans(db: Session, investor_id: uuid.UUID) -> list[RecurringPlan]:
    return (
        db.query(RecurringPlan)
        .filter(RecurringPlan.investor_id == investor_id)
        .order_by(RecurringPlan.created_at.desc())
        .all()
    )


def get_plan(db: Session, plan_id: uuid.UUID) -> RecurringPlan | None:
    return db.get(RecurringPlan, plan_id)


def create_plan(db: Session, investor_id: uuid.UUID, body: RecurringPlanCreate) -> RecurringPlan:
    plan = RecurringPlan(
        investor_id=investor_id,
        name=body.name,
        frequency=body.frequency,
        day_of_month=body.day_of_month,
        allocations=[a.model_dump(mode="json") for a in body.allocations],
        is_active=body.is_active,
        next_run_at=_compute_next_run(body.frequency, body.day_of_month) if body.is_active else None,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


def update_plan(db: Session, plan: RecurringPlan, body: RecurringPlanUpdate) -> RecurringPlan:
    if body.name is not None:
        plan.name = body.name
    if body.frequency is not None:
        plan.frequency = body.frequency
    if body.day_of_month is not None:
        plan.day_of_month = body.day_of_month
    if body.allocations is not None:
        plan.allocations = [a.model_dump(mode="json") for a in body.allocations]
    if body.is_active is not None:
        plan.is_active = body.is_active
        if body.is_active and plan.next_run_at is None:
            plan.next_run_at = _compute_next_run(plan.frequency, plan.day_of_month)
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


def delete_plan(db: Session, plan: RecurringPlan) -> None:
    db.delete(plan)
    db.commit()


def run_plan(db: Session, plan: RecurringPlan) -> int:
    """Stage all allocations in the plan as new StagedOrders. Returns count staged."""
    from app.models.staged_order import StagedOrder
    from app.audit.service import log_event

    staged = 0
    now = datetime.now(timezone.utc)

    for alloc in plan.allocations:
        order = StagedOrder(
            investor_id=plan.investor_id,
            ticker=alloc.get("ticker"),
            name=alloc.get("name", "Unnamed"),
            action="buy",
            quantity=1.0,
            unit_price=alloc.get("amount", 0.0),
            currency=alloc.get("currency", "USD"),
            estimated_value=alloc.get("amount", 0.0),
            asset_type=alloc.get("asset_type"),
            status="pending",
            goal_id=alloc.get("goal_id"),
            notes=f"Auto-staged by Recurring Plan: {plan.name}",
        )
        db.add(order)
        staged += 1

    plan.last_run_at = now
    plan.next_run_at = _compute_next_run(plan.frequency, plan.day_of_month)
    db.add(plan)

    try:
        log_event(
            db,
            investor_id=plan.investor_id,
            event_type="recurring_plan_executed",
            description=f"Recurring plan '{plan.name}' staged {staged} order(s)",
            metadata={"plan_id": str(plan.id), "staged_count": staged},
        )
    except Exception:
        pass

    db.commit()
    return staged


def _compute_next_run(frequency: str, day_of_month: int | None) -> datetime:
    now = datetime.now(timezone.utc)
    day = day_of_month or 1

    if frequency == "weekly":
        return now + timedelta(days=7)

    # Monthly: next occurrence of day_of_month
    year, month = now.year, now.month
    max_day = monthrange(year, month)[1]
    target_day = min(day, max_day)
    candidate = now.replace(day=target_day, hour=6, minute=30, second=0, microsecond=0)
    if candidate <= now:
        # Advance to next month
        if month == 12:
            year += 1
            month = 1
        else:
            month += 1
        max_day = monthrange(year, month)[1]
        target_day = min(day, max_day)
        candidate = candidate.replace(year=year, month=month, day=target_day)
    return candidate

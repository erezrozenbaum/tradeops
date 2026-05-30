import uuid
from datetime import datetime
from pydantic import BaseModel


class PlanAllocation(BaseModel):
    ticker: str | None = None
    name: str
    asset_type: str = "stock"
    amount: float
    currency: str = "USD"
    goal_id: uuid.UUID | None = None
    trigger_on_alert: bool = False


class RecurringPlanCreate(BaseModel):
    name: str
    frequency: str = "monthly"  # monthly | weekly
    day_of_month: int = 1  # 1-28 for monthly; ignored for weekly
    allocations: list[PlanAllocation]
    is_active: bool = True


class RecurringPlanUpdate(BaseModel):
    name: str | None = None
    frequency: str | None = None
    day_of_month: int | None = None
    allocations: list[PlanAllocation] | None = None
    is_active: bool | None = None


class RecurringPlanOut(BaseModel):
    id: uuid.UUID
    investor_id: uuid.UUID
    name: str
    frequency: str
    day_of_month: int | None
    allocations: list[PlanAllocation]
    is_active: bool
    next_run_at: datetime | None
    last_run_at: datetime | None
    created_at: datetime
    total_monthly_amount: float

    class Config:
        from_attributes = True

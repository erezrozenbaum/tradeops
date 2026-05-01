import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class GoalProgressLogCreate(BaseModel):
    period_year: int = Field(..., ge=2000, le=2100)
    period_month: int = Field(..., ge=1, le=12)
    planned_amount: float = Field(..., ge=0)
    actual_amount: float = Field(..., ge=0)
    notes: str | None = None


class GoalProgressLogOut(GoalProgressLogCreate):
    id: uuid.UUID
    goal_id: uuid.UUID
    created_at: datetime
    model_config = {"from_attributes": True}

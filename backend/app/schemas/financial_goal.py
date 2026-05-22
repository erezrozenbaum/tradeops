import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.financial_goal import GoalRiskSuitability, GoalType

TRACKING_MODES = {
    "target_by_date",
    "monthly_contribution",
    "monthly_passive_income",
    "balance_threshold",
    "debt_reduction",
}


class FinancialGoalCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    goal_type: GoalType
    target_amount: float = Field(..., gt=0)
    current_amount: float = Field(0.0, ge=0)
    target_date: date | None = None
    priority: int = Field(1, ge=1, le=10)
    currency: str = Field(..., min_length=3, max_length=3)
    risk_suitability: GoalRiskSuitability = GoalRiskSuitability.low
    tracking_mode: str = Field("target_by_date")
    mode_config: dict | None = None
    linked_account_id: uuid.UUID | None = None


class FinancialGoalUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    target_amount: float | None = Field(None, gt=0)
    current_amount: float | None = Field(None, ge=0)
    target_date: date | None = None
    priority: int | None = Field(None, ge=1, le=10)
    risk_suitability: GoalRiskSuitability | None = None
    tracking_mode: str | None = None
    mode_config: dict | None = None
    linked_account_id: uuid.UUID | None = None


class FinancialGoalOut(FinancialGoalCreate):
    id: uuid.UUID
    investor_profile_id: uuid.UUID
    progress_pct: float
    linked_account_name: str | None = None  # resolved at API layer, not from DB column
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}

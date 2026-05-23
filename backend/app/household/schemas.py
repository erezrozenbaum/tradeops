import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class HouseholdCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class HouseholdOut(BaseModel):
    id: uuid.UUID
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class HouseholdMemberCard(BaseModel):
    investor_id: uuid.UUID
    full_name: str
    maturity_stage: str
    twin_overall_score: float | None
    stability_score: float | None
    stability_classification: str | None
    is_self: bool


class HouseholdSummary(BaseModel):
    household: HouseholdOut
    members: list[HouseholdMemberCard]
    member_count: int


class HouseholdAggregateMetrics(BaseModel):
    combined_net_worth: float
    combined_portfolio_value: float
    combined_monthly_surplus: float
    total_active_behavioral_risks: int
    member_count: int
    currency: str

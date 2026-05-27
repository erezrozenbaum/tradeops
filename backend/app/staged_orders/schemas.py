import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class PreFlightReason(BaseModel):
    label: str
    detail: str


class PreFlightReview(BaseModel):
    reasons_to_proceed: list[PreFlightReason]
    risks: list[PreFlightReason]
    alternative: str | None = None
    verdict: str  # "proceed" | "caution" | "reconsider"


class ProjectedMetrics(BaseModel):
    portfolio_value_base: float | None = None
    low_risk_pct: float | None = None
    growth_pct: float | None = None
    high_risk_pct: float | None = None
    goal_progress_pct: float | None = None
    goal_name: str | None = None


class StagedOrderCreate(BaseModel):
    ticker: str | None = None
    name: str
    action: str = Field(..., pattern="^(buy|sell)$")
    quantity: float = Field(..., gt=0)
    unit_price: float = Field(..., gt=0)
    currency: str
    asset_type: str | None = None
    goal_id: uuid.UUID | None = None
    notes: str | None = None


class StagedOrderOut(BaseModel):
    id: uuid.UUID
    investor_id: uuid.UUID
    ticker: str | None
    name: str
    action: str
    quantity: float
    unit_price: float
    currency: str
    estimated_value: float
    asset_type: str | None
    status: str
    goal_id: uuid.UUID | None
    goal_name: str | None
    tax_note: str | None
    pre_flight_review: dict | None
    projected_metrics: dict | None
    executed_at: datetime | None
    actual_outcome: dict | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class StagedOrderList(BaseModel):
    investor_id: uuid.UUID
    pending_count: int
    executed_count: int
    cancelled_count: int
    orders: list[StagedOrderOut]


class GenerateRebalanceRequest(BaseModel):
    pass  # uses investor's live portfolio + risk model — no input needed


class GenerateRebalanceResult(BaseModel):
    investor_id: uuid.UUID
    orders_generated: int
    total_buy_value: float
    total_sell_value: float
    net_value: float
    currency: str
    orders: list[StagedOrderOut]
    notes: list[str]

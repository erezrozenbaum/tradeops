import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class PreFlightReason(BaseModel):
    label: str
    detail: str


class BehavioralIndicator(BaseModel):
    kappa_score: float | None = None
    confidence_tier: str  # INSUFFICIENT_DATA | HIGH_ALPHA | STANDARD | CAUTION_IMPULSE | HIGH_RISK_OVERRIDE
    suggested_action: str  # NO_ACTION | CONSIDER_REDUCING_SIZE | RECOMMEND_PAPER_TRADING
    rationale: str


class DiversificationIndicator(BaseModel):
    status: str  # SUCCESS | INSUFFICIENT_DATA | ISOLATED_ASSET | SKIPPED
    avg_correlation: float | None = None
    risk_tier: str  # HIGH_OVERLAP | MODERATE_OVERLAP | HIGHLY_DIVERSIFIED | LOW | UNKNOWN
    individual_breakdown: dict[str, float]
    insight: str


class PreFlightReview(BaseModel):
    reasons_to_proceed: list[PreFlightReason]
    risks: list[PreFlightReason]
    alternative: str | None = None
    verdict: str  # "proceed" | "caution" | "reconsider"
    behavioral: BehavioralIndicator | None = None
    diversification: DiversificationIndicator | None = None


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
    rationale: str | None = None


class RationaleUpdate(BaseModel):
    rationale: str = Field(..., min_length=1, max_length=2000)


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
    rationale: str | None
    reflection: dict | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class JournalEntryOut(BaseModel):
    id: uuid.UUID
    ticker: str | None
    name: str
    action: str
    quantity: float
    unit_price: float
    currency: str
    estimated_value: float
    asset_type: str | None
    status: str
    goal_name: str | None
    pre_flight_verdict: str | None
    rationale: str | None
    reflection: dict | None
    executed_at: datetime | None
    created_at: datetime


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


# ── Template schemas ───────────────────────────────────────────────────────────

class TemplateSaveRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = None
    order_ids: list[uuid.UUID] = Field(..., min_length=1)


class TemplateOrderItem(BaseModel):
    ticker: str | None = None
    name: str
    action: str
    quantity: float
    unit_price: float
    currency: str
    asset_type: str | None = None


class OrderTemplateOut(BaseModel):
    id: uuid.UUID
    investor_id: uuid.UUID
    name: str
    description: str | None
    orders: list[dict]
    times_applied: int
    last_applied_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TemplateApplyResult(BaseModel):
    template_id: uuid.UUID
    orders_created: int
    orders: list[StagedOrderOut]


# ── Outcome snapshot schema ────────────────────────────────────────────────────

class OutcomeSnapshot(BaseModel):
    days: int
    snapshot_at: str
    portfolio_value: float | None = None
    low_risk_pct: float | None = None
    growth_pct: float | None = None
    high_risk_pct: float | None = None


class OutcomeComparisonOut(BaseModel):
    order_id: uuid.UUID
    ticker: str | None
    name: str
    action: str
    estimated_value: float
    currency: str
    executed_at: str | None
    projected: dict | None
    snapshots: list[OutcomeSnapshot]


# ── Outcome Calibration schemas ───────────────────────────────────────────────

class CalibrationMilestone(BaseModel):
    days: int
    order_count: int
    avg_projected_low_risk: float | None = None
    avg_actual_low_risk: float | None = None
    avg_projected_growth: float | None = None
    avg_actual_growth: float | None = None
    avg_projected_high_risk: float | None = None
    avg_actual_high_risk: float | None = None
    avg_accuracy_score: float | None = None


class CalibrationOrderRow(BaseModel):
    order_id: uuid.UUID
    ticker: str | None
    name: str
    action: str
    executed_at: str | None
    milestone_days: int
    proj_low_risk: float | None = None
    act_low_risk: float | None = None
    proj_growth: float | None = None
    act_growth: float | None = None
    proj_high_risk: float | None = None
    act_high_risk: float | None = None
    accuracy_score: float | None = None


class CalibrationOut(BaseModel):
    investor_id: uuid.UUID
    milestones: list[CalibrationMilestone]
    orders: list[CalibrationOrderRow]
    has_data: bool
    generated_at: str


# ── Smart Allocation Assistant schemas ────────────────────────────────────────

class SmartSuggestion(BaseModel):
    action: str
    asset_type: str
    ticker: str | None = None
    name: str
    rationale: str
    estimated_value: float
    currency: str
    priority: str  # "high" | "medium" | "low"
    goal_name: str | None = None
    tax_note: str | None = None


class SmartSuggestResult(BaseModel):
    suggestions: list[SmartSuggestion]
    narrative: str
    generated_at: str
    has_data: bool = True

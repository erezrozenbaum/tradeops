import uuid
from datetime import date, datetime

from pydantic import BaseModel

from app.pattern_detector import DetectedPattern


class OverrideOrderOut(BaseModel):
    id: uuid.UUID
    ticker: str | None
    name: str | None
    action: str
    quantity: float | None
    unit_price: float | None
    currency: str
    rationale: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class WindowMetrics(BaseModel):
    dqs: float | None
    doc_rate_pct: float | None
    risk_overrides: int
    behavioral_alpha_pct: float | None
    order_count: int


class MetricDelta(BaseModel):
    key: str
    title: str
    previous: float | None
    current: float | None
    delta: float | None
    direction: str  # "improving" | "declining" | "stable" | "insufficient_data"
    unit: str  # "points" | "%" | "count"


class InvestorEvolutionReport(BaseModel):
    investor_id: uuid.UUID
    has_sufficient_data: bool
    has_comparison: bool
    current_window_start: date
    current_window_end: date
    previous_window_start: date | None
    previous_window_end: date | None
    current: WindowMetrics
    previous: WindowMetrics | None
    deltas: list[MetricDelta]
    strengths: list[str]
    concerns: list[str]
    patterns: list[DetectedPattern]
    generated_at: datetime

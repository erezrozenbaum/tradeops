import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class AttributionFactor(BaseModel):
    factor: str  # savings_contribution | market_return | fees_drag | behavioral_drag | fx_drag | concentration_cost
    label: str
    value_change: float
    pct_of_total_change: Optional[float]
    description: str
    is_estimate: bool = False  # True for supplementary illustrative estimates


class ConfidenceLayer(BaseModel):
    dimension: str  # data_freshness | holdings_completeness | snapshot_recency
    label: str
    score: float  # 0-1
    note: str


class PerformanceAttribution(BaseModel):
    investor_id: uuid.UUID
    period: str  # ytd | 1y | 6m | 3m
    period_start: datetime
    period_end: datetime
    start_value: float
    end_value: float
    total_change: float
    total_return_pct: Optional[float]
    currency: str
    factors: list[AttributionFactor]
    confidence: list[ConfidenceLayer]
    overall_confidence_score: float  # 0-1
    computed_at: datetime
    note: Optional[str]

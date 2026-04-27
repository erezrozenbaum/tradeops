import uuid
from datetime import datetime

from pydantic import BaseModel


class InstrumentSuggestion(BaseModel):
    ticker: str
    name: str
    asset_type: str
    market: str
    currency: str
    risk_level: str
    typical_horizon: str
    asset_family: str
    fit_score: float
    rationale: str
    tags: list[str]


class MarketScanResult(BaseModel):
    investor_id: uuid.UUID
    readiness_classification: str
    suggestions: list[InstrumentSuggestion]
    scan_notes: list[str]
    computed_at: datetime

    model_config = {"from_attributes": True}

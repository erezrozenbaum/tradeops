import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class DriftItem(BaseModel):
    category: str
    tier_key: str
    target_pct: float
    actual_pct: float
    drift_pct: float  # actual - target; positive = overweight
    status: str  # on_track | minor_drift | major_drift


class StrategyDriftReport(BaseModel):
    investor_id: uuid.UUID
    computed_at: datetime
    alignment_score: Optional[float]  # 0-100; None if no data
    risk_profile: Optional[str]
    stability_score: Optional[int]
    locked_pct: float  # % in pension/study funds excluded from analysis
    tradeable_pct: float
    drift_items: list[DriftItem]
    top_concern: Optional[str]
    summary: str
    last_snapshot_at: Optional[datetime]
    risk_model_generated_at: Optional[datetime]

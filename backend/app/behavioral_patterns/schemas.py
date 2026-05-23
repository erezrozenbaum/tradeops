import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class HoldingPeriodStats(BaseModel):
    avg_days: Optional[float]
    median_days: Optional[float]
    short_term_count: int  # < 30 days
    medium_term_count: int  # 30-180 days
    long_term_count: int  # > 180 days
    matched_pairs: int  # buy-sell pairs used for analysis


class BehavioralPattern(BaseModel):
    key: str  # machine key, e.g. "overtrading"
    label: str  # human label
    description: str
    severity: str  # info | warning | positive


class BehavioralMetrics(BaseModel):
    investor_id: uuid.UUID
    computed_at: datetime
    holding_period_stats: HoldingPeriodStats
    monthly_trade_counts: dict[str, int]  # "2025-11": 3
    recommendation_action_rate: Optional[float]  # 0-1; None if no recs
    recommendation_sample_size: int
    patterns_detected: list[BehavioralPattern]
    behavioral_score: int  # 0-100; higher = more disciplined
    summary: str
    data_period_days: int

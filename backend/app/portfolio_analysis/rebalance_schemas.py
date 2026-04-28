import uuid
from datetime import datetime

from pydantic import BaseModel


class RebalanceTier(BaseModel):
    tier: str          # "low_risk" | "growth" | "high_risk"
    label: str
    target_pct: float  # from risk model
    actual_pct: float  # from portfolio (as % of total portfolio value)
    delta_pct: float   # actual - target; positive = overweight
    action: str        # "reduce" | "buy_more" | "hold"
    asset_types: list[str]


class RebalanceResult(BaseModel):
    investor_id: uuid.UUID
    rebalance_needed: bool
    tiers: list[RebalanceTier]
    notes: list[str]
    computed_at: datetime

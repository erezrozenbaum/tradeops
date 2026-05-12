import uuid
from datetime import datetime

from pydantic import BaseModel


class SuggestedTrade(BaseModel):
    ticker: str
    name: str
    action: str          # "buy" | "sell"
    suggested_units: float
    unit_price: float    # live price in base currency
    estimated_value: float  # suggested_units × unit_price in base currency
    currency: str


class RebalanceTier(BaseModel):
    tier: str          # "low_risk" | "growth" | "high_risk"
    label: str
    target_pct: float  # from risk model
    actual_pct: float  # from portfolio (as % of total portfolio value)
    delta_pct: float   # actual - target; positive = overweight
    action: str        # "reduce" | "buy_more" | "hold"
    asset_types: list[str]
    # Money amounts — populated when total portfolio value is known
    target_amount: float | None = None
    actual_amount: float | None = None
    gap_amount: float | None = None   # positive = need to buy, negative = overweight
    suggested_trades: list[SuggestedTrade] = []


class RebalanceResult(BaseModel):
    investor_id: uuid.UUID
    rebalance_needed: bool
    tiers: list[RebalanceTier]
    notes: list[str]
    computed_at: datetime
    total_portfolio_value: float | None = None
    currency: str | None = None

import uuid
from datetime import datetime

from pydantic import BaseModel


class LiquidityBucket(BaseModel):
    tier: int                   # 1 = 1–3 days, 2 = 1 week, 3 = locked
    label: str                  # human-readable tier label
    total_gross: float          # sum of current_value_base for holdings in this tier
    total_net_to_pocket: float  # after estimated tax and market impact
    holding_count: int


class LiquidityHolding(BaseModel):
    holding_id: uuid.UUID
    name: str
    ticker: str | None
    asset_type: str
    account_name: str
    gross_value: float
    estimated_tax: float        # 0 if unrealized loss or locked
    market_impact: float        # execution friction buffer
    net_to_pocket: float
    tier: int
    tier_label: str
    selected_for_target: bool   # True if the greedy lever selected this holding


class LiquidityRunway(BaseModel):
    investor_id: uuid.UUID
    currency: str
    buckets: list[LiquidityBucket]
    total_gross: float
    total_net_to_pocket: float      # excludes locked tier
    target_amount: float | None     # query param echo
    target_met: bool | None         # None when no target provided
    lever_total_gross: float        # gross of selected holdings
    lever_total_net: float          # net of selected holdings
    holdings: list[LiquidityHolding]   # all non-locked holdings, sorted cheapest first
    computed_at: datetime

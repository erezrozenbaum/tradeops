"""Tax-loss harvesting opportunity schemas."""
import uuid
from datetime import datetime

from pydantic import BaseModel


class HarvestOpportunity(BaseModel):
    holding_id: uuid.UUID
    name: str
    ticker: str | None
    asset_type: str
    account_name: str
    unrealized_loss: float          # negative, in base currency
    unrealized_loss_pct: float      # negative, e.g. -8.5
    holding_days: int | None        # None when purchase_date not set
    holding_period_label: str | None  # "187 days (short-term)"
    is_short_term: bool             # True if held < 365 days
    wash_sale_risk: bool            # True if purchased < 30 days ago
    estimated_tax_saving: float     # abs(loss) × rate, in base currency
    suggested_replacement: str | None = None   # e.g. "VTI"
    replacement_rationale: str | None = None   # brief explanation


class GainOffset(BaseModel):
    holding_id: uuid.UUID
    name: str
    ticker: str | None
    asset_type: str
    unrealized_gain: float          # positive, in base currency
    unrealized_gain_pct: float


class TaxOpportunityResult(BaseModel):
    investor_id: uuid.UUID
    currency: str
    harvest_opportunities: list[HarvestOpportunity]
    gain_offsets: list[GainOffset]
    total_harvestable_loss: float   # negative sum of all losses
    total_estimated_tax_saving: float
    capital_gains_rate_pct: float
    min_loss_threshold_pct: float
    computed_at: datetime

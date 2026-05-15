import uuid
from datetime import datetime

from pydantic import BaseModel


class FamilyMemberPortfolio(BaseModel):
    member_id: uuid.UUID
    member_name: str
    relationship_type: str
    generation: str  # "primary" | "partners" | "children" | "parents" | "grandparents" | "siblings" | "other"
    age: int | None
    is_minor: bool
    is_primary: bool
    individual_risk_tolerance: str | None
    total_cost_basis: float
    total_current_value: float
    unrealized_pnl: float
    unrealized_pnl_pct: float
    account_count: int
    asset_allocation: dict[str, float]  # {asset_type: value_base}
    education_mode: bool  # True when is_minor — investment view restricted to paper trading


class OverlapHolding(BaseModel):
    ticker: str
    name: str
    member_names: list[str]
    combined_value: float


class FamilyPortfolioSummary(BaseModel):
    family_id: uuid.UUID
    family_name: str
    currency: str
    primary_investor_id: uuid.UUID
    total_current_value: float
    total_cost_basis: float
    total_unrealized_pnl: float
    total_unrealized_pnl_pct: float
    member_count: int
    members: list[FamilyMemberPortfolio]
    by_generation: dict[str, float]  # {generation_label: total_value}
    household_asset_allocation: dict[str, float]  # {asset_type: total_value}
    cross_member_overlap: list[OverlapHolding]
    has_minors: bool
    computed_at: datetime

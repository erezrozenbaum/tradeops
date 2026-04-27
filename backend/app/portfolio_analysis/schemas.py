import uuid
from datetime import date, datetime

from pydantic import BaseModel


class HoldingAnalysis(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    name: str
    ticker: str | None
    isin: str | None
    asset_type: str
    quantity: float
    avg_buy_price: float
    cost_basis: float
    current_value_local: float
    current_value_base: float
    unrealized_pnl: float
    unrealized_pnl_pct: float
    currency: str
    purchase_date: date | None


class AccountAnalysis(BaseModel):
    id: uuid.UUID
    provider_name: str
    account_type: str
    account_name: str | None
    currency: str
    total_cost_basis: float
    total_current_value: float
    unrealized_pnl: float
    unrealized_pnl_pct: float
    holdings: list[HoldingAnalysis]


class PortfolioSummary(BaseModel):
    investor_id: uuid.UUID
    base_currency: str
    total_cost_basis: float
    total_current_value: float
    unrealized_pnl: float
    unrealized_pnl_pct: float
    asset_allocation: dict[str, float]
    currency_exposure: dict[str, float]
    accounts: list[AccountAnalysis]
    computed_at: datetime

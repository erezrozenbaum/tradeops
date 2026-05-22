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
    pnl_after_tax: float  # unrealized P&L after 25% capital gains tax (gains only)
    currency: str
    purchase_date: date | None
    price_source: str  # "live" | "manual" | "cost_basis"
    live_price: float | None  # per-unit price from market data (in price_currency)
    live_price_currency: str | None  # currency of live_price


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
    pnl_after_tax: float
    holdings: list[HoldingAnalysis]


class PortfolioSummary(BaseModel):
    investor_id: uuid.UUID
    base_currency: str
    total_cost_basis: float
    total_current_value: float
    unrealized_pnl: float
    unrealized_pnl_pct: float
    pnl_after_tax: float
    pnl_after_tax_pct: float
    fx_rates: dict[str, float]  # {foreign_currency: rate_to_base} e.g. {"USD": 3.62}
    asset_allocation: dict[str, float]
    currency_exposure: dict[str, float]
    accounts: list[AccountAnalysis]
    computed_at: datetime
    # Price staleness: True when any tickered holding fell back to cost_basis (no live/manual price)
    has_stale_prices: bool = False
    prices_updated_at: datetime | None = None  # oldest live price timestamp
    # Realized P&L from closed positions (WAVG cost basis across sell transactions)
    realized_pnl_total: float = 0.0
    realized_pnl_ytd: float = 0.0


class PriceRefreshResult(BaseModel):
    portfolio: PortfolioSummary
    tickers_refreshed: list[str]
    tickers_failed: list[str]
    cache_valid_until: datetime


class PortfolioSnapshotPoint(BaseModel):
    snapshot_at: datetime
    total_value: float
    cost_basis: float
    unrealized_pnl: float
    unrealized_pnl_pct: float
    currency: str


class PortfolioHistoryResult(BaseModel):
    investor_id: uuid.UUID
    snapshots: list[PortfolioSnapshotPoint]

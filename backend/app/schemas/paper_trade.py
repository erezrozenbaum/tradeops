import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.strategy import StrategyTemplateOut


class PaperPortfolioCreate(BaseModel):
    name: str | None = Field(default=None, max_length=200, description="Optional display name")
    initial_cash: float = Field(..., gt=0, description="Starting virtual cash amount")
    currency: str = Field(..., min_length=3, max_length=3, description="ISO currency code, e.g. ILS or USD")
    strategy_template_id: uuid.UUID | None = Field(
        default=None,
        description="Optional strategy template — links paper trade to a strategy",
    )
    backtest_run_id: uuid.UUID | None = Field(
        default=None,
        description="Optional link to a preceding backtest run",
    )


class PaperPortfolioRename(BaseModel):
    name: str | None = Field(default=None, max_length=200)


class AdvanceTickRequest(BaseModel):
    seed: int | None = Field(default=None, description="Optional seed for reproducible tick")


class PaperOrderCreate(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=20, description="Ticker symbol, e.g. AAPL")
    side: Literal["buy", "sell"]
    quantity: float = Field(..., gt=0)
    price_per_share: float | None = Field(
        default=None,
        gt=0,
        description="Execution price per share. If omitted, the live market price is fetched automatically.",
    )


class PaperTickOut(BaseModel):
    id: uuid.UUID
    tick_number: int
    portfolio_value_before: float
    portfolio_value_after: float
    monthly_return_pct: float
    simulated_at: datetime

    model_config = {"from_attributes": True}


class PaperPositionOut(BaseModel):
    id: uuid.UUID
    symbol: str
    name: str | None
    quantity: float
    avg_cost_per_share: float
    currency: str
    created_at: datetime
    updated_at: datetime
    current_price: float | None = None
    unrealized_pnl: float | None = None
    unrealized_pnl_pct: float | None = None

    model_config = {"from_attributes": True}


class PaperOrderOut(BaseModel):
    id: uuid.UUID
    symbol: str
    side: str
    quantity: float
    price_per_share: float
    total_value: float
    executed_at: datetime

    model_config = {"from_attributes": True}


class PaperPortfolioOut(BaseModel):
    id: uuid.UUID
    investor_profile_id: uuid.UUID
    strategy_template_id: uuid.UUID | None
    risk_model_id: uuid.UUID | None
    backtest_run_id: uuid.UUID | None
    template: StrategyTemplateOut | None
    name: str | None = None
    initial_capital: float
    cash_balance: float
    current_value: float
    total_return_pct: float
    currency: str
    status: str
    started_at: datetime
    last_tick_at: datetime | None
    ticks: list[PaperTickOut] = []
    positions: list[PaperPositionOut] = []
    orders: list[PaperOrderOut] = []

    model_config = {"from_attributes": True}


class PaperPortfolioSummaryOut(BaseModel):
    id: uuid.UUID
    investor_profile_id: uuid.UUID
    strategy_template_id: uuid.UUID | None
    risk_model_id: uuid.UUID | None
    backtest_run_id: uuid.UUID | None
    template: StrategyTemplateOut | None
    name: str | None = None
    initial_capital: float
    cash_balance: float
    current_value: float
    total_return_pct: float
    currency: str
    status: str
    started_at: datetime
    last_tick_at: datetime | None

    model_config = {"from_attributes": True}

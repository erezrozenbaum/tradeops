import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.strategy import StrategyTemplateOut


class PaperPortfolioCreate(BaseModel):
    strategy_template_id: uuid.UUID
    backtest_run_id: uuid.UUID | None = Field(
        default=None,
        description="Optional link to a preceding backtest run",
    )


class AdvanceTickRequest(BaseModel):
    seed: int | None = Field(default=None, description="Optional seed for reproducible tick")


class PaperTickOut(BaseModel):
    id: uuid.UUID
    tick_number: int
    portfolio_value_before: float
    portfolio_value_after: float
    monthly_return_pct: float
    simulated_at: datetime

    model_config = {"from_attributes": True}


class PaperPortfolioOut(BaseModel):
    id: uuid.UUID
    investor_profile_id: uuid.UUID
    strategy_template_id: uuid.UUID
    risk_model_id: uuid.UUID
    backtest_run_id: uuid.UUID | None
    template: StrategyTemplateOut
    initial_capital: float
    current_value: float
    total_return_pct: float
    currency: str
    status: str
    started_at: datetime
    last_tick_at: datetime | None
    ticks: list[PaperTickOut] = []

    model_config = {"from_attributes": True}


class PaperPortfolioSummaryOut(BaseModel):
    id: uuid.UUID
    investor_profile_id: uuid.UUID
    strategy_template_id: uuid.UUID
    risk_model_id: uuid.UUID
    backtest_run_id: uuid.UUID | None
    template: StrategyTemplateOut
    initial_capital: float
    current_value: float
    total_return_pct: float
    currency: str
    status: str
    started_at: datetime
    last_tick_at: datetime | None

    model_config = {"from_attributes": True}

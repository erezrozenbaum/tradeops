import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.strategy import StrategyTemplateOut


class BacktestRequest(BaseModel):
    strategy_template_id: uuid.UUID
    period_months: int = Field(ge=1, le=360, description="Simulation length in months (1–360)")
    seed: int | None = Field(default=None, description="Optional seed for reproducible results")


class BacktestPeriodOut(BaseModel):
    id: uuid.UUID
    month: int
    portfolio_value: float
    monthly_return_pct: float

    model_config = {"from_attributes": True}


class BacktestRunOut(BaseModel):
    id: uuid.UUID
    investor_profile_id: uuid.UUID
    strategy_template_id: uuid.UUID
    risk_model_id: uuid.UUID
    template: StrategyTemplateOut
    initial_capital: float
    final_capital: float
    period_months: int
    seed: int | None
    total_return_pct: float
    annualized_return_pct: float
    max_drawdown_pct: float
    sharpe_ratio: float
    win_rate_pct: float
    currency: str
    notes: str
    created_at: datetime
    periods: list[BacktestPeriodOut] = []

    model_config = {"from_attributes": True}


class BacktestRunSummaryOut(BaseModel):
    id: uuid.UUID
    investor_profile_id: uuid.UUID
    strategy_template_id: uuid.UUID
    risk_model_id: uuid.UUID
    template: StrategyTemplateOut
    initial_capital: float
    final_capital: float
    period_months: int
    total_return_pct: float
    annualized_return_pct: float
    max_drawdown_pct: float
    sharpe_ratio: float
    win_rate_pct: float
    currency: str
    notes: str
    created_at: datetime

    model_config = {"from_attributes": True}

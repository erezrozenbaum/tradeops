import uuid
from datetime import datetime
from pydantic import BaseModel


class BenchmarkPoint(BaseModel):
    date: str  # ISO date
    cumulative_return_pct: float


class PerformanceAnalytics(BaseModel):
    investor_id: uuid.UUID
    currency: str
    period_days: int
    data_points: int

    # Returns
    total_return_pct: float
    annual_return_pct: float | None

    # Risk metrics
    max_drawdown_pct: float
    current_drawdown_pct: float
    sharpe_ratio: float | None
    sortino_ratio: float | None
    annual_volatility_pct: float | None

    # Period stats
    best_period_pct: float | None
    worst_period_pct: float | None

    # Benchmark
    benchmark_ticker: str | None
    benchmark_total_return_pct: float | None
    benchmark_series: list[BenchmarkPoint]
    beta: float | None  # portfolio sensitivity to benchmark (Cov/Var)

    computed_at: datetime


# ── Attribution ───────────────────────────────────────────────────────────────

class HoldingContribution(BaseModel):
    holding_id: uuid.UUID
    name: str
    ticker: str | None
    asset_type: str
    weight_pct: float       # % of portfolio cost basis
    return_pct: float       # this holding's unrealized return %
    contribution_pct: float # contribution to total portfolio return (gain / total_cost_basis × 100)
    cagr_pct: float | None = None  # annualised return since purchase; None if < 30 days or no purchase_date


class AttributionResult(BaseModel):
    investor_id: uuid.UUID
    currency: str
    total_return_pct: float
    benchmark_ticker: str
    benchmark_return_pct: float | None
    alpha_pct: float | None
    rolling_returns: dict[str, float | None]  # "1m", "3m", "6m", "1y"
    contributors: list[HoldingContribution]
    detractors: list[HoldingContribution]
    computed_at: datetime

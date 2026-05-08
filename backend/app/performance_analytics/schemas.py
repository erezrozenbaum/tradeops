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

    computed_at: datetime

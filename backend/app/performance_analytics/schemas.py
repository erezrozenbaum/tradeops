import uuid
from datetime import datetime
from pydantic import BaseModel


class LazyPortfolioComparison(BaseModel):
    investor_id: uuid.UUID
    currency: str
    data_gate_passed: bool          # True if investor has 30+ days of snapshots
    snapshot_days: int              # actual days of history available
    # Portfolio metrics (same window as snapshots)
    portfolio_return_pct: float
    portfolio_sharpe: float | None
    # Lazy 60/40 portfolio (60% VT / 40% AGG) over same period
    lazy_return_pct: float | None
    lazy_sharpe: float | None       # estimated from same benchmark returns
    lazy_composition: str           # "60% VT / 40% AGG"
    # Derived
    complexity_premium_pct: float | None  # portfolio_return - lazy_return
    risk_adjusted_premium: float | None   # portfolio_sharpe - lazy_sharpe
    verdict: str                    # human-readable honest verdict
    computed_at: datetime


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

    # Return methodology
    # twr_pct = annual_return_pct (NAV chain-link, unaffected by deposit timing)
    # mwr_pct = IRR from actual buy cash flows (reflects investor timing and size)
    mwr_pct: float | None = None

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

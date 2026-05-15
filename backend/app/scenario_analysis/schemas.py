import uuid
from datetime import datetime
from pydantic import BaseModel


class HoldingImpact(BaseModel):
    name: str
    ticker: str | None
    asset_type: str
    current_value: float
    simulated_loss: float   # negative = loss, positive = gain (base currency)
    simulated_value: float


class ScenarioImpact(BaseModel):
    scenario_id: str
    scenario_name: str
    description: str
    year: str
    portfolio_loss: float        # negative = loss, positive = gain (base currency)
    portfolio_loss_pct: float
    simulated_value: float       # portfolio value after scenario
    low_risk_loss: float
    growth_loss: float
    high_risk_loss: float
    fx_impact: float             # FX contribution (ILS portfolios with USD exposure)
    recovery_months: int | None  # historical months to recover from trough (None = hypothetical)
    holding_impacts: list[HoldingImpact]  # per-holding breakdown sorted by simulated_loss


class MonteCarloPercentile(BaseModel):
    year: int
    p10: float   # 10th percentile (bad case)
    p50: float   # median
    p90: float   # 90th percentile (good case)


class MonteCarloResult(BaseModel):
    years: int
    percentiles: list[MonteCarloPercentile]


class StressTestResult(BaseModel):
    investor_id: uuid.UUID
    currency: str
    current_value: float
    scenarios: list[ScenarioImpact]
    monte_carlo: MonteCarloResult
    computed_at: datetime

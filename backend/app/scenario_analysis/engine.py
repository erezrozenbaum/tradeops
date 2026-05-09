"""Scenario analysis + Monte Carlo simulation engine."""
import math
import random
import uuid
from datetime import datetime, timezone

from app.portfolio_analysis.schemas import PortfolioSummary
from app.scenario_analysis.scenarios import SCENARIOS, Scenario
from app.scenario_analysis.schemas import (
    ScenarioImpact,
    MonteCarloPercentile,
    MonteCarloResult,
    StressTestResult,
)

# Asset-type → risk tier mapping (mirrors rebalance_engine)
_TIER: dict[str, str] = {
    "bond": "low_risk",
    "fund": "low_risk",
    "pension_fund": "low_risk",
    "study_fund": "low_risk",
    "bank": "low_risk",
    "etf": "growth",
    "stock": "growth",
    "real_estate": "growth",
    "crypto": "high_risk",
    "other": "growth",
}


def _tier_values(portfolio: PortfolioSummary) -> dict[str, float]:
    """Sum current_value_base by risk tier across all holdings."""
    totals: dict[str, float] = {"low_risk": 0.0, "growth": 0.0, "high_risk": 0.0, "currency_usd": 0.0}
    for acc in portfolio.accounts:
        for h in acc.holdings:
            tier = _TIER.get(h.asset_type, "growth")
            totals[tier] += h.current_value_base
            if h.currency == "USD":
                totals["currency_usd"] += h.current_value_base
    return totals


def _apply_scenario(
    scenario: Scenario,
    portfolio: PortfolioSummary,
    tier_values: dict[str, float],
    currency: str,
) -> ScenarioImpact:
    total = portfolio.total_current_value
    if total <= 0:
        return ScenarioImpact(
            scenario_id=scenario.id,
            scenario_name=scenario.name,
            description=scenario.description,
            year=scenario.year,
            portfolio_loss=0.0,
            portfolio_loss_pct=0.0,
            simulated_value=0.0,
            low_risk_loss=0.0,
            growth_loss=0.0,
            high_risk_loss=0.0,
            fx_impact=0.0,
        )

    low_loss = tier_values["low_risk"] * scenario.low_risk_drawdown / 100
    growth_loss = tier_values["growth"] * scenario.growth_drawdown / 100
    high_loss = tier_values["high_risk"] * scenario.high_risk_drawdown / 100

    # FX impact: for ILS base-currency portfolios, USD-denominated holdings
    # gain/lose value when USD strengthens/weakens vs ILS
    fx_impact = 0.0
    if currency == "ILS" and scenario.ils_fx_shock != 0.0:
        # USD exposure in portfolio (in ILS) × shock %
        fx_impact = tier_values.get("currency_usd", 0.0) * scenario.ils_fx_shock / 100

    total_loss = low_loss + growth_loss + high_loss + fx_impact
    simulated = total + total_loss

    return ScenarioImpact(
        scenario_id=scenario.id,
        scenario_name=scenario.name,
        description=scenario.description,
        year=scenario.year,
        portfolio_loss=round(total_loss, 2),
        portfolio_loss_pct=round(total_loss / total * 100, 2),
        simulated_value=round(max(simulated, 0.0), 2),
        low_risk_loss=round(low_loss, 2),
        growth_loss=round(growth_loss, 2),
        high_risk_loss=round(high_loss, 2),
        fx_impact=round(fx_impact, 2),
    )


def _monte_carlo(
    current_value: float,
    years: int,
    annual_return_mean: float = 0.07,   # 7% historical equity average
    annual_volatility: float = 0.15,    # 15% annual std dev
    simulations: int = 1000,
) -> MonteCarloResult:
    """
    Log-normal annual return Monte Carlo.
    Returns P10 / P50 / P90 wealth paths at each year mark.
    """
    if current_value <= 0 or years <= 0:
        return MonteCarloResult(years=years, percentiles=[])

    mu = annual_return_mean
    sigma = annual_volatility
    # Log-normal params
    log_mu = math.log(1 + mu) - 0.5 * math.log(1 + (sigma / (1 + mu)) ** 2)
    log_sigma = math.sqrt(math.log(1 + (sigma / (1 + mu)) ** 2))

    rng = random.Random(42)  # deterministic for caching
    paths: list[list[float]] = []
    for _ in range(simulations):
        path = [current_value]
        v = current_value
        for _ in range(years):
            r = math.exp(log_mu + log_sigma * _gauss(rng))
            v = v * r
            path.append(v)
        paths.append(path)

    percentiles: list[MonteCarloPercentile] = []
    for y in range(years + 1):
        year_vals = sorted(p[y] for p in paths)
        n = len(year_vals)
        p10 = year_vals[int(n * 0.10)]
        p50 = year_vals[int(n * 0.50)]
        p90 = year_vals[int(n * 0.90)]
        percentiles.append(MonteCarloPercentile(
            year=y,
            p10=round(p10, 0),
            p50=round(p50, 0),
            p90=round(p90, 0),
        ))

    return MonteCarloResult(years=years, percentiles=percentiles)


def _gauss(rng: random.Random) -> float:
    """Box-Muller transform for standard normal sample."""
    u1 = rng.random() or 1e-10
    u2 = rng.random()
    return math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)


def compute(
    portfolio: PortfolioSummary | None,
    investor_id: uuid.UUID,
    currency: str,
    years_to_retirement: int = 20,
) -> StressTestResult:
    now = datetime.now(timezone.utc)

    if portfolio is None or portfolio.total_current_value <= 0:
        return StressTestResult(
            investor_id=investor_id,
            currency=currency,
            current_value=0.0,
            scenarios=[],
            monte_carlo=MonteCarloResult(years=years_to_retirement, percentiles=[]),
            computed_at=now,
        )

    tier_values = _tier_values(portfolio)
    scenario_results = [
        _apply_scenario(s, portfolio, tier_values, currency)
        for s in SCENARIOS
    ]

    mc = _monte_carlo(
        current_value=portfolio.total_current_value,
        years=max(1, min(years_to_retirement, 40)),
    )

    return StressTestResult(
        investor_id=investor_id,
        currency=currency,
        current_value=round(portfolio.total_current_value, 2),
        scenarios=scenario_results,
        monte_carlo=mc,
        computed_at=now,
    )

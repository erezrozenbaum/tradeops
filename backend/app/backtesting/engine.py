from __future__ import annotations

import math
from dataclasses import dataclass, field
from random import Random

from app.models.strategy_template import StrategyTemplate, StrategyType


@dataclass
class PeriodSnapshot:
    month: int
    portfolio_value: float
    monthly_return_pct: float


@dataclass
class BacktestResult:
    strategy_template_id: object  # UUID
    initial_capital: float
    final_capital: float
    period_months: int
    total_return_pct: float
    annualized_return_pct: float
    max_drawdown_pct: float
    sharpe_ratio: float
    win_rate_pct: float
    notes: str
    periods: list[PeriodSnapshot] = field(default_factory=list)


# Annual mean return and annual std dev per strategy type (as decimals)
_STRATEGY_PARAMS: dict[str, tuple[float, float]] = {
    StrategyType.education_only.value:       (0.00, 0.000),
    StrategyType.foundation_building.value:  (0.00, 0.000),
    StrategyType.conservative.value:         (0.055, 0.065),
    StrategyType.balanced.value:             (0.09,  0.12),
    StrategyType.growth.value:               (0.125, 0.17),
    StrategyType.speculative.value:          (0.17,  0.25),
}

_RISK_FREE_ANNUAL = 0.04  # 4% risk-free benchmark


def run_backtest(
    template: StrategyTemplate,
    initial_capital: float,
    period_months: int,
    currency: str,
    seed: int | None = None,
) -> BacktestResult:
    annual_mean, annual_std = _STRATEGY_PARAMS.get(
        template.strategy_type.value if hasattr(template.strategy_type, "value") else str(template.strategy_type),
        (0.0, 0.0),
    )

    # Convert to monthly parameters
    monthly_mean = (1.0 + annual_mean) ** (1.0 / 12) - 1.0
    monthly_std = annual_std / math.sqrt(12) if annual_std > 0 else 0.0

    rng = Random(seed)  # nosec B311 — seeded RNG for reproducible financial simulation, not cryptography

    portfolio = max(initial_capital, 0.0)
    peak = portfolio
    max_drawdown = 0.0
    wins = 0
    periods: list[PeriodSnapshot] = []

    for month in range(1, period_months + 1):
        if monthly_std > 0:
            r = rng.gauss(monthly_mean, monthly_std)
        else:
            r = 0.0

        portfolio = portfolio * (1.0 + r)
        if portfolio > peak:
            peak = portfolio

        drawdown = (peak - portfolio) / peak if peak > 0 else 0.0
        if drawdown > max_drawdown:
            max_drawdown = drawdown

        if r > 0:
            wins += 1

        periods.append(PeriodSnapshot(
            month=month,
            portfolio_value=round(portfolio, 2),
            monthly_return_pct=round(r * 100, 4),
        ))

    final_capital = portfolio
    total_return = (final_capital - initial_capital) / initial_capital if initial_capital > 0 else 0.0

    if period_months > 0:
        annualized_return = (1.0 + total_return) ** (12.0 / period_months) - 1.0
        win_rate = (wins / period_months) * 100.0
    else:
        annualized_return = 0.0
        win_rate = 0.0

    # Annualised Sharpe: (E[r] - rf) / sigma
    annualized_std = monthly_std * math.sqrt(12)
    if annualized_std > 0:
        sharpe = (annualized_return - _RISK_FREE_ANNUAL) / annualized_std
    else:
        sharpe = 0.0

    notes = _build_notes(template, total_return, max_drawdown, period_months)

    return BacktestResult(
        strategy_template_id=template.id,
        initial_capital=round(initial_capital, 2),
        final_capital=round(final_capital, 2),
        period_months=period_months,
        total_return_pct=round(total_return * 100, 4),
        annualized_return_pct=round(annualized_return * 100, 4),
        max_drawdown_pct=round(max_drawdown * 100, 4),
        sharpe_ratio=round(sharpe, 4),
        win_rate_pct=round(win_rate, 4),
        notes=notes,
        periods=periods,
    )


def _build_notes(template: StrategyTemplate, total_return: float, max_drawdown: float, period_months: int) -> str:
    strategy_name = template.name if hasattr(template, "name") else str(template.strategy_type)
    years = period_months / 12
    lines = [
        f"Simulated backtest for '{strategy_name}' over {period_months} months ({years:.1f} years).",
        f"Total return: {total_return * 100:.2f}%. Max drawdown: {max_drawdown * 100:.2f}%.",
        "This is a simulation based on historical return assumptions — not a guarantee of future results.",
    ]
    if max_drawdown > 0.20:
        lines.append("Warning: drawdown exceeded 20%. Ensure this volatility is within your risk tolerance.")
    return " ".join(lines)

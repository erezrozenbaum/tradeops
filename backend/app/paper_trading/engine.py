from __future__ import annotations

import math
from dataclasses import dataclass
from random import Random

from app.models.strategy_template import StrategyType

_STRATEGY_PARAMS: dict[str, tuple[float, float]] = {
    StrategyType.education_only.value:       (0.00, 0.000),
    StrategyType.foundation_building.value:  (0.00, 0.000),
    StrategyType.conservative.value:         (0.055, 0.065),
    StrategyType.balanced.value:             (0.09,  0.12),
    StrategyType.growth.value:               (0.125, 0.17),
    StrategyType.speculative.value:          (0.17,  0.25),
}


@dataclass
class TickResult:
    value_before: float
    value_after: float
    monthly_return_pct: float


def simulate_tick(
    strategy_type: str,
    current_value: float,
    seed: int | None = None,
) -> TickResult:
    annual_mean, annual_std = _STRATEGY_PARAMS.get(strategy_type, (0.0, 0.0))
    monthly_mean = (1.0 + annual_mean) ** (1.0 / 12) - 1.0
    monthly_std = annual_std / math.sqrt(12) if annual_std > 0 else 0.0

    rng = Random(seed)  # nosec B311 — seeded RNG for reproducible financial simulation, not cryptography
    value_before = max(current_value, 0.0)
    r = rng.gauss(monthly_mean, monthly_std) if monthly_std > 0 else 0.0
    value_after = round(value_before * (1.0 + r), 2)

    return TickResult(
        value_before=round(value_before, 2),
        value_after=value_after,
        monthly_return_pct=round(r * 100, 4),
    )

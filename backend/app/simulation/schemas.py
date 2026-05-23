from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class SimulationParameters(BaseModel):
    """Scenario-specific input parameters — only relevant fields per scenario_type are required."""

    # Shared / general
    annual_return_rate_pct: Optional[float] = None   # default 7.0
    annual_volatility_pct: Optional[float] = None    # default 12–15 % (Monte Carlo only)
    monthly_contribution: Optional[float] = None     # for savings_increase / retirement / custom

    # debt_payoff
    debt_balance: Optional[float] = None
    debt_interest_rate_pct: Optional[float] = None
    current_monthly_payment: Optional[float] = None
    extra_monthly_payment: Optional[float] = None    # e.g. 500

    # savings_increase
    monthly_savings_increase: Optional[float] = None

    # job_loss
    income_replacement_pct: Optional[float] = None   # 0.0–1.0; 0 = full loss, 0.5 = 50% replacement
    expense_reduction_pct: Optional[float] = None    # 0.0–1.0; forced expense cut

    # market_crash (Monte Carlo)
    crash_drawdown_pct: Optional[float] = None       # e.g. 30.0 = 30% crash depth
    crash_probability_pct: Optional[float] = None    # annual %, e.g. 15.0


class SimulationRunCreate(BaseModel):
    scenario_type: str   # debt_payoff | savings_increase | job_loss | market_crash | retirement | custom
    scenario_name: Optional[str] = None
    horizon_months: int = 60
    parameters: SimulationParameters = SimulationParameters()


class SimulationRunResponse(BaseModel):
    id: uuid.UUID
    investor_id: uuid.UUID
    scenario_type: str
    scenario_name: str
    status: str
    horizon_months: int
    parameters: dict
    data_snapshot: dict
    results: dict
    random_seed: Optional[int]
    is_saved: bool
    disclaimer: str
    computed_at: datetime

    class Config:
        from_attributes = True


class SimulationListResponse(BaseModel):
    simulations: list[SimulationRunResponse]
    total: int

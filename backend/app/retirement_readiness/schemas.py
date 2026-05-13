import uuid
from datetime import datetime

from pydantic import BaseModel


class ReadinessScore(BaseModel):
    investor_id: uuid.UUID
    score: int                        # 0–100
    verdict: str                      # "On track" / "Mostly on track" / "At risk" / "Significant gap" / "Critical shortfall"
    projected_monthly_income: float   # SWR-based monthly income at retirement (base currency)
    monthly_expenses: float           # current monthly expenses used as retirement income target
    gap_monthly: float                # positive = surplus, negative = shortfall
    total_at_retirement: float        # pension projected + portfolio MC P50
    pension_projected: float          # from pension_projection module
    portfolio_mc_p50: float           # Monte Carlo median at retirement from scenario_analysis
    years_to_retirement: float
    years_to_close_gap: int | None    # extra years of growth needed if shortfall; None when on track
    swr_pct: float                    # safe withdrawal rate applied (4.0)
    currency: str
    computed_at: datetime

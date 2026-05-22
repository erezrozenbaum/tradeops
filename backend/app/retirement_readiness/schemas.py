import uuid
from datetime import datetime

from pydantic import BaseModel


class ReadinessScore(BaseModel):
    investor_id: uuid.UUID
    score: int
    verdict: str
    projected_monthly_income: float   # pension_monthly_income + swr_monthly (from hishtalmut + portfolio)
    pension_monthly_income: float     # pension funds only: sum(projected / makdam)
    monthly_expenses: float
    gap_monthly: float
    total_at_retirement: float        # pension_projected + hishtalmut_projected + portfolio_mc_p50
    pension_projected: float          # pension_fund type only
    hishtalmut_projected: float       # study_fund type only
    portfolio_mc_p50: float
    years_to_retirement: float
    years_to_close_gap: int | None
    swr_pct: float
    currency: str
    computed_at: datetime

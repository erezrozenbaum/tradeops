from pydantic import BaseModel, Field

from app.models.financial_profile import IncomeTrend, JobStability


class FinancialScoringInput(BaseModel):
    monthly_income: float = Field(..., ge=0)
    monthly_expenses: float = Field(..., ge=0)
    emergency_fund_months: float = Field(..., ge=0)
    total_monthly_debt_payments: float = Field(0.0, ge=0)
    total_assets: float = Field(0.0, ge=0)
    total_liabilities: float = Field(0.0, ge=0)
    job_stability: JobStability
    income_trend: IncomeTrend
    dependents_count: int = Field(0, ge=0)


class FinancialStabilityScore(BaseModel):
    score: int = Field(..., ge=0, le=100)
    classification: str  # unstable | fragile | stable | strong
    risk_modifier: str  # reduce | neutral | allow_growth
    recommendations: list[str]


from app.models.financial_profile import IncomeTrend, JobStability
from app.financial_scoring.schemas import FinancialScoringInput


def make_input(**overrides) -> FinancialScoringInput:
    defaults = dict(
        monthly_income=10_000,
        monthly_expenses=6_000,
        emergency_fund_months=4,
        total_monthly_debt_payments=500,
        total_assets=150_000,
        total_liabilities=30_000,
        job_stability=JobStability.stable,
        income_trend=IncomeTrend.stable,
        dependents_count=0,
    )
    defaults.update(overrides)
    return FinancialScoringInput(**defaults)

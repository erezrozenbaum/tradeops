import uuid

from sqlalchemy.orm import Session

from app.financial_profiles.service import get_by_investor as get_financial_profile
from app.goals.service import get_by_investor as get_goals
from app.goals_analysis import engine
from app.goals_analysis.schemas import GoalsAnalysisResult
from app.models.investor_profile import InvestorProfile


def get_analysis(db: Session, investor_id: uuid.UUID) -> GoalsAnalysisResult | None:
    investor = db.get(InvestorProfile, investor_id)
    if not investor:
        return None

    goals = get_goals(db, investor_id)
    financial_profile = get_financial_profile(db, investor_id)

    monthly_surplus: float | None = None
    if financial_profile and financial_profile.monthly_income > 0:
        monthly_surplus = round(
            financial_profile.monthly_income - financial_profile.monthly_expenses, 2
        )

    return engine.analyze(investor_id, goals, monthly_surplus)

import uuid

from sqlalchemy.orm import Session

from app.financial_decision.engine import evaluate
from app.financial_decision.schemas import InvestmentDecision
from app.financial_profiles import service as fp_service
from app.goals import service as goals_service
from app.models.investor_profile import InvestorProfile
from app.risk_modeling import service as risk_service


def get_decision(db: Session, investor_id: uuid.UUID) -> InvestmentDecision | None:
    investor = db.get(InvestorProfile, investor_id)
    if not investor:
        return None

    financial_profile = fp_service.get_by_investor(db, investor_id)
    risk_model = risk_service.get_latest(db, investor_id)
    goals = goals_service.get_by_investor(db, investor_id)

    return evaluate(
        investor=investor,
        financial_profile=financial_profile,
        risk_model=risk_model,
        goals=goals,
    )

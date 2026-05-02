import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.debt_planner import engine
from app.debt_planner.schemas import DebtPlanResult
from app.models.financial_profile import FinancialLiability, FinancialProfile
from app.models.investor_profile import InvestorProfile

router = APIRouter()


@router.get("", response_model=DebtPlanResult)
def get_debt_plan(
    investor_id: uuid.UUID,
    strategy: Literal["avalanche", "snowball"] = "avalanche",
    extra_monthly: float = 0.0,
    db: Session = Depends(get_db),
):
    investor = db.get(InvestorProfile, investor_id)
    if not investor:
        raise HTTPException(status_code=404, detail="Investor not found")

    fp = (
        db.query(FinancialProfile)
        .filter(FinancialProfile.investor_profile_id == investor_id)
        .first()
    )
    liabilities: list[FinancialLiability] = fp.liabilities if fp else []
    base_currency = fp.currency if fp else investor.base_currency

    return engine.compute_plan(liabilities, strategy, extra_monthly, base_currency)

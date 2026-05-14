import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.financial_profiles import service as fp_service
from app.financial_scoring.engine import calculate_stability_score
from app.financial_scoring.schemas import FinancialScoringInput, FinancialStabilityScore
from app.investor_profiles import service
from app.models.user import User
from app.schemas.investor_profile import (
    InvestorProfileCreate,
    InvestorProfileOut,
    InvestorProfileUpdate,
)

router = APIRouter()


@router.post("", response_model=InvestorProfileOut, status_code=status.HTTP_201_CREATED)
def create_investor(
    data: InvestorProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.create(db, data, user_id=current_user.id)


@router.get("", response_model=list[InvestorProfileOut])
def list_investors(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return service.get_all(db, user_id=current_user.id, skip=skip, limit=limit)


@router.get("/{investor_id}", response_model=InvestorProfileOut)
def get_investor(
    investor_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = service.get(db, investor_id)
    if not profile or profile.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Investor profile not found")
    return profile


@router.put("/{investor_id}", response_model=InvestorProfileOut)
def update_investor(
    investor_id: uuid.UUID,
    data: InvestorProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = service.get(db, investor_id)
    if not profile or profile.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Investor profile not found")
    updated = service.update(db, investor_id, data)
    return updated


@router.delete("/{investor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_investor(
    investor_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = service.get(db, investor_id)
    if not profile or profile.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Investor profile not found")
    service.delete(db, investor_id)


@router.get("/{investor_id}/stability-score", response_model=FinancialStabilityScore)
def get_stability_score(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    if not service.get(db, investor_id):
        raise HTTPException(status_code=404, detail="Investor profile not found")
    fp = fp_service.get_by_investor(db, investor_id)
    if not fp:
        raise HTTPException(
            status_code=422,
            detail="No financial profile found. Add income, expenses, and financial data first.",
        )
    scoring_input = FinancialScoringInput(
        monthly_income=fp.monthly_income,
        monthly_expenses=fp.monthly_expenses,
        emergency_fund_months=fp.emergency_fund_months,
        total_monthly_debt_payments=sum(l.monthly_payment for l in fp.liabilities),
        total_assets=sum(a.current_value for a in fp.assets),
        total_liabilities=sum(l.outstanding_balance for l in fp.liabilities),
        job_stability=fp.job_stability,
        income_trend=fp.income_trend,
        dependents_count=fp.dependents_count,
    )
    return calculate_stability_score(scoring_input)

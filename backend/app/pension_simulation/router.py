import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.investment_account import InvestmentAccount, InvestmentHolding
from app.models.investor_profile import InvestorProfile
from app.pension_simulation import engine
from app.pension_simulation.schemas import PensionSimulationResult

router = APIRouter()

_DEFAULT_RETURN_RATE = 5.0
_DEFAULT_RETIREMENT_AGE = 67
_DEFAULT_WITHDRAWAL_YEARS = 25


def _current_age(dob: date) -> float:
    today = date.today()
    years = today.year - dob.year
    if (today.month, today.day) < (dob.month, dob.day):
        years -= 1
    # fractional year for more accurate projection
    try:
        birthday_this_year = dob.replace(year=today.year)
    except ValueError:
        birthday_this_year = dob.replace(year=today.year, day=28)
    day_of_year = (today - birthday_this_year).days
    return years + day_of_year / 365.25


@router.get("", response_model=PensionSimulationResult)
def simulate_pension(
    investor_id: uuid.UUID,
    holding_id: uuid.UUID = Query(..., description="UUID of the pension_fund holding"),
    retirement_age: int = Query(_DEFAULT_RETIREMENT_AGE, ge=50, le=90),
    monthly_contribution: float | None = Query(None, ge=0),
    annual_return_rate: float | None = Query(None, ge=0, le=30),
    withdrawal_years: int = Query(_DEFAULT_WITHDRAWAL_YEARS, ge=10, le=40),
    db: Session = Depends(get_db),
):
    investor = db.get(InvestorProfile, investor_id)
    if not investor:
        raise HTTPException(status_code=404, detail="Investor not found")

    holding = (
        db.query(InvestmentHolding)
        .join(InvestmentAccount)
        .filter(
            InvestmentHolding.id == holding_id,
            InvestmentAccount.investor_id == investor_id,
        )
        .first()
    )
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    if holding.asset_type != "pension_fund":
        raise HTTPException(status_code=400, detail="Holding is not a pension fund")

    current_balance = holding.current_balance or holding.current_value or 0.0
    contrib = monthly_contribution if monthly_contribution is not None else (holding.monthly_contribution or 0.0)
    rate = annual_return_rate if annual_return_rate is not None else (holding.annual_return_rate or _DEFAULT_RETURN_RATE)
    current_age = _current_age(investor.date_of_birth)

    result = engine.simulate(
        current_balance=current_balance,
        current_age=current_age,
        retirement_age=retirement_age,
        monthly_contribution=contrib,
        annual_return_rate_pct=rate,
        withdrawal_years=withdrawal_years,
    )

    return PensionSimulationResult(
        holding_id=holding.id,
        fund_name=holding.name,
        currency=holding.currency,
        current_balance=current_balance,
        current_age=round(current_age, 1),
        retirement_age=retirement_age,
        monthly_contribution=contrib,
        annual_return_rate=rate,
        withdrawal_years=withdrawal_years,
        **result,
    )

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
_STUDY_FUND_TAX_YEARS = 6


def _current_age(dob: date) -> float:
    today = date.today()
    years = today.year - dob.year
    if (today.month, today.day) < (dob.month, dob.day):
        years -= 1
    try:
        birthday_this_year = dob.replace(year=today.year)
    except ValueError:
        birthday_this_year = dob.replace(year=today.year, day=28)
    day_of_year = (today - birthday_this_year).days
    return years + day_of_year / 365.25


def _study_fund_tax(start_date: date | None) -> tuple[str | None, str | None, float | None]:
    """Returns (tax_status, exemption_date_str, years_until_tax_free)."""
    if not start_date:
        return None, None, None
    try:
        exemption = start_date.replace(year=start_date.year + _STUDY_FUND_TAX_YEARS)
    except ValueError:
        exemption = start_date.replace(year=start_date.year + _STUDY_FUND_TAX_YEARS, day=28)
    today = date.today()
    if today >= exemption:
        return "Tax-Free", str(exemption), 0.0
    years_left = round((exemption.toordinal() - today.toordinal()) / 365.25, 1)
    return "Locked", str(exemption), years_left


@router.get("", response_model=PensionSimulationResult)
def simulate_fund(
    investor_id: uuid.UUID,
    holding_id: uuid.UUID = Query(...),
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
    if holding.asset_type not in ("pension_fund", "study_fund"):
        raise HTTPException(status_code=400, detail="Holding must be a pension_fund or study_fund")

    current_balance = holding.current_balance or holding.current_value or 0.0
    rate = annual_return_rate if annual_return_rate is not None else (holding.annual_return_rate or _DEFAULT_RETURN_RATE)
    current_age = _current_age(investor.date_of_birth)

    # Determine effective monthly contribution
    is_study = holding.asset_type == "study_fund"
    fund_status = holding.fund_status or "active"

    if is_study:
        if fund_status == "inactive":
            effective_contrib = 0.0
        elif monthly_contribution is not None:
            effective_contrib = monthly_contribution
        else:
            ee = holding.monthly_contribution_employee or 0.0
            er = holding.monthly_contribution_employer or 0.0
            effective_contrib = ee + er
        tax_status, tax_exemption_date, years_until_tax_free = _study_fund_tax(holding.purchase_date)
    else:
        effective_contrib = monthly_contribution if monthly_contribution is not None else (holding.monthly_contribution or 0.0)
        tax_status = tax_exemption_date = years_until_tax_free = None

    result = engine.simulate(
        current_balance=current_balance,
        current_age=current_age,
        retirement_age=retirement_age,
        monthly_contribution=effective_contrib,
        annual_return_rate_pct=rate,
        withdrawal_years=withdrawal_years,
        management_fee_balance_pct=holding.management_fee_balance_pct or 0.0,
        management_fee_contribution_pct=holding.management_fee_contribution_pct or 0.0,
    )

    return PensionSimulationResult(
        holding_id=holding.id,
        fund_name=holding.name,
        asset_type=holding.asset_type,
        currency=holding.currency,
        current_balance=current_balance,
        current_age=round(current_age, 1),
        retirement_age=retirement_age,
        monthly_contribution=effective_contrib,
        annual_return_rate=rate,
        withdrawal_years=withdrawal_years,
        fund_status=fund_status if is_study else None,
        tax_status=tax_status,
        tax_exemption_date=tax_exemption_date,
        years_until_tax_free=years_until_tax_free,
        monthly_contribution_employee=holding.monthly_contribution_employee if is_study else None,
        monthly_contribution_employer=holding.monthly_contribution_employer if is_study else None,
        **result,
    )

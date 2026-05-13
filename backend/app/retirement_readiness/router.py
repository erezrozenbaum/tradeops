import uuid
from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.retirement_readiness.schemas import ReadinessScore

router = APIRouter()


@router.get("", response_model=ReadinessScore)
def get_retirement_readiness(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    Combines pension projection + Monte Carlo P50 + 4% SWR to produce a 0-100
    retirement readiness score with projected monthly income and gap analysis.
    """
    from app.models.investor_profile import InvestorProfile
    from app.models.investment_account import InvestmentAccount
    from app.portfolio_analysis import service as portfolio_service
    from app.portfolio_analysis import pension_projection
    from app.currency_engine.rates import convert as fx_convert
    from app.scenario_analysis.engine import _monte_carlo
    from app.retirement_readiness.engine import compute_score

    investor = db.get(InvestorProfile, investor_id)
    if not investor:
        raise HTTPException(status_code=404, detail="Investor not found")

    currency = investor.base_currency

    # Age and years to retirement
    today = date_type.today()
    age = today.year - investor.date_of_birth.year - (
        (today.month, today.day) < (investor.date_of_birth.month, investor.date_of_birth.day)
    )

    # Monthly expenses from financial profile (converted to base currency)
    monthly_expenses = 0.0
    fp = investor.financial_profile
    if fp and fp.monthly_expenses > 0:
        monthly_expenses = fx_convert(db, fp.monthly_expenses, fp.currency, currency)

    # Pension projection
    accounts = (
        db.query(InvestmentAccount)
        .filter(InvestmentAccount.investor_id == investor_id)
        .all()
    )

    def _convert(amount: float, from_ccy: str, to_ccy: str) -> float:
        return fx_convert(db, amount, from_ccy, to_ccy)

    pension_result = pension_projection.project(age, accounts, currency, _convert)
    pension_projected = pension_result["total_projected_value"]
    years_to_retirement = pension_result["years_to_retirement"]

    # Portfolio Monte Carlo P50 at retirement horizon
    portfolio = portfolio_service.get_portfolio(db, investor_id)
    portfolio_value = portfolio.total_current_value if portfolio else 0.0

    years_int = max(1, min(int(years_to_retirement), 40))
    mc = _monte_carlo(portfolio_value, years_int)
    portfolio_mc_p50 = mc.percentiles[-1].p50 if mc.percentiles else 0.0

    return compute_score(
        investor_id=investor_id,
        pension_projected=pension_projected,
        portfolio_mc_p50=portfolio_mc_p50,
        monthly_expenses=monthly_expenses,
        years_to_retirement=years_to_retirement,
        currency=currency,
    )

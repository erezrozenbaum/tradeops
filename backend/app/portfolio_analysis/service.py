import uuid

from sqlalchemy.orm import Session

from app.models.investment_account import InvestmentAccount
from app.models.investor_profile import InvestorProfile
from app.currency_engine.rates import convert as fx_convert
from app.portfolio_analysis import engine
from app.portfolio_analysis.schemas import PortfolioSummary


def get_portfolio(db: Session, investor_id: uuid.UUID) -> PortfolioSummary | None:
    investor = db.get(InvestorProfile, investor_id)
    if not investor:
        return None

    accounts = (
        db.query(InvestmentAccount)
        .filter(InvestmentAccount.investor_id == investor_id)
        .all()
    )

    def convert(amount: float, from_currency: str, to_currency: str) -> float:
        return fx_convert(db, amount, from_currency, to_currency)

    return engine.analyze(
        investor_id=investor_id,
        base_currency=investor.base_currency,
        accounts=accounts,
        convert=convert,
    )

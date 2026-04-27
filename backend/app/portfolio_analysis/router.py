import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.investment_account import InvestmentAccount
from app.market_data.service import refresh_tickers
from app.portfolio_analysis import service
from app.portfolio_analysis.schemas import PortfolioSummary

router = APIRouter()


@router.get("", response_model=PortfolioSummary)
def get_portfolio(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    summary = service.get_portfolio(db, investor_id)
    if summary is None:
        raise HTTPException(status_code=404, detail="Investor not found")
    return summary


@router.post("/refresh-prices", response_model=PortfolioSummary)
def refresh_prices(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    """Force-refresh market prices for all tickered holdings, then return updated portfolio."""
    accounts = (
        db.query(InvestmentAccount)
        .filter(InvestmentAccount.investor_id == investor_id)
        .all()
    )
    tickers = {h.ticker for acc in accounts for h in acc.holdings if h.ticker}
    if tickers:
        refresh_tickers(db, tickers)

    summary = service.get_portfolio(db, investor_id)
    if summary is None:
        raise HTTPException(status_code=404, detail="Investor not found")
    return summary

import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.investment_account import InvestmentAccount
from app.models.investor_profile import InvestorProfile
from app.market_data.service import refresh_tickers
from app.currency_engine.rates import force_refresh_rates, convert as fx_convert
from app.portfolio_analysis import service
from app.portfolio_analysis import rebalance_engine
from app.portfolio_analysis import pension_projection
from app.portfolio_analysis.schemas import (
    PortfolioSummary,
    PriceRefreshResult,
    PortfolioHistoryResult,
)
from app.performance_analytics.schemas import PerformanceAnalytics
from app.portfolio_analysis.rebalance_schemas import RebalanceResult
from app.risk_modeling.service import get_latest as get_latest_risk_model

router = APIRouter()


@router.get("", response_model=PortfolioSummary)
def get_portfolio(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    summary = service.get_portfolio(db, investor_id)
    if summary is None:
        raise HTTPException(status_code=404, detail="Investor not found")
    return summary


@router.get("/rebalance", response_model=RebalanceResult)
def get_rebalance(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    portfolio = service.get_portfolio(db, investor_id)
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Investor not found")
    risk_model = get_latest_risk_model(db, investor_id)
    return rebalance_engine.compute_rebalance(
        investor_id=investor_id,
        risk_model=risk_model,
        asset_allocation=portfolio.asset_allocation,
        total_value=portfolio.total_current_value,
        currency=portfolio.base_currency,
    )


@router.post("/refresh-prices", response_model=PriceRefreshResult)
def refresh_prices(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    """Force-refresh market prices for all tickered holdings, return updated portfolio + refresh summary."""
    accounts = (
        db.query(InvestmentAccount)
        .filter(InvestmentAccount.investor_id == investor_id)
        .all()
    )
    tickers = {h.ticker for acc in accounts for h in acc.holdings if h.ticker}

    # Force-refresh FX rates before recomputing portfolio so conversions use today's rate
    investor = db.get(InvestorProfile, investor_id)
    if investor:
        force_refresh_rates(db, investor.base_currency)

    refreshed: list[str] = []
    failed: list[str] = []
    if tickers:
        results = refresh_tickers(db, tickers)
        refreshed = sorted(results.keys())
        failed = sorted(t for t in tickers if t not in results)

    summary = service.get_portfolio(db, investor_id)
    if summary is None:
        raise HTTPException(status_code=404, detail="Investor not found")

    if summary.total_current_value > 0:
        service.save_snapshot(db, summary)

    return PriceRefreshResult(
        portfolio=summary,
        tickers_refreshed=refreshed,
        tickers_failed=failed,
        cache_valid_until=datetime.now(timezone.utc) + timedelta(hours=24),
    )


@router.get("/analytics", response_model=PerformanceAnalytics)
def get_portfolio_analytics(
    investor_id: uuid.UUID,
    period: str = "3m",
    db: Session = Depends(get_db),
):
    """Compute Sharpe, Sortino, max drawdown, annualised return, and SPY benchmark comparison."""
    from app.performance_analytics.engine import compute as compute_analytics
    from app.models.investor_profile import InvestorProfile

    period_days: dict[str, int | None] = {
        "1m": 31, "3m": 92, "6m": 183, "1y": 366, "all": None,
    }
    days = period_days.get(period, 92)
    since = datetime.now(timezone.utc) - timedelta(days=days) if days else None
    snapshots = service.get_history(db, investor_id, since=since)

    investor = db.get(InvestorProfile, investor_id)
    currency = investor.base_currency if investor else "USD"

    return compute_analytics(snapshots, investor_id=investor_id, currency=currency)


@router.get("/pension-projection")
def get_pension_projection(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    investor = db.get(InvestorProfile, investor_id)
    if not investor:
        raise HTTPException(status_code=404, detail="Investor not found")

    today = date.today()
    age = today.year - investor.date_of_birth.year - (
        (today.month, today.day) < (investor.date_of_birth.month, investor.date_of_birth.day)
    )

    accounts = (
        db.query(InvestmentAccount)
        .filter(InvestmentAccount.investor_id == investor_id)
        .all()
    )

    def convert_fn(amount: float, from_ccy: str, to_ccy: str) -> float:
        return fx_convert(db, amount, from_ccy, to_ccy)

    return pension_projection.project(age, accounts, investor.base_currency, convert_fn)


@router.get("/history", response_model=PortfolioHistoryResult)
def get_portfolio_history(
    investor_id: uuid.UUID,
    period: str = "3m",
    db: Session = Depends(get_db),
):
    """Return historical portfolio value snapshots for the given period.

    period: 1m | 3m | 6m | 1y | all
    """
    period_days: dict[str, int | None] = {
        "1m": 31, "3m": 92, "6m": 183, "1y": 366, "all": None,
    }
    days = period_days.get(period, 92)
    since = datetime.now(timezone.utc) - timedelta(days=days) if days else None
    snapshots = service.get_history(db, investor_id, since=since)
    return PortfolioHistoryResult(investor_id=investor_id, snapshots=snapshots)

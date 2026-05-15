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
from app.portfolio_analysis import options_engine
from app.portfolio_analysis.schemas import (
    PortfolioSummary,
    PriceRefreshResult,
    PortfolioHistoryResult,
)
from app.performance_analytics.schemas import PerformanceAnalytics, AttributionResult, LazyPortfolioComparison
from app.scenario_analysis.schemas import StressTestResult
from app.income_projection.schemas import IncomeResult
from app.portfolio_analysis.rebalance_schemas import RebalanceResult
from app.tax_harvesting.schemas import TaxOpportunityResult
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

    # Build HoldingInfo list for suggested trades (ticker, live price in base currency)
    from app.portfolio_analysis.rebalance_engine import HoldingInfo
    holdings_info: list[HoldingInfo] = []
    for acc in portfolio.accounts:
        for h in acc.holdings:
            if not h.ticker:
                continue
            # Derive unit price in base currency from live price + fx
            unit_price_base: float | None = None
            if h.live_price is not None and h.live_price_currency:
                unit_price_base = fx_convert(db, h.live_price, h.live_price_currency, portfolio.base_currency)
            holdings_info.append(HoldingInfo(
                ticker=h.ticker,
                name=h.name,
                asset_type=h.asset_type,
                current_value_base=h.current_value_base,
                unit_price_base=unit_price_base,
            ))

    return rebalance_engine.compute_rebalance(
        investor_id=investor_id,
        risk_model=risk_model,
        asset_allocation=portfolio.asset_allocation,
        total_value=portfolio.total_current_value,
        currency=portfolio.base_currency,
        holdings=holdings_info or None,
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

    # Build cash flow list for MWR/IRR: (date, total_amount) for each buy transaction
    from app.models.holding_transaction import HoldingTransaction
    from app.currency_engine.rates import convert as _fx_convert

    buy_txs = (
        db.query(HoldingTransaction)
        .filter(
            HoldingTransaction.investor_id == investor_id,
            HoldingTransaction.transaction_type == "buy",
        )
        .order_by(HoldingTransaction.transaction_date)
        .all()
    )
    cash_flows: list[tuple[datetime, float]] = []
    for tx in buy_txs:
        paid_base = _fx_convert(db, tx.total_amount, tx.currency, currency)
        dt = datetime(tx.transaction_date.year, tx.transaction_date.month, tx.transaction_date.day, tzinfo=timezone.utc)
        cash_flows.append((dt, paid_base))

    return compute_analytics(snapshots, investor_id=investor_id, currency=currency, cash_flows=cash_flows or None)


@router.get("/attribution", response_model=AttributionResult)
def get_portfolio_attribution(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    """Holding-level performance attribution + rolling returns (1M/3M/6M/1Y) + benchmark alpha."""
    from app.performance_analytics.attribution import compute_attribution
    from app.models.investor_profile import InvestorProfile

    all_snapshots = service.get_history(db, investor_id, since=None)
    portfolio = service.get_portfolio(db, investor_id)
    investor = db.get(InvestorProfile, investor_id)
    currency = investor.base_currency if investor else "USD"

    return compute_attribution(all_snapshots, portfolio, investor_id, currency)


@router.get("/income", response_model=IncomeResult)
def get_income(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    """Dividend income projection for all tickered holdings."""
    from app.income_projection.service import compute_income
    from app.models.investor_profile import InvestorProfile

    portfolio = service.get_portfolio(db, investor_id)
    investor = db.get(InvestorProfile, investor_id)
    currency = investor.base_currency if investor else "USD"

    return compute_income(portfolio, investor_id, currency, db)


@router.get("/stress-test", response_model=StressTestResult)
def get_stress_test(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    """Apply historical crash scenarios to current portfolio + Monte Carlo projection."""
    from app.scenario_analysis.engine import compute as compute_stress
    from app.models.investor_profile import InvestorProfile
    from datetime import date as date_type

    portfolio = service.get_portfolio(db, investor_id)
    investor = db.get(InvestorProfile, investor_id)
    currency = investor.base_currency if investor else "USD"

    years = 20
    if investor and investor.date_of_birth:
        today = date_type.today()
        age = today.year - investor.date_of_birth.year - (
            (today.month, today.day) < (investor.date_of_birth.month, investor.date_of_birth.day)
        )
        years = max(1, 65 - age)  # years to standard retirement

    return compute_stress(portfolio, investor_id, currency, years_to_retirement=years)


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


@router.get("/complexity-premium", response_model=LazyPortfolioComparison)
def get_complexity_premium(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    """Compare portfolio return vs a passive 60/40 lazy portfolio (VT + AGG).

    Returns the 'Complexity Premium' — how much (or little) the investor earned
    above a dead-simple index strategy over the same window.
    Requires 30+ days of portfolio snapshots; returns data_gate_passed=False otherwise.
    """
    from app.performance_analytics.engine import compute as compute_analytics
    from app.performance_analytics.lazy_portfolio import fetch_lazy_returns, build_comparison
    from app.models.investor_profile import InvestorProfile

    investor = db.get(InvestorProfile, investor_id)
    currency = investor.base_currency if investor else "USD"

    all_snapshots = service.get_history(db, investor_id, since=None)
    analytics = compute_analytics(all_snapshots, investor_id=investor_id, currency=currency)

    start_dt = all_snapshots[0].snapshot_at if all_snapshots else None
    end_dt = all_snapshots[-1].snapshot_at if all_snapshots else None

    if start_dt and start_dt.tzinfo is None:
        start_dt = start_dt.replace(tzinfo=__import__("datetime").timezone.utc)
    if end_dt and end_dt.tzinfo is None:
        end_dt = end_dt.replace(tzinfo=__import__("datetime").timezone.utc)

    vt_ret = agg_ret = None
    if start_dt and end_dt and analytics.period_days >= 30:
        vt_ret, agg_ret = fetch_lazy_returns(start_dt, end_dt)

    return build_comparison(
        investor_id=investor_id,
        currency=currency,
        snapshot_days=analytics.period_days,
        portfolio_return_pct=analytics.total_return_pct,
        portfolio_sharpe=analytics.sharpe_ratio,
        vt_return_pct=vt_ret,
        agg_return_pct=agg_ret,
    )


@router.get("/tax-opportunities", response_model=TaxOpportunityResult)
def get_tax_opportunities(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    """Identify tax-loss harvesting opportunities in the current portfolio."""
    from app.tax_harvesting.service import compute_opportunities
    from app.models.investor_profile import InvestorProfile

    portfolio = service.get_portfolio(db, investor_id)
    investor = db.get(InvestorProfile, investor_id)
    country = investor.country if investor else "US"

    return compute_opportunities(portfolio, investor_id, country)


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


@router.get("/insights")
def get_proactive_insights(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    """Run drift detection and return AI-narrated insights with rebalancing actions.

    - Ticker concentration > 20%: single-asset exposure alert
    - Risk tier drift > 5%: rebalancing needed
    - Options expiring within 30 days: expiry warning (short positions flagged as danger)
    - Options P&L uses contract_multiplier for exposure calculation
    Calls Claude (haiku) to narrate each event if ANTHROPIC_API_KEY is set.
    """
    from app.core.config import settings
    from app.proactive_insights.engine import detect_drift, generate_insights

    if settings.ANTHROPIC_API_KEY:
        report = generate_insights(db, investor_id, settings.ANTHROPIC_API_KEY)
    else:
        report = detect_drift(db, investor_id)

    return {
        "investor_id": str(report.investor_id),
        "base_currency": report.base_currency,
        "total_portfolio_value": report.total_portfolio_value,
        "drift_events": [
            {
                "event_id": e.event_id,
                "event_type": e.event_type,
                "severity": e.severity,
                "ticker": e.ticker,
                "name": e.name,
                "value_pct": e.value_pct,
                "delta_pct": e.delta_pct,
                "tier": e.tier,
                "days_to_expiry": e.days_to_expiry,
                **e.data,
            }
            for e in report.drift_events
        ],
        "insights": [
            {"event_id": i.event_id, "insight": i.insight, "action": i.action}
            for i in report.insights
        ],
        "has_alerts": len(report.drift_events) > 0,
    }


@router.get("/fx-impact")
def get_fx_impact(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    """Decompose portfolio P&L into asset P&L (price change) and currency P&L (FX shift).

    Requires purchase_fx_rate to be captured on holding creation (auto-populated since v0.64).
    Holdings created before v0.64 will show fx_data_available=false.
    Options positions use contract_multiplier in cost basis calculation.
    """
    from app.fx_impact.engine import compute as compute_fx_impact
    result = compute_fx_impact(db, investor_id)
    return {
        "investor_id": str(result.investor_id),
        "base_currency": result.base_currency,
        "total_cost_basis": result.total_cost_basis,
        "total_asset_pnl": result.total_asset_pnl,
        "total_fx_pnl": result.total_fx_pnl,
        "total_pnl": result.total_pnl,
        "holdings_missing_fx_data": result.holdings_missing_fx_data,
        "holdings": [
            {
                "holding_id": h.holding_id,
                "name": h.name,
                "ticker": h.ticker,
                "asset_type": h.asset_type,
                "currency": h.currency,
                "quantity": h.quantity,
                "avg_buy_price": h.avg_buy_price,
                "purchase_fx_rate": h.purchase_fx_rate,
                "current_fx_rate": h.current_fx_rate,
                "cost_basis_local": h.cost_basis_local,
                "cost_basis_base": h.cost_basis_base,
                "current_value_base": h.current_value_base,
                "asset_pnl": h.asset_pnl,
                "fx_pnl": h.fx_pnl,
                "total_pnl": h.total_pnl,
                "asset_pnl_pct": h.asset_pnl_pct,
                "fx_pnl_pct": h.fx_pnl_pct,
                "same_currency": h.same_currency,
                "fx_data_available": h.fx_data_available,
            }
            for h in result.holdings
        ],
    }


@router.get("/options")
def get_options_summary(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    """Return all options positions with P&L, expiry info, and risk warnings."""
    _OPTION_TYPES = {"call_option", "put_option"}

    accounts = (
        db.query(InvestmentAccount)
        .filter(InvestmentAccount.investor_id == investor_id)
        .all()
    )

    positions = []
    for acc in accounts:
        for h in acc.holdings:
            if h.asset_type in _OPTION_TYPES:
                pos = options_engine.compute_position(h)
                pos["account_name"] = acc.account_name or acc.provider_name
                positions.append(pos)

    total_cost_basis = sum(p["cost_basis"] for p in positions)
    total_current_value = sum(p["current_value"] for p in positions if p["current_value"] is not None)
    total_unrealized_pnl = sum(p["unrealized_pnl"] for p in positions if p["unrealized_pnl"] is not None)
    expiring_soon = [p for p in positions if p.get("days_to_expiry") is not None and p["days_to_expiry"] <= 30]
    has_short = any(p["max_loss_unlimited"] for p in positions)

    return {
        "positions": positions,
        "total_positions": len(positions),
        "total_cost_basis": round(total_cost_basis, 2),
        "total_current_value": round(total_current_value, 2),
        "total_unrealized_pnl": round(total_unrealized_pnl, 2),
        "expiring_soon_count": len(expiring_soon),
        "has_short_positions": has_short,
    }

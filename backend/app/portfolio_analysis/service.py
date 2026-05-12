import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.investment_account import InvestmentAccount
from app.models.investor_profile import InvestorProfile
from app.currency_engine.rates import convert as fx_convert
from app.market_data.service import get_cached_price
from app.portfolio_analysis import engine
from app.portfolio_analysis.schemas import PortfolioSummary, PortfolioSnapshotPoint


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

    # Build live price map from cached snapshots (no network call — read-only)
    tickers = {h.ticker for acc in accounts for h in acc.holdings if h.ticker}
    live_prices: dict[str, tuple[float, str]] = {}
    prices_updated_at = None
    for ticker in tickers:
        snapshot = get_cached_price(db, ticker)
        if snapshot:
            live_prices[ticker] = (snapshot.price, snapshot.currency)
            fetched = snapshot.fetched_at
            if fetched.tzinfo is None:
                from datetime import timezone as _tz
                fetched = fetched.replace(tzinfo=_tz.utc)
            if prices_updated_at is None or fetched < prices_updated_at:
                prices_updated_at = fetched  # track the oldest (most stale) live price

    return engine.analyze(
        investor_id=investor_id,
        base_currency=investor.base_currency,
        accounts=accounts,
        convert=convert,
        live_prices=live_prices or None,
        prices_updated_at=prices_updated_at,
    )


def save_snapshot(db: Session, portfolio: PortfolioSummary) -> None:
    from app.models.portfolio_snapshot import PortfolioSnapshot
    snap = PortfolioSnapshot(
        id=uuid.uuid4(),
        investor_id=portfolio.investor_id,
        total_value=portfolio.total_current_value,
        cost_basis=portfolio.total_cost_basis,
        unrealized_pnl=portfolio.unrealized_pnl,
        unrealized_pnl_pct=portfolio.unrealized_pnl_pct,
        currency=portfolio.base_currency,
        asset_allocation=portfolio.asset_allocation,
        snapshot_at=datetime.now(timezone.utc),
    )
    db.add(snap)
    db.commit()


def get_history(
    db: Session,
    investor_id: uuid.UUID,
    since: datetime | None = None,
    limit: int = 500,
) -> list[PortfolioSnapshotPoint]:
    from app.models.portfolio_snapshot import PortfolioSnapshot
    q = (
        db.query(PortfolioSnapshot)
        .filter(PortfolioSnapshot.investor_id == investor_id)
    )
    if since:
        q = q.filter(PortfolioSnapshot.snapshot_at >= since)
    rows = q.order_by(PortfolioSnapshot.snapshot_at.desc()).limit(limit).all()
    return [
        PortfolioSnapshotPoint(
            snapshot_at=s.snapshot_at,
            total_value=s.total_value,
            cost_basis=s.cost_basis,
            unrealized_pnl=s.unrealized_pnl,
            unrealized_pnl_pct=s.unrealized_pnl_pct,
            currency=s.currency,
        )
        for s in reversed(rows)
    ]


def has_snapshot_today(db: Session, investor_id: uuid.UUID) -> bool:
    from app.models.portfolio_snapshot import PortfolioSnapshot
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return db.query(PortfolioSnapshot).filter(
        PortfolioSnapshot.investor_id == investor_id,
        PortfolioSnapshot.snapshot_at >= today_start,
    ).first() is not None

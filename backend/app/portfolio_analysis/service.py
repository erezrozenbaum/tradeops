import uuid
from datetime import date as _date, datetime, timezone
from typing import Callable

from sqlalchemy.orm import Session

from app.models.investment_account import InvestmentAccount
from app.models.investor_profile import InvestorProfile
from app.currency_engine.rates import convert as fx_convert
from app.market_data.service import get_cached_price
from app.portfolio_analysis import engine
from app.portfolio_analysis.schemas import PortfolioSummary, PortfolioSnapshotPoint


def _compute_realized_pnl(
    db: Session,
    investor_id: uuid.UUID,
    convert: Callable[[float, str, str], float],
    base_currency: str,
) -> tuple[float, float]:
    """Compute realized P&L from sell transactions using WAVG cost basis.

    Returns (realized_pnl_total, realized_pnl_ytd) in base currency.
    """
    from app.models.holding_transaction import HoldingTransaction

    today = _date.today()
    year_start = _date(today.year, 1, 1)

    txs = (
        db.query(HoldingTransaction)
        .filter(
            HoldingTransaction.investor_id == investor_id,
            HoldingTransaction.transaction_type.in_(["buy", "sell"]),
        )
        .order_by(HoldingTransaction.transaction_date)
        .all()
    )

    # Per-ticker running state: (total_qty, total_cost_in_base)
    ticker_state: dict[str, tuple[float, float]] = {}
    realized_total = 0.0
    realized_ytd = 0.0

    for tx in txs:
        if not tx.ticker or not tx.quantity or tx.quantity <= 0:
            continue
        cur = tx.currency or base_currency
        ticker = tx.ticker

        if tx.transaction_type == "buy":
            cost_base = convert(tx.total_amount, cur, base_currency)
            prev_qty, prev_cost = ticker_state.get(ticker, (0.0, 0.0))
            ticker_state[ticker] = (prev_qty + tx.quantity, prev_cost + cost_base)

        elif tx.transaction_type == "sell":
            prev_qty, prev_cost = ticker_state.get(ticker, (0.0, 0.0))
            if prev_qty <= 0:
                continue
            wavg_cost_per_unit = prev_cost / prev_qty
            sold_cost = wavg_cost_per_unit * tx.quantity
            proceeds_base = convert(tx.total_amount - tx.fees, cur, base_currency)
            pnl = proceeds_base - sold_cost

            new_qty = max(0.0, prev_qty - tx.quantity)
            new_cost = max(0.0, prev_cost - sold_cost)
            ticker_state[ticker] = (new_qty, new_cost)

            realized_total += pnl
            if tx.transaction_date >= year_start:
                realized_ytd += pnl

    return round(realized_total, 2), round(realized_ytd, 2)


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

    realized_pnl_total, realized_pnl_ytd = _compute_realized_pnl(
        db, investor_id, convert, investor.base_currency
    )

    return engine.analyze(
        investor_id=investor_id,
        base_currency=investor.base_currency,
        accounts=accounts,
        convert=convert,
        live_prices=live_prices or None,
        prices_updated_at=prices_updated_at,
        realized_pnl_total=realized_pnl_total,
        realized_pnl_ytd=realized_pnl_ytd,
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

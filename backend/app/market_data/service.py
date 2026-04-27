"""Market data service — price snapshots with 24h TTL cache."""
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.price_snapshot import PriceSnapshot
from app.market_data.fetcher import fetch_quote

_CACHE_TTL_HOURS = 24


def _is_fresh(snapshot: PriceSnapshot) -> bool:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=_CACHE_TTL_HOURS)
    fetched = snapshot.fetched_at
    if fetched.tzinfo is None:
        fetched = fetched.replace(tzinfo=timezone.utc)
    return fetched >= cutoff


def get_cached_price(db: Session, ticker: str) -> PriceSnapshot | None:
    """Return a fresh cached snapshot, or None if stale / absent."""
    snapshot = (
        db.query(PriceSnapshot)
        .filter(PriceSnapshot.ticker == ticker)
        .order_by(PriceSnapshot.fetched_at.desc())
        .first()
    )
    if snapshot and _is_fresh(snapshot):
        return snapshot
    return None


def fetch_and_cache(db: Session, ticker: str) -> PriceSnapshot | None:
    """Fetch a fresh quote from Alpha Vantage and upsert into price_snapshots."""
    result = fetch_quote(ticker)
    if result is None:
        return None

    price, currency = result

    snapshot = (
        db.query(PriceSnapshot)
        .filter(PriceSnapshot.ticker == ticker)
        .order_by(PriceSnapshot.fetched_at.desc())
        .first()
    )

    if snapshot:
        snapshot.price = price
        snapshot.currency = currency
        snapshot.fetched_at = datetime.now(timezone.utc)
    else:
        snapshot = PriceSnapshot(
            id=uuid.uuid4(),
            ticker=ticker,
            price=price,
            currency=currency,
            fetched_at=datetime.now(timezone.utc),
        )
        db.add(snapshot)

    db.commit()
    db.refresh(snapshot)
    return snapshot


def get_or_fetch(db: Session, ticker: str) -> PriceSnapshot | None:
    """Return cached snapshot if fresh; otherwise fetch and cache."""
    cached = get_cached_price(db, ticker)
    if cached:
        return cached
    return fetch_and_cache(db, ticker)


def refresh_tickers(db: Session, tickers: set[str]) -> dict[str, tuple[float, str]]:
    """Force-refresh all given tickers. Returns {ticker: (price, currency)}."""
    result: dict[str, tuple[float, str]] = {}
    for ticker in tickers:
        snapshot = fetch_and_cache(db, ticker)
        if snapshot:
            result[ticker] = (snapshot.price, snapshot.currency)
    return result

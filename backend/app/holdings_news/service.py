"""Fetches recent news for an investor's held and watched tickers via yfinance."""
import logging
import time
import uuid
from datetime import datetime, timezone

import yfinance as yf
from sqlalchemy.orm import Session

from app.holdings_news.schemas import NewsFeedResult, NewsItem
from app.models.investment_account import InvestmentAccount
from app.models.investor_profile import InvestorProfile
from app.models.watchlist import WatchlistItem

log = logging.getLogger(__name__)

_CACHE: dict[str, tuple[list[dict], float]] = {}
_CACHE_TTL = 3_600  # 1 hour


def _fetch_news(ticker: str) -> list[dict]:
    cached = _CACHE.get(ticker)
    if cached and (time.time() - cached[1]) < _CACHE_TTL:
        return cached[0]
    try:
        items = yf.Ticker(ticker).news or []
        _CACHE[ticker] = (items, time.time())
        return items
    except Exception as exc:
        log.debug("[holdings_news] Failed to fetch news for %s: %s", ticker, exc)
        _CACHE[ticker] = ([], time.time())
        return []


def get_news(db: Session, investor_id: uuid.UUID, limit: int = 20) -> NewsFeedResult | None:
    investor = db.get(InvestorProfile, investor_id)
    if not investor:
        return None

    accounts = (
        db.query(InvestmentAccount)
        .filter(InvestmentAccount.investor_id == investor_id)
        .all()
    )
    holding_tickers: set[str] = {
        h.ticker.upper()
        for acc in accounts
        for h in acc.holdings
        if h.ticker
    }

    watchlist_items = (
        db.query(WatchlistItem)
        .filter(WatchlistItem.investor_id == investor_id)
        .all()
    )
    watchlist_tickers: set[str] = {w.ticker.upper() for w in watchlist_items}

    all_tickers: dict[str, str] = {}
    for t in watchlist_tickers:
        all_tickers[t] = "watchlist"
    for t in holding_tickers:
        all_tickers[t] = "holdings"

    items: list[NewsItem] = []
    for ticker, source in sorted(all_tickers.items()):
        raw_items = _fetch_news(ticker)
        for raw in raw_items:
            try:
                ts = raw.get("providerPublishTime")
                published_at = datetime.fromtimestamp(ts, tz=timezone.utc) if ts else None
                items.append(NewsItem(
                    ticker=ticker,
                    title=raw.get("title", ""),
                    publisher=raw.get("publisher", ""),
                    url=raw.get("link", ""),
                    published_at=published_at,
                    summary=raw.get("summary"),
                    source=source,
                ))
            except Exception:
                pass

    # Sort by date descending, most recent first
    items.sort(key=lambda x: x.published_at or datetime.min.replace(tzinfo=timezone.utc), reverse=True)

    return NewsFeedResult(
        investor_id=investor_id,
        items=items[:limit],
        tickers_checked=len(all_tickers),
    )

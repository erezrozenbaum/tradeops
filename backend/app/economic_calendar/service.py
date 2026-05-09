"""Fetches upcoming earnings dates for an investor's held and watched tickers."""
import logging
import time
import uuid
from datetime import date, datetime, timezone

import yfinance as yf
from sqlalchemy.orm import Session

from app.economic_calendar.schemas import CalendarResult, EarningsEvent
from app.models.investment_account import InvestmentAccount
from app.models.investor_profile import InvestorProfile
from app.models.watchlist import WatchlistItem

log = logging.getLogger(__name__)

_CACHE: dict[str, tuple[EarningsEvent | None, float]] = {}
_CACHE_TTL = 86_400  # 24 hours


def _fetch_earnings(ticker: str, source: str) -> EarningsEvent | None:
    cached = _CACHE.get(ticker)
    if cached and (time.time() - cached[1]) < _CACHE_TTL:
        ev = cached[0]
        if ev:
            return ev.model_copy(update={"source": source})
        return None

    try:
        info = yf.Ticker(ticker).info
        company_name = info.get("shortName") or info.get("longName") or ticker

        cal = yf.Ticker(ticker).calendar
        earnings_date: date | None = None
        eps_est: float | None = None
        rev_est: float | None = None

        if cal is not None and not (hasattr(cal, "empty") and cal.empty):
            if isinstance(cal, dict):
                raw = cal.get("Earnings Date")
                if raw:
                    if isinstance(raw, list) and raw:
                        raw = raw[0]
                    if hasattr(raw, "date"):
                        earnings_date = raw.date()
                    elif isinstance(raw, str):
                        try:
                            earnings_date = datetime.strptime(raw[:10], "%Y-%m-%d").date()
                        except Exception:
                            pass
                eps_est = cal.get("EPS Estimate")
                rev_raw = cal.get("Revenue Estimate")
                if rev_raw:
                    rev_est = round(float(rev_raw) / 1_000_000, 1)
            else:
                # DataFrame format
                try:
                    if "Earnings Date" in cal.columns:
                        raw = cal["Earnings Date"].iloc[0]
                        if hasattr(raw, "date"):
                            earnings_date = raw.date()
                    if "EPS Estimate" in cal.columns:
                        eps_est = float(cal["EPS Estimate"].iloc[0])
                    if "Revenue Estimate" in cal.columns:
                        rev_raw = float(cal["Revenue Estimate"].iloc[0])
                        rev_est = round(rev_raw / 1_000_000, 1)
                except Exception:
                    pass

        ev = EarningsEvent(
            ticker=ticker,
            company_name=company_name,
            earnings_date=earnings_date,
            eps_estimate=eps_est,
            revenue_estimate=rev_est,
            source=source,
        )
        _CACHE[ticker] = (ev, time.time())
        return ev
    except Exception as exc:
        log.debug("[economic_calendar] Failed to fetch %s: %s", ticker, exc)
        _CACHE[ticker] = (None, time.time())
        return None


def get_calendar(db: Session, investor_id: uuid.UUID) -> CalendarResult | None:
    investor = db.get(InvestorProfile, investor_id)
    if not investor:
        return None

    # Gather tickers from holdings
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

    # Gather tickers from watchlist
    watchlist_items = (
        db.query(WatchlistItem)
        .filter(WatchlistItem.investor_id == investor_id)
        .all()
    )
    watchlist_tickers: set[str] = {w.ticker.upper() for w in watchlist_items}

    # Merge: holdings take priority for source label
    all_tickers: dict[str, str] = {}
    for t in watchlist_tickers:
        all_tickers[t] = "watchlist"
    for t in holding_tickers:
        all_tickers[t] = "holdings"

    today = date.today()
    events: list[EarningsEvent] = []

    for ticker, source in sorted(all_tickers.items()):
        ev = _fetch_earnings(ticker, source)
        if ev and ev.earnings_date and ev.earnings_date >= today:
            events.append(ev)

    # Sort by date ascending
    events.sort(key=lambda e: e.earnings_date)  # type: ignore[arg-type]

    return CalendarResult(
        investor_id=investor_id,
        events=events,
        tickers_checked=len(all_tickers),
        tickers_with_dates=len(events),
    )

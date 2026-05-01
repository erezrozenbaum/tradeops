"""Multi-provider price fetcher.

- Alpha Vantage (GLOBAL_QUOTE): US / global tickers
- Yahoo Finance (chart API): TASE tickers (suffix .TA), no API key required

Provider selection is automatic: tickers ending with .TA use Yahoo Finance;
all others use Alpha Vantage.
"""
import logging

import httpx

from app.core.config import settings

log = logging.getLogger(__name__)

_AV_URL = "https://www.alphavantage.co/query"
_YF_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
_YF_HEADERS = {"User-Agent": "Mozilla/5.0"}


def _fetch_alpha_vantage(ticker: str) -> tuple[float, str] | None:
    api_key = settings.ALPHA_VANTAGE_API_KEY
    if not api_key:
        log.warning("ALPHA_VANTAGE_API_KEY not set — skipping price fetch for %s", ticker)
        return None

    try:
        resp = httpx.get(
            _AV_URL,
            params={"function": "GLOBAL_QUOTE", "symbol": ticker, "apikey": api_key},
            timeout=10.0,
        )
        resp.raise_for_status()
        data = resp.json()
        quote = data.get("Global Quote", {})
        price_str = quote.get("05. price", "")
        if not price_str:
            log.warning("No price in Alpha Vantage response for %s: %s", ticker, data)
            return None
        return float(price_str), "USD"
    except Exception as exc:  # noqa: BLE001
        log.error("Alpha Vantage fetch failed for %s: %s", ticker, exc)
        return None


def _fetch_yahoo_finance(ticker: str) -> tuple[float, str] | None:
    """Fetch via Yahoo Finance chart API — free, no key. Used for TASE (.TA) tickers."""
    try:
        url = _YF_URL.format(ticker=ticker)
        resp = httpx.get(
            url,
            params={"interval": "1d", "range": "1d"},
            headers=_YF_HEADERS,
            timeout=10.0,
        )
        resp.raise_for_status()
        data = resp.json()
        results = (data.get("chart") or {}).get("result") or []
        if not results:
            log.warning("No Yahoo Finance result for %s: %s", ticker, data)
            return None
        meta = results[0].get("meta", {})
        price = meta.get("regularMarketPrice")
        currency = meta.get("currency", "ILS")
        if price is None:
            log.warning("No price in Yahoo Finance response for %s", ticker)
            return None
        return float(price), currency
    except Exception as exc:  # noqa: BLE001
        log.error("Yahoo Finance fetch failed for %s: %s", ticker, exc)
        return None


def fetch_quote(ticker: str) -> tuple[float, str] | None:
    """Fetch latest price. Routes .TA tickers to Yahoo Finance, others to Alpha Vantage.

    Returns (price, currency) or None on failure.
    """
    if ticker.upper().endswith(".TA"):
        return _fetch_yahoo_finance(ticker)
    return _fetch_alpha_vantage(ticker)

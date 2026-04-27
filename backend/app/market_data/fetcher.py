"""Alpha Vantage GLOBAL_QUOTE fetcher.

Returns (price, currency) or None on failure.
All US-listed securities are priced in USD.
"""
import logging

import httpx

from app.core.config import settings

log = logging.getLogger(__name__)

_AV_URL = "https://www.alphavantage.co/query"


def fetch_quote(ticker: str) -> tuple[float, str] | None:
    """Fetch latest price from Alpha Vantage GLOBAL_QUOTE.

    Returns (price, "USD") or None if unavailable / not configured.
    """
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

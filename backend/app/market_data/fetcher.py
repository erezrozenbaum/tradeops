"""Multi-provider price fetcher.

Provider routing:
1. Crypto tickers → CoinGecko (free, no key, accurate real-time prices)
2. Stocks / ETFs / TASE (.TA) → Yahoo Finance chart API (free, no key)
3. Alpha Vantage (GLOBAL_QUOTE) → fallback for tickers Yahoo Finance can't resolve

Ticker normalization applied before routing:
- Crypto names/symbols → CoinGecko ID lookup
- TASE "TLV: SYMBOL" → "SYMBOL.TA"
"""
import logging

import httpx

from app.core.config import settings

log = logging.getLogger(__name__)

_AV_URL = "https://www.alphavantage.co/query"
_YF_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
_YF_HEADERS = {"User-Agent": "Mozilla/5.0"}
_CG_URL = "https://api.coingecko.com/api/v3/simple/price"

# Maps user-entered crypto names/tickers (lowercased) → CoinGecko coin ID.
# Includes full names, short symbols, and normalized "-USD" forms.
_COINGECKO_ID_MAP: dict[str, str] = {
    # Bitcoin
    "bitcoin": "bitcoin",
    "btc": "bitcoin",
    "btc-usd": "bitcoin",
    # Ethereum
    "ethereum": "ethereum",
    "eth": "ethereum",
    "eth-usd": "ethereum",
    # XRP / Ripple
    "xrp": "ripple",
    "xrp-usd": "ripple",
    "ripple": "ripple",
    # Solana
    "solana": "solana",
    "sol": "solana",
    "sol-usd": "solana",
    # Dogecoin
    "dogecoin": "dogecoin",
    "doge": "dogecoin",
    "doge-usd": "dogecoin",
    # Cardano
    "cardano": "cardano",
    "ada": "cardano",
    "ada-usd": "cardano",
    # Litecoin
    "litecoin": "litecoin",
    "ltc": "litecoin",
    "ltc-usd": "litecoin",
    # BNB
    "binancecoin": "binancecoin",
    "bnb": "binancecoin",
    "bnb-usd": "binancecoin",
    # Avalanche
    "avalanche": "avalanche-2",
    "avax": "avalanche-2",
    "avax-usd": "avalanche-2",
    # Polygon
    "polygon": "matic-network",
    "matic": "matic-network",
    "matic-usd": "matic-network",
    # Polkadot
    "polkadot": "polkadot",
    "dot": "polkadot",
    "dot-usd": "polkadot",
    # Stellar
    "stellar": "stellar",
    "xlm": "stellar",
    "xlm-usd": "stellar",
    # Cosmos
    "cosmos": "cosmos",
    "atom": "cosmos",
    "atom-usd": "cosmos",
    # Algorand
    "algorand": "algorand",
    "algo": "algorand",
    "algo-usd": "algorand",
    # Monero
    "monero": "monero",
    "xmr": "monero",
    "xmr-usd": "monero",
    # Uniswap
    "uniswap": "uniswap",
    "uni": "uniswap",
    "uni-usd": "uniswap",
    # Shiba Inu
    "shiba-inu": "shiba-inu",
    "shiba inu": "shiba-inu",
    "shibainu": "shiba-inu",
    "shib": "shiba-inu",
    "shib-usd": "shiba-inu",
    # Chainlink
    "chainlink": "chainlink",
    "link": "chainlink",
    "link-usd": "chainlink",
}

# Maps user-entered strings to normalized fetchable tickers for non-crypto assets.
# TASE "TLV: SYMBOL" → "SYMBOL.TA" handled separately below.
_CRYPTO_NAMES: set[str] = {k for k in _COINGECKO_ID_MAP}


def _normalize_ticker(raw: str) -> str:
    """Normalize user-entered ticker for non-crypto assets.

    - TASE "TLV: LUMI" → "LUMI.TA"
    - Returns stripped raw ticker unchanged for everything else.
    """
    stripped = raw.strip()
    lower = stripped.lower()

    # TASE "TLV: LUMI" → "LUMI.TA"
    if lower.startswith("tlv:"):
        symbol = stripped[4:].strip()
        if symbol:
            return f"{symbol}.TA"

    return stripped


def _coingecko_id(ticker: str) -> str | None:
    """Return CoinGecko ID for a crypto ticker/name, or None if not recognized."""
    lower = ticker.strip().lower()
    return _COINGECKO_ID_MAP.get(lower)


def _fetch_coingecko(coin_id: str) -> tuple[float, str] | None:
    """Fetch price from CoinGecko. Free tier: ~30 calls/min, no daily cap."""
    try:
        resp = httpx.get(
            _CG_URL,
            params={"ids": coin_id, "vs_currencies": "usd"},
            timeout=10.0,
        )
        resp.raise_for_status()
        data = resp.json()
        price = (data.get(coin_id) or {}).get("usd")
        if price is None:
            log.warning("No CoinGecko price for %s", coin_id)
            return None
        return float(price), "USD"
    except Exception as exc:  # noqa: BLE001
        log.error("CoinGecko fetch failed for %s: %s", coin_id, exc)
        return None


def _fetch_yahoo_finance(ticker: str) -> tuple[float, str] | None:
    """Fetch via Yahoo Finance chart API. Covers US stocks, ETFs, and TASE (.TA)."""
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
            log.warning("No Yahoo Finance result for %s", ticker)
            return None
        meta = results[0].get("meta", {})
        price = meta.get("regularMarketPrice")
        currency = meta.get("currency", "USD")
        if price is None:
            log.warning("No price in Yahoo Finance response for %s", ticker)
            return None
        return float(price), currency
    except Exception as exc:  # noqa: BLE001
        log.error("Yahoo Finance fetch failed for %s: %s", ticker, exc)
        return None


def _fetch_alpha_vantage(ticker: str) -> tuple[float, str] | None:
    """Fallback provider. Free tier: 25 calls/day, 5 calls/minute."""
    api_key = settings.ALPHA_VANTAGE_API_KEY
    if not api_key:
        log.warning("ALPHA_VANTAGE_API_KEY not set — skipping AV fetch for %s", ticker)
        return None

    try:
        resp = httpx.get(
            _AV_URL,
            params={"function": "GLOBAL_QUOTE", "symbol": ticker, "apikey": api_key},
            timeout=10.0,
        )
        resp.raise_for_status()
        data = resp.json()
        if "Note" in data or "Information" in data:
            log.warning("Alpha Vantage rate limit reached for %s", ticker)
            return None
        quote = data.get("Global Quote", {})
        price_str = quote.get("05. price", "")
        if not price_str:
            log.warning("No price in Alpha Vantage response for %s: %s", ticker, data)
            return None
        return float(price_str), "USD"
    except Exception as exc:  # noqa: BLE001
        log.error("Alpha Vantage fetch failed for %s: %s", ticker, exc)
        return None


def fetch_quote(ticker: str) -> tuple[float, str] | None:
    """Fetch latest price for a ticker.

    Routing:
    1. Recognized crypto name/symbol → CoinGecko (accurate, free, no key)
    2. Other tickers (stocks, ETFs, TASE) → Yahoo Finance
    3. If Yahoo Finance fails → Alpha Vantage fallback (non-TASE only)

    Returns (price, currency) or None on failure.
    """
    # 1. Crypto: check raw ticker and TASE-normalized forms
    cg_id = _coingecko_id(ticker) or _coingecko_id(_normalize_ticker(ticker))
    if cg_id:
        return _fetch_coingecko(cg_id)

    # 2. Stocks / ETFs / TASE — normalize ticker then try Yahoo Finance
    normalized = _normalize_ticker(ticker)
    result = _fetch_yahoo_finance(normalized)
    if result is not None:
        return result

    # 3. Alpha Vantage fallback (non-TASE only)
    if not normalized.upper().endswith(".TA"):
        log.debug("Yahoo Finance failed for %s — trying Alpha Vantage", normalized)
        return _fetch_alpha_vantage(normalized)

    return None

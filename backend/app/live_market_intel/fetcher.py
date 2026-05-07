"""Live market data fetcher for the opportunity scanner.

Two data sources:
- CoinGecko /coins/markets: single batch call for top crypto with 24h/7d data.
- Yahoo Finance chart API (range=7d): per-ticker 52-week range + daily/weekly change.
"""
import logging
from dataclasses import dataclass

import httpx

log = logging.getLogger(__name__)

_YF_CHART = "https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
_YF_HEADERS = {"User-Agent": "Mozilla/5.0"}
_CG_MARKETS = "https://api.coingecko.com/api/v3/coins/markets"

# CoinGecko coin ID → catalog ticker used in CATALOG
CRYPTO_CATALOG_MAP: dict[str, tuple[str, str]] = {
    "bitcoin":      ("BTC-USD", "Bitcoin"),
    "ethereum":     ("ETH-USD", "Ethereum"),
    "solana":       ("SOL-USD", "Solana"),
    "binancecoin":  ("BNB-USD", "BNB"),
    "cardano":      ("ADA-USD", "Cardano"),
}


@dataclass
class LiveSignalData:
    ticker: str
    name: str
    asset_type: str
    current_price: float
    currency: str
    change_24h_pct: float | None
    change_7d_pct: float | None
    pct_from_52w_low: float | None
    pct_from_52w_high: float | None


def fetch_crypto_signals() -> list[LiveSignalData]:
    """Single CoinGecko /coins/markets call — returns top crypto with 24h/7d changes."""
    try:
        resp = httpx.get(
            _CG_MARKETS,
            params={
                "vs_currency": "usd",
                "ids": ",".join(CRYPTO_CATALOG_MAP.keys()),
                "order": "market_cap_desc",
                "per_page": 20,
                "page": 1,
                "price_change_percentage": "24h,7d",
            },
            timeout=10.0,
        )
        resp.raise_for_status()
        coins = resp.json()

        signals: list[LiveSignalData] = []
        for coin in coins:
            coin_id = coin.get("id")
            if coin_id not in CRYPTO_CATALOG_MAP:
                continue
            ticker, name = CRYPTO_CATALOG_MAP[coin_id]
            price = coin.get("current_price")
            if price is None:
                continue

            change_24h = coin.get("price_change_percentage_24h")
            change_7d = coin.get("price_change_percentage_7d_in_currency")

            signals.append(LiveSignalData(
                ticker=ticker,
                name=name,
                asset_type="crypto",
                current_price=float(price),
                currency="USD",
                change_24h_pct=round(float(change_24h), 2) if change_24h is not None else None,
                change_7d_pct=round(float(change_7d), 2) if change_7d is not None else None,
                pct_from_52w_low=None,
                pct_from_52w_high=None,
            ))
        return signals
    except Exception as exc:
        log.error("CoinGecko markets fetch failed: %s", exc)
        return []


def fetch_stock_signal(ticker: str, name: str, asset_type: str) -> LiveSignalData | None:
    """Fetch 7-day Yahoo Finance data: current price, 24h/7d change, 52w range."""
    try:
        resp = httpx.get(
            _YF_CHART.format(ticker=ticker),
            params={"interval": "1d", "range": "7d"},
            headers=_YF_HEADERS,
            timeout=8.0,
        )
        resp.raise_for_status()
        data = resp.json()
        results = (data.get("chart") or {}).get("result") or []
        if not results:
            return None

        meta = results[0].get("meta", {})
        current_price = meta.get("regularMarketPrice")
        if current_price is None:
            return None

        currency = meta.get("currency", "USD")
        is_ila = currency == "ILA"
        if is_ila:
            current_price = current_price / 100
            currency = "ILS"

        # 24h change from previousClose
        prev_close = meta.get("previousClose") or meta.get("chartPreviousClose")
        if is_ila and prev_close:
            prev_close = prev_close / 100
        change_24h: float | None = None
        if prev_close and prev_close > 0:
            change_24h = round((current_price - prev_close) / prev_close * 100, 2)

        # 52-week range
        w52_high = meta.get("fiftyTwoWeekHigh")
        w52_low = meta.get("fiftyTwoWeekLow")
        pct_from_52w_low: float | None = None
        pct_from_52w_high: float | None = None
        if w52_high and w52_low and w52_high > w52_low:
            if is_ila:
                w52_high = w52_high / 100
                w52_low = w52_low / 100
            pct_from_52w_low = round((current_price - w52_low) / (w52_high - w52_low) * 100, 1)
            pct_from_52w_high = round((w52_high - current_price) / w52_high * 100, 1)

        # 7d change from first close in series
        closes = (
            (results[0].get("indicators") or {})
            .get("quote", [{}])[0]
            .get("close", [])
        )
        closes = [c / 100 if is_ila else c for c in closes if c is not None]
        change_7d: float | None = None
        if len(closes) >= 2 and closes[0] and closes[0] > 0:
            change_7d = round((current_price - closes[0]) / closes[0] * 100, 2)

        return LiveSignalData(
            ticker=ticker,
            name=name,
            asset_type=asset_type,
            current_price=float(current_price),
            currency=currency,
            change_24h_pct=change_24h,
            change_7d_pct=change_7d,
            pct_from_52w_low=pct_from_52w_low,
            pct_from_52w_high=pct_from_52w_high,
        )
    except Exception as exc:
        log.error("Yahoo Finance signal fetch failed for %s: %s", ticker, exc)
        return None

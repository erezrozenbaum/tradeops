"""Fundamental screener: fetches yfinance data for the stock universe and scores each ticker.

Scoring methodology (0–100):
  Analyst conviction  (0–30): analyst upside to target + recommendation rating
  Valuation           (0–25): forward P/E + PEG ratio
  Growth              (0–25): revenue growth YoY
  Quality             (0–15): profit margin + ROE
  Entry point         (0–10): price position within 52-week range

Results are cached in-memory for 6 hours to keep API usage low.
"""
import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field

import yfinance as yf

from app.market_research.schemas import SectorPerformance, StockFundamentals
from app.market_research.universe import CRYPTO_UNIVERSE, SECTOR_ETFS, STOCK_UNIVERSE

log = logging.getLogger(__name__)

_CACHE_TTL = 21_600  # 6 hours


@dataclass
class _Cache:
    fundamentals: list[StockFundamentals]
    sector_performance: list[SectorPerformance]
    crypto_candidates: list[StockFundamentals]
    fetched_at: float = field(default_factory=time.time)


_cache: _Cache | None = None


# ── Scoring ───────────────────────────────────────────────────────────────────

def _score(info: dict) -> float:
    score = 0.0

    current = info.get("currentPrice") or info.get("regularMarketPrice") or 0.0
    target = info.get("targetMeanPrice")
    rec_mean = info.get("recommendationMean")  # 1=strong buy … 5=strong sell

    # 1. Analyst conviction (max 30)
    if current and target and current > 0:
        upside = (target - current) / current
        score += min(25, max(0.0, upside * 80))
    if rec_mean and 1 <= rec_mean <= 5:
        # rec 1.0 → +5, rec 3.0 → 0, rec 5.0 → -10 (clipped at 0)
        score += max(0.0, min(5.0, (3.0 - rec_mean) * 5))

    # 2. Valuation (max 25)
    fpe = info.get("forwardPE")
    if fpe and 2 < fpe < 150:
        if fpe < 12:
            score += 25.0
        elif fpe < 20:
            score += 25.0 - (fpe - 12) * (15.0 / 8)
        elif fpe < 35:
            score += max(0.0, 10.0 - (fpe - 20) * (10.0 / 15))
    peg = info.get("pegRatio")
    if peg and 0 < peg < 4:
        score += min(5.0, max(0.0, (2.5 - peg) * 3))

    # 3. Growth (max 25)
    rev_growth = info.get("revenueGrowth")  # decimal, e.g. 0.142
    if rev_growth is not None:
        score += min(25.0, max(0.0, float(rev_growth) * 100))

    # 4. Quality (max 15)
    margin = info.get("profitMargins")
    if margin is not None:
        score += min(12.0, max(0.0, float(margin) * 55))
    roe = info.get("returnOnEquity")
    if roe is not None and roe > 0:
        score += min(3.0, float(roe) * 10)

    # 5. Entry point (max 10) — lower in 52w range is a better entry
    w52h = info.get("fiftyTwoWeekHigh")
    w52l = info.get("fiftyTwoWeekLow")
    if current and w52h and w52l and w52h > w52l > 0:
        position = (current - w52l) / (w52h - w52l)  # 0 = at low, 1 = at high
        score += max(0.0, (1.0 - position) * 10)

    return round(min(100.0, score), 1)


def _score_crypto(info: dict) -> float:
    """Score crypto on 52-week entry signal (no fundamental metrics available)."""
    score = 0.0
    current = info.get("currentPrice") or info.get("regularMarketPrice") or 0.0

    # Entry signal (0–60): nearer to 52w low = better entry
    w52h = info.get("fiftyTwoWeekHigh")
    w52l = info.get("fiftyTwoWeekLow")
    if current and w52h and w52l and w52h > w52l > 0:
        position = (current - w52l) / (w52h - w52l)
        score += max(0.0, (1.0 - position) * 60)

    # Base presence score (valid price = 20 pts)
    if current > 0:
        score += 20

    return round(min(100.0, score), 1)


def _fetch_one(entry: dict) -> StockFundamentals | None:
    ticker = entry["ticker"]
    try:
        info = yf.Ticker(ticker).info
        if not info or "currentPrice" not in info and "regularMarketPrice" not in info:
            return None

        current = info.get("currentPrice") or info.get("regularMarketPrice")
        target = info.get("targetMeanPrice")
        upside_pct: float | None = None
        if current and target and current > 0:
            upside_pct = round((target - current) / current * 100, 1)

        w52h = info.get("fiftyTwoWeekHigh")
        w52l = info.get("fiftyTwoWeekLow")
        pct_from_low: float | None = None
        pct_from_high: float | None = None
        if current and w52h and w52l and w52h > w52l > 0:
            pct_from_low = round((current - w52l) / (w52h - w52l) * 100, 1)
            pct_from_high = round((w52h - current) / w52h * 100, 1)

        # Normalise decimal → percentage for display
        def _pct(v) -> float | None:
            return round(float(v) * 100, 2) if v is not None else None

        currency = info.get("currency", "USD")
        # TASE quirk: ILA = agorot (1/100 ILS)
        if currency == "ILA":
            currency = "ILS"
            if current:
                current = current / 100
            if target:
                target = target / 100

        return StockFundamentals(
            ticker=ticker,
            name=info.get("longName") or entry["name"],
            sector=info.get("sector") or entry["sector"],
            market=entry["market"],
            asset_type=entry["asset_type"],
            current_price=round(float(current), 2) if current else None,
            currency=currency,
            analyst_target=round(float(target), 2) if target else None,
            analyst_upside_pct=upside_pct,
            analyst_rating=info.get("recommendationKey"),
            analyst_count=info.get("numberOfAnalystOpinions"),
            trailing_pe=round(float(info["trailingPE"]), 2) if info.get("trailingPE") else None,
            forward_pe=round(float(info["forwardPE"]), 2) if info.get("forwardPE") else None,
            peg_ratio=round(float(info["pegRatio"]), 2) if info.get("pegRatio") else None,
            price_to_book=round(float(info["priceToBook"]), 2) if info.get("priceToBook") else None,
            revenue_growth_pct=_pct(info.get("revenueGrowth")),
            earnings_growth_pct=_pct(info.get("earningsGrowth")),
            profit_margin_pct=_pct(info.get("profitMargins")),
            return_on_equity_pct=_pct(info.get("returnOnEquity")),
            dividend_yield_pct=_pct(info.get("dividendYield")),
            pct_from_52w_low=pct_from_low,
            pct_from_52w_high=pct_from_high,
            opportunity_score=(_score_crypto if entry.get("asset_type") == "crypto" else _score)(info),
        )
    except Exception as exc:
        log.debug("Screener skipped %s: %s", ticker, exc)
        return None


def _fetch_sector_performance() -> list[SectorPerformance]:
    results: list[SectorPerformance] = []
    for sector, etf in SECTOR_ETFS.items():
        try:
            hist = yf.download(etf, period="1y", interval="1mo", progress=False, auto_adjust=True)
            if hist.empty or len(hist) < 2:
                continue
            closes = hist["Close"].squeeze().dropna()
            if len(closes) < 2:
                continue
            latest = float(closes.iloc[-1])

            def _ret(n_months: int) -> float | None:
                if len(closes) < n_months:
                    return None
                base = float(closes.iloc[-n_months])
                return round((latest - base) / base * 100, 1) if base > 0 else None

            perf_1m = _ret(1)
            perf_3m = _ret(3)
            perf_1y = _ret(min(12, len(closes)))

            if perf_1m is None and perf_3m is None:
                continue

            outlook = "neutral"
            if perf_3m is not None:
                if perf_3m > 8:
                    outlook = "bullish"
                elif perf_3m < -5:
                    outlook = "bearish"

            results.append(SectorPerformance(
                sector=sector,
                etf_ticker=etf,
                performance_1m_pct=perf_1m,
                performance_3m_pct=perf_3m,
                performance_1y_pct=perf_1y,
                outlook=outlook,
            ))
        except Exception as exc:
            log.debug("Sector ETF fetch failed for %s: %s", etf, exc)
    return results


def run_screen() -> tuple[list[StockFundamentals], list[SectorPerformance], list[StockFundamentals]]:
    """Fetch fundamentals for all universe members, sector ETF performance, and crypto candidates.

    Results are cached for 6 hours. Concurrent fetching with 10 workers.
    """
    global _cache
    if _cache and (time.time() - _cache.fetched_at) < _CACHE_TTL:
        return _cache.fundamentals, _cache.sector_performance, _cache.crypto_candidates

    log.info("[market_research] Starting fundamental screen of %d instruments", len(STOCK_UNIVERSE))
    fundamentals: list[StockFundamentals] = []

    with ThreadPoolExecutor(max_workers=10) as pool:
        futures = {pool.submit(_fetch_one, entry): entry for entry in STOCK_UNIVERSE}
        for future in as_completed(futures):
            result = future.result()
            if result and result.current_price:
                fundamentals.append(result)

    fundamentals.sort(key=lambda x: x.opportunity_score, reverse=True)
    sector_performance = _fetch_sector_performance()

    crypto_candidates: list[StockFundamentals] = []
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {pool.submit(_fetch_one, entry): entry for entry in CRYPTO_UNIVERSE}
        for future in as_completed(futures):
            result = future.result()
            if result and result.current_price:
                crypto_candidates.append(result)
    crypto_candidates.sort(key=lambda x: x.opportunity_score, reverse=True)

    _cache = _Cache(
        fundamentals=fundamentals,
        sector_performance=sector_performance,
        crypto_candidates=crypto_candidates,
    )
    log.info(
        "[market_research] Screen complete: %d/%d stocks scored, %d crypto",
        len(fundamentals), len(STOCK_UNIVERSE), len(crypto_candidates),
    )
    return fundamentals, sector_performance, crypto_candidates


def get_top_candidates(n: int = 25) -> tuple[list[StockFundamentals], list[SectorPerformance], list[StockFundamentals]]:
    fundamentals, sectors, crypto = run_screen()
    return fundamentals[:n], sectors, crypto

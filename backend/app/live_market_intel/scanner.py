"""Opportunity scanner: fetches live signals for catalog instruments.

Uses a 30-minute in-memory cache to avoid hammering external APIs on
every recommendation generation call.
"""
import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass

from app.live_market_intel.fetcher import (
    LiveSignalData,
    fetch_crypto_signals,
    fetch_stock_signal,
)
from app.live_market_intel.schemas import LiveSignal
from app.market_scanner.catalog import CATALOG
from app.models.risk_model import RiskModel

log = logging.getLogger(__name__)

_CACHE_TTL = 1800  # 30 minutes


@dataclass
class _Cache:
    signals: list[LiveSignal]
    fetched_at: float


_cache: _Cache | None = None


def _classify_signal(data: LiveSignalData) -> tuple[str, str]:
    """Returns (signal_type, signal_note) based on price action."""
    c7 = data.change_7d_pct
    c24 = data.change_24h_pct
    low_pct = data.pct_from_52w_low

    if c7 is not None and c7 <= -10:
        if low_pct is not None and low_pct < 20:
            return (
                "dip",
                f"Down {abs(c7):.1f}% this week near 52-week support — potential entry point.",
            )
        return "dip", f"Down {abs(c7):.1f}% this week — extended correction, watch for stabilisation."

    if c7 is not None and c7 <= -5:
        if c24 is not None and c24 > 1.5:
            return (
                "recovery",
                f"Down {abs(c7):.1f}% this week but bouncing +{c24:.1f}% today — early recovery signal.",
            )
        return "dip", f"Down {abs(c7):.1f}% this week — still in correction territory."

    if c7 is not None and c7 >= 8:
        return "momentum", f"Up {c7:.1f}% this week — strong upward momentum."

    if low_pct is not None and low_pct < 10:
        return "near_low", "Near 52-week low — historically a favourable accumulation zone."

    if low_pct is not None and low_pct < 20:
        return "near_low", f"In lower {low_pct:.0f}% of 52-week range — potential value entry."

    return "stable", "No significant price movement this week."


def _opportunity_score(s: LiveSignal) -> float:
    score = 0.0

    if s.signal_type == "near_low":
        score += 40
    elif s.signal_type == "dip":
        score += 30
    elif s.signal_type == "recovery":
        score += 25
    elif s.signal_type == "momentum":
        score += 15

    # Bigger dip = higher score (capped at 25 to avoid panic-sell territory)
    if s.change_7d_pct is not None and -30 < s.change_7d_pct < -3:
        score += min(abs(s.change_7d_pct), 25)

    # Near 52w low bonus
    if s.pct_from_52w_low is not None and s.pct_from_52w_low < 20:
        score += (20 - s.pct_from_52w_low)

    # Discovery bonus (not already held)
    if not s.is_held:
        score += 5

    return score


def get_opportunity_signals(
    risk_model: RiskModel | None,
    current_tickers: set[str],
    max_signals: int = 20,
) -> list[LiveSignal]:
    """
    Return live market opportunity signals filtered by the investor's risk model.
    Results are cached for 30 minutes to avoid excessive API calls.
    """
    global _cache
    now = time.monotonic()
    if _cache and (now - _cache.fetched_at) < _CACHE_TTL:
        cached = _filter_and_mark(
            _cache.signals, risk_model, current_tickers, max_signals
        )
        log.debug("Returning %d cached market signals", len(cached))
        return cached

    # Build allowed risk set
    allowed_risk: set[str] = {"low", "moderate", "high", "very_high"}
    if risk_model:
        if risk_model.high_risk_pct == 0 and risk_model.growth_pct == 0:
            allowed_risk = {"low"}
        elif risk_model.high_risk_pct == 0:
            allowed_risk = {"low", "moderate"}

    catalog_by_ticker = {i.ticker: i for i in CATALOG}
    stock_catalog = [i for i in CATALOG if i.asset_type != "crypto"]
    crypto_catalog = [i for i in CATALOG if i.asset_type == "crypto"]

    all_signals: list[LiveSignal] = []

    # 1. Crypto: single CoinGecko batch call
    if crypto_catalog:
        crypto_data = fetch_crypto_signals()
        for data in crypto_data:
            instr = catalog_by_ticker.get(data.ticker)
            if instr is None:
                continue
            sig_type, sig_note = _classify_signal(data)
            all_signals.append(LiveSignal(
                ticker=data.ticker,
                name=instr.name,
                asset_type="crypto",
                current_price=data.current_price,
                currency=data.currency,
                change_24h_pct=data.change_24h_pct,
                change_7d_pct=data.change_7d_pct,
                pct_from_52w_low=data.pct_from_52w_low,
                signal_type=sig_type,
                signal_note=sig_note,
                risk_level=instr.risk_level,
                is_held=data.ticker in current_tickers,
            ))

    # 2. Stocks/ETFs: parallel Yahoo Finance calls (up to 8 concurrent)
    def _fetch(instr) -> LiveSignal | None:
        data = fetch_stock_signal(instr.ticker, instr.name, instr.asset_type)
        if data is None:
            return None
        sig_type, sig_note = _classify_signal(data)
        return LiveSignal(
            ticker=instr.ticker,
            name=instr.name,
            asset_type=instr.asset_type,
            current_price=data.current_price,
            currency=data.currency,
            change_24h_pct=data.change_24h_pct,
            change_7d_pct=data.change_7d_pct,
            pct_from_52w_low=data.pct_from_52w_low,
            signal_type=sig_type,
            signal_note=sig_note,
            risk_level=instr.risk_level,
            is_held=instr.ticker in current_tickers,
        )

    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(_fetch, instr): instr for instr in stock_catalog}
        for future in as_completed(futures):
            result = future.result()
            if result:
                all_signals.append(result)

    _cache = _Cache(signals=all_signals, fetched_at=now)
    log.info("Fetched %d live market signals", len(all_signals))

    return _filter_and_mark(all_signals, risk_model, current_tickers, max_signals)


def _filter_and_mark(
    signals: list[LiveSignal],
    risk_model: RiskModel | None,
    current_tickers: set[str],
    max_signals: int,
) -> list[LiveSignal]:
    """Filter by risk model, update is_held, sort by opportunity score."""
    allowed_risk: set[str] = {"low", "moderate", "high", "very_high"}
    if risk_model:
        if risk_model.high_risk_pct == 0 and risk_model.growth_pct == 0:
            allowed_risk = {"low"}
        elif risk_model.high_risk_pct == 0:
            allowed_risk = {"low", "moderate"}

    filtered = [
        LiveSignal(**{**s.model_dump(), "is_held": s.ticker in current_tickers})
        for s in signals
        if s.risk_level in allowed_risk
    ]
    filtered.sort(key=_opportunity_score, reverse=True)
    return filtered[:max_signals]

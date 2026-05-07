"""Background job: pre-warm the live market signals cache every 30 minutes.

The market scanner fetches live prices from CoinGecko and Yahoo Finance
in parallel (up to 8 threads). Cold cache adds 20-40s to any user request
that triggers recommendations or market-scan. This job keeps the cache warm
so those requests return in < 1 second from cache.
"""
import logging

log = logging.getLogger(__name__)


def prewarm_market_signals() -> None:
    """Fetch all catalog signals and populate the 30-minute in-memory cache."""
    try:
        from app.live_market_intel import scanner
        signals = scanner.get_opportunity_signals(
            risk_model=None,
            current_tickers=set(),
            max_signals=60,
        )
        log.info("[market_prewarm] Cache warm: %d signals fetched", len(signals))
    except Exception as exc:
        log.error("[market_prewarm] Failed: %s", exc)

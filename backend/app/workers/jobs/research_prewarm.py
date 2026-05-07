"""Pre-warms the deep market research fundamental cache (6-hour TTL)."""
import logging

log = logging.getLogger(__name__)


def prewarm_market_research() -> None:
    try:
        from app.market_research import screener
        fundamentals, sectors = screener.run_screen()
        log.info(
            "[research_prewarm] Cache warm: %d instruments scored, %d sectors",
            len(fundamentals),
            len(sectors),
        )
    except Exception as exc:
        log.error("[research_prewarm] Failed: %s", exc)

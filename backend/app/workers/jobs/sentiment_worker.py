"""APScheduler job — delegates to market_signals.worker."""
import logging

log = logging.getLogger(__name__)


def run_sentiment_signals() -> None:
    from app.market_signals.worker import run_daily_sentiment
    log.info("[sentiment_signals] Starting daily sentiment worker")
    run_daily_sentiment()

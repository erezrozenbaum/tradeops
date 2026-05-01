"""Daily job: refresh market prices for all tickered holdings across all investors."""
import logging

from app.db.session import SessionLocal
from app.models.investment_account import InvestmentHolding
from app.market_data.service import fetch_and_cache

log = logging.getLogger(__name__)


def refresh_all_prices() -> None:
    """Fetch fresh prices for every distinct ticker stored in investment_holdings.

    Runs once per day after market close. Skips holdings with no ticker.
    Each ticker is fetched via the appropriate provider (Yahoo Finance for .TA,
    Alpha Vantage for everything else).
    """
    db = SessionLocal()
    try:
        rows = (
            db.query(InvestmentHolding.ticker)
            .filter(InvestmentHolding.ticker.isnot(None))
            .distinct()
            .all()
        )
        tickers = {row[0] for row in rows if row[0]}

        if not tickers:
            log.info("[price_refresh] No tickered holdings found — skipping.")
            return

        log.info("[price_refresh] Refreshing %d tickers: %s", len(tickers), sorted(tickers))

        refreshed, failed = [], []
        for ticker in tickers:
            snapshot = fetch_and_cache(db, ticker)
            if snapshot:
                refreshed.append(ticker)
            else:
                failed.append(ticker)

        log.info(
            "[price_refresh] Done — refreshed: %s | failed: %s",
            sorted(refreshed),
            sorted(failed),
        )
    except Exception as exc:  # noqa: BLE001
        log.error("[price_refresh] Job failed: %s", exc)
    finally:
        db.close()

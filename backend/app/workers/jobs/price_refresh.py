"""Daily job: refresh market prices for all tickered holdings across all investors."""
import logging

from app.db.session import SessionLocal
from app.models.investment_account import InvestmentHolding
from app.models.investor_profile import InvestorProfile
from app.models.watchlist import WatchlistItem
from app.market_data.service import fetch_and_cache
from app.portfolio_analysis.service import get_portfolio, save_snapshot

log = logging.getLogger(__name__)


def refresh_all_prices() -> None:
    """Fetch fresh prices for all distinct tickers, then save a portfolio snapshot per investor."""
    db = SessionLocal()
    try:
        holding_rows = (
            db.query(InvestmentHolding.ticker)
            .filter(InvestmentHolding.ticker.isnot(None))
            .distinct()
            .all()
        )
        watchlist_rows = db.query(WatchlistItem.ticker).distinct().all()
        tickers = {row[0] for row in holding_rows if row[0]} | {row[0] for row in watchlist_rows if row[0]}

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

        # Save portfolio snapshot for every investor who has holdings
        investors = db.query(InvestorProfile).all()
        snaps = 0
        for investor in investors:
            try:
                summary = get_portfolio(db, investor.id)
                if summary and summary.total_current_value > 0:
                    save_snapshot(db, summary)
                    snaps += 1
            except Exception as exc:  # noqa: BLE001
                log.error("[price_refresh] Snapshot failed for investor %s: %s", investor.id, exc)
        log.info("[price_refresh] Saved %d portfolio snapshot(s).", snaps)

    except Exception as exc:  # noqa: BLE001
        log.error("[price_refresh] Job failed: %s", exc)
    finally:
        db.close()

"""Daily FX rate history sync.

Fetches yesterday's closing FX rates for all (base_currency, holding_currency) pairs
active in any investor's portfolio. Runs after snapshot_writer (21:30 UTC).
"""
import logging

log = logging.getLogger(__name__)


def sync_fx_history() -> None:
    from app.db.session import SessionLocal
    from app.currency_engine.history import sync_yesterday

    db = SessionLocal()
    try:
        results = sync_yesterday(db)
        if results:
            log.info("[fx_history_sync] Synced %d pairs: %s", len(results), results)
        else:
            log.info("[fx_history_sync] No active foreign-currency holdings found")
    except Exception as exc:
        log.error("[fx_history_sync] Fatal error: %s", exc)
    finally:
        db.close()

"""Daily job: refresh market prices for auto-sync enabled accounts and update last_synced_at."""
import logging
from datetime import datetime, timezone

from app.db.session import SessionLocal
from app.models.investment_account import InvestmentAccount, InvestmentHolding
from app.market_data.service import fetch_and_cache

log = logging.getLogger(__name__)


def run_broker_auto_sync() -> None:
    """Refresh prices for all holdings in auto-sync enabled accounts."""
    db = SessionLocal()
    try:
        accounts = (
            db.query(InvestmentAccount)
            .filter(InvestmentAccount.auto_sync_enabled == True)  # noqa: E712
            .all()
        )

        if not accounts:
            log.info("[broker_auto_sync] No auto-sync accounts found — skipping.")
            return

        log.info("[broker_auto_sync] Running auto-sync for %d account(s).", len(accounts))

        for account in accounts:
            tickers = {
                h.ticker
                for h in db.query(InvestmentHolding)
                .filter(InvestmentHolding.account_id == account.id, InvestmentHolding.ticker.isnot(None))
                .all()
                if h.ticker
            }

            refreshed, failed = [], []
            for ticker in tickers:
                snap = fetch_and_cache(db, ticker)
                if snap:
                    refreshed.append(ticker)
                else:
                    failed.append(ticker)

            account.last_synced_at = datetime.now(timezone.utc)
            db.commit()

            log.info(
                "[broker_auto_sync] Account %s (%s) — refreshed: %s | failed: %s",
                account.id,
                account.provider_name,
                sorted(refreshed),
                sorted(failed),
            )

    except Exception as exc:  # noqa: BLE001
        log.error("[broker_auto_sync] Job failed: %s", exc)
    finally:
        db.close()

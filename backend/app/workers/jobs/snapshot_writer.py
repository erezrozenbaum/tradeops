"""Daily portfolio snapshot writer.

Runs after price_refresh (21:00 UTC) to capture end-of-day portfolio state
for all investors who have at least one holding. Skips investors who already
have a snapshot today (idempotent).
"""
import logging

log = logging.getLogger(__name__)


def write_daily_snapshots() -> None:
    from app.db.session import SessionLocal
    from app.models.investor_profile import InvestorProfile
    from app.models.investment_account import InvestmentAccount
    from app.portfolio_analysis import service as portfolio_service

    db = SessionLocal()
    try:
        # All investors with at least one holding
        investor_ids = (
            db.query(InvestorProfile.id)
            .join(InvestmentAccount, InvestmentAccount.investor_id == InvestorProfile.id)
            .distinct()
            .all()
        )
        investor_ids = [row[0] for row in investor_ids]
        log.info("[snapshot_writer] Writing snapshots for %d investors", len(investor_ids))

        written = 0
        skipped = 0
        for investor_id in investor_ids:
            try:
                if portfolio_service.has_snapshot_today(db, investor_id):
                    skipped += 1
                    continue
                portfolio = portfolio_service.get_portfolio(db, investor_id)
                if portfolio and portfolio.total_current_value > 0:
                    portfolio_service.save_snapshot(db, portfolio)
                    written += 1
            except Exception as exc:
                log.warning("[snapshot_writer] Failed for investor %s: %s", investor_id, exc)

        log.info("[snapshot_writer] Done — written=%d, skipped=%d", written, skipped)
    except Exception as exc:
        log.error("[snapshot_writer] Fatal error: %s", exc)
    finally:
        db.close()

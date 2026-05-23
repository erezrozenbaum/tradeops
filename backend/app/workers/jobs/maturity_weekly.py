"""Weekly investor maturity scoring.

Runs every Saturday at 06:00 UTC — after all daily jobs have settled.
Computes a fresh maturity snapshot for every active investor.
"""
import logging

log = logging.getLogger(__name__)


def compute_all_maturity_scores() -> None:
    from app.db.session import SessionLocal
    from app.models.investor_profile import InvestorProfile
    from app.investor_maturity import service as maturity_service

    db = SessionLocal()
    try:
        investor_ids = [row[0] for row in db.query(InvestorProfile.id).all()]
        log.info("[maturity_weekly] Computing scores for %d investor(s)", len(investor_ids))

        for investor_id in investor_ids:
            try:
                maturity_service.compute_maturity(db, investor_id)
            except Exception as exc:
                log.warning("[maturity_weekly] Failed for %s: %s", investor_id, exc)

        log.info("[maturity_weekly] Done")
    except Exception as exc:
        log.error("[maturity_weekly] Fatal: %s", exc)
    finally:
        db.close()

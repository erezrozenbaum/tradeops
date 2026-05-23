"""Daily financial twin + health radar scoring.

Runs at 03:00 UTC — after portfolio snapshot writer (21:00) and net worth
snapshot (21:15), so all underlying data is fresh.
"""
import logging

log = logging.getLogger(__name__)


def compute_all_twin_scores() -> None:
    from app.db.session import SessionLocal
    from app.models.investor_profile import InvestorProfile
    from app.financial_twin import service as twin_service

    db = SessionLocal()
    try:
        investor_ids = [row[0] for row in db.query(InvestorProfile.id).all()]
        log.info("[twin_daily] Computing twin + health scores for %d investor(s)", len(investor_ids))

        for investor_id in investor_ids:
            try:
                twin_service.compute_twin_and_health(db, investor_id)
            except Exception as exc:
                log.warning("[twin_daily] Failed for %s: %s", investor_id, exc)

        log.info("[twin_daily] Done")
    except Exception as exc:
        log.error("[twin_daily] Fatal: %s", exc)
    finally:
        db.close()

import logging

log = logging.getLogger(__name__)


def detect_behavioral_risk_daily() -> None:
    from app.db.session import SessionLocal
    from app.models.investor_profile import InvestorProfile
    from app.behavioral_risk.service import detect_and_persist

    db = SessionLocal()
    try:
        investor_ids = [row.id for row in db.query(InvestorProfile.id).all()]
        log.info("behavioral_risk_daily: scanning %d investors", len(investor_ids))
        total_created = 0
        for investor_id in investor_ids:
            try:
                created = detect_and_persist(db, investor_id)
                total_created += len(created)
            except Exception as exc:
                log.warning("behavioral_risk_daily: investor %s failed — %s", investor_id, exc)
        log.info("behavioral_risk_daily: done — %d new events created", total_created)
    finally:
        db.close()

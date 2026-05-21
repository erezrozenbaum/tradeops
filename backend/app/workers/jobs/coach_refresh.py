"""Daily coach insights refresh.

Runs at 07:45 UTC (after goal_evaluation at 07:00 and proactive_insights at 07:30).
Regenerates all rule-based + AI coach insights for every investor.
"""
import logging

log = logging.getLogger(__name__)


def refresh_all_coach_insights() -> None:
    from app.core.config import settings
    from app.db.session import SessionLocal
    from app.models.investor_profile import InvestorProfile
    from app.coach import service as coach_service

    db = SessionLocal()
    try:
        investor_ids = [row[0] for row in db.query(InvestorProfile.id).all()]
        log.info("[coach_refresh] Refreshing for %d investor(s)", len(investor_ids))

        for investor_id in investor_ids:
            try:
                coach_service.refresh_insights(
                    db, investor_id, api_key=settings.ANTHROPIC_API_KEY
                )
            except Exception as exc:
                log.warning("[coach_refresh] Failed for %s: %s", investor_id, exc)

        log.info("[coach_refresh] Done")
    except Exception as exc:
        log.error("[coach_refresh] Fatal: %s", exc)
    finally:
        db.close()

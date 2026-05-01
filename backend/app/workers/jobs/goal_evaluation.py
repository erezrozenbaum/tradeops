"""Daily job: evaluate goal statuses for all investors and log a summary.

This is a read-only sweep — no data is written. Future iterations will store
alerts or send push notifications when goals become at_risk.
"""
import logging

from app.db.session import SessionLocal
from app.models.investor_profile import InvestorProfile
from app.goals_analysis.service import get_analysis

log = logging.getLogger(__name__)


def evaluate_all_goals() -> None:
    """Run goals analysis for every investor and log at-risk/complete counts."""
    db = SessionLocal()
    try:
        investors = db.query(InvestorProfile).all()

        if not investors:
            log.info("[goal_evaluation] No investors found — skipping.")
            return

        log.info("[goal_evaluation] Evaluating goals for %d investors.", len(investors))

        total_at_risk = 0
        total_complete = 0

        for investor in investors:
            try:
                result = get_analysis(db, investor.id)
                if result is None or not result.goals:
                    continue
                at_risk = sum(1 for g in result.goals if g.status == "at_risk")
                complete = sum(1 for g in result.goals if g.status == "complete")
                total_at_risk += at_risk
                total_complete += complete
                if at_risk:
                    log.warning(
                        "[goal_evaluation] Investor %s has %d at-risk goal(s).",
                        investor.id,
                        at_risk,
                    )
            except Exception as exc:  # noqa: BLE001
                log.error("[goal_evaluation] Failed for investor %s: %s", investor.id, exc)

        log.info(
            "[goal_evaluation] Sweep done — at_risk: %d, complete: %d across all investors.",
            total_at_risk,
            total_complete,
        )
    except Exception as exc:  # noqa: BLE001
        log.error("[goal_evaluation] Job failed: %s", exc)
    finally:
        db.close()

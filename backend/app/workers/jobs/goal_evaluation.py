"""Daily job: evaluate goal statuses for all investors, log a summary, and
send email alerts to investors who have enabled them and have at-risk goals.
"""
import logging

from app.db.session import SessionLocal
from app.models.investor_profile import InvestorProfile
from app.goals_analysis.service import get_analysis
from app.notifications.email import send_alert_email

log = logging.getLogger(__name__)


def evaluate_all_goals() -> None:
    """Run goals analysis for every investor, log results, and send alerts."""
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
                at_risk_goals = [g for g in result.goals if g.status == "at_risk"]
                complete = sum(1 for g in result.goals if g.status == "complete")
                at_risk = len(at_risk_goals)
                total_at_risk += at_risk
                total_complete += complete
                if at_risk:
                    log.warning(
                        "[goal_evaluation] Investor %s has %d at-risk goal(s).",
                        investor.id,
                        at_risk,
                    )
                    if investor.email_alerts_enabled and investor.alert_email:
                        goal_lines = "\n".join(
                            f"  - {g.goal_name}" for g in at_risk_goals
                        )
                        body = (
                            f"Hi {investor.full_name},\n\n"
                            f"Your TradeOps dashboard shows {at_risk} goal(s) that need attention:\n\n"
                            f"{goal_lines}\n\n"
                            "Log in to review your goals and adjust your plan.\n\n"
                            "— TradeOps AI"
                        )
                        send_alert_email(
                            to=investor.alert_email,
                            subject=f"[TradeOps] {at_risk} goal(s) need your attention",
                            body=body,
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

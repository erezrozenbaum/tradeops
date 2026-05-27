"""Background job — run due recurring investment plans and auto-stage orders."""
import logging
from datetime import datetime, timezone

log = logging.getLogger(__name__)


def run_due_recurring_plans() -> None:
    from app.db.session import SessionLocal
    from app.models.recurring_plan import RecurringPlan
    from app.recurring_plans.service import run_plan

    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        due = (
            db.query(RecurringPlan)
            .filter(
                RecurringPlan.is_active == True,  # noqa: E712
                RecurringPlan.next_run_at <= now,
                RecurringPlan.next_run_at.isnot(None),
            )
            .all()
        )
        if not due:
            return
        total_staged = 0
        for plan in due:
            try:
                count = run_plan(db, plan)
                total_staged += count
                log.info("[recurring_plans] Plan '%s' (%s) staged %d order(s)", plan.name, plan.id, count)
            except Exception as exc:
                log.warning("[recurring_plans] Plan %s failed: %s", plan.id, exc)
                db.rollback()
        if total_staged:
            log.info("[recurring_plans] Total staged: %d across %d plan(s)", total_staged, len(due))
    except Exception as exc:
        log.error("[recurring_plans] Fatal: %s", exc)
        db.rollback()
    finally:
        db.close()

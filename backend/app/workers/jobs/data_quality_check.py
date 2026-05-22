"""Daily data quality check job.

Runs Great Expectations validation suites against live financial data tables.
Logs results; writes audit events for any failures.
Scheduled at 02:00 UTC (low-traffic window, after all daily jobs complete).
"""
import logging

log = logging.getLogger(__name__)


def run_data_quality_checks() -> None:
    from app.db.session import SessionLocal
    from app.data_quality.runner import run_all_checks

    db = SessionLocal()
    try:
        results = run_all_checks(db)
        passed = sum(1 for r in results if r.success)
        failed = sum(1 for r in results if not r.success)
        log.info("[data_quality_job] Completed: %d passed, %d failed", passed, failed)
    except Exception as exc:
        log.error("[data_quality_job] Unexpected error: %s", exc)
    finally:
        db.close()

"""APScheduler background scheduler — lifecycle managed by FastAPI lifespan.

Jobs:
  - price_refresh   : daily at 20:00 UTC (after US market close)
  - goal_evaluation : daily at 07:00 UTC (morning status sweep)

Set WORKERS_ENABLED=false in .env to disable all background jobs.
"""
import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

log = logging.getLogger(__name__)

_scheduler = BackgroundScheduler(timezone="UTC")
_started = False


def _register_jobs() -> None:
    from app.workers.jobs.price_refresh import refresh_all_prices
    from app.workers.jobs.goal_evaluation import evaluate_all_goals

    _scheduler.add_job(
        refresh_all_prices,
        CronTrigger(hour=20, minute=0),
        id="price_refresh",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    _scheduler.add_job(
        evaluate_all_goals,
        CronTrigger(hour=7, minute=0),
        id="goal_evaluation",
        replace_existing=True,
        misfire_grace_time=3600,
    )


def start() -> None:
    global _started
    if _started:
        return
    _register_jobs()
    _scheduler.start()
    _started = True
    log.info("Workers scheduler started (jobs: price_refresh @ 20:00 UTC, goal_evaluation @ 07:00 UTC)")


def stop() -> None:
    global _started
    if not _started:
        return
    _scheduler.shutdown(wait=False)
    _started = False
    log.info("Workers scheduler stopped")

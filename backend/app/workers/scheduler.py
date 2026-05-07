"""APScheduler background scheduler — lifecycle managed by FastAPI lifespan.

Jobs:
  - price_refresh      : daily at 20:00 UTC (after US market close)
  - goal_evaluation    : daily at 07:00 UTC (morning status sweep)
  - notification_alerts: daily at 08:30 UTC (email digest)
  - market_prewarm     : every 30 minutes (keeps live market signal cache warm)

Set WORKERS_ENABLED=false in .env to disable all background jobs.
"""
import logging
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

log = logging.getLogger(__name__)

_scheduler = BackgroundScheduler(timezone="UTC")
_started = False


def _register_jobs() -> None:
    from app.workers.jobs.price_refresh import refresh_all_prices
    from app.workers.jobs.goal_evaluation import evaluate_all_goals
    from app.workers.jobs.notification_alerts import send_notification_alerts
    from app.workers.jobs.market_prewarm import prewarm_market_signals

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
    _scheduler.add_job(
        send_notification_alerts,
        CronTrigger(hour=8, minute=30),
        id="notification_alerts",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    _scheduler.add_job(
        prewarm_market_signals,
        IntervalTrigger(minutes=30),
        id="market_prewarm",
        replace_existing=True,
        misfire_grace_time=600,
        next_run_time=datetime.now(timezone.utc),  # run immediately on startup
    )


def start() -> None:
    global _started
    if _started:
        return
    _register_jobs()
    _scheduler.start()
    _started = True
    log.info("Workers scheduler started (jobs: price_refresh @ 20:00 UTC, goal_evaluation @ 07:00 UTC, notification_alerts @ 08:30 UTC, market_prewarm every 30 min)")


def stop() -> None:
    global _started
    if not _started:
        return
    _scheduler.shutdown(wait=False)
    _started = False
    log.info("Workers scheduler stopped")

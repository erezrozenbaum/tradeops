"""APScheduler background scheduler — lifecycle managed by FastAPI lifespan.

Jobs:
  - price_refresh      : daily at 20:00 UTC (after US market close)
  - snapshot_writer    : daily at 21:00 UTC (end-of-day portfolio snapshots)
  - price_alert_checker: daily at 20:30 UTC (check price alerts after price refresh)
  - goal_evaluation    : daily at 07:00 UTC (morning status sweep)
  - notification_alerts: daily at 08:30 UTC (email digest)
  - market_prewarm     : every 30 minutes (keeps live market signal cache warm)
  - research_prewarm   : every 6 hours (keeps market research cache warm)

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
    from app.workers.jobs.snapshot_writer import write_daily_snapshots
    from app.workers.jobs.price_alert_checker import check_price_alerts
    from app.workers.jobs.goal_evaluation import evaluate_all_goals
    from app.workers.jobs.notification_alerts import send_notification_alerts
    from app.workers.jobs.market_prewarm import prewarm_market_signals
    from app.workers.jobs.research_prewarm import prewarm_market_research

    _scheduler.add_job(
        refresh_all_prices,
        CronTrigger(hour=20, minute=0),
        id="price_refresh",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    _scheduler.add_job(
        write_daily_snapshots,
        CronTrigger(hour=21, minute=0),
        id="snapshot_writer",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    _scheduler.add_job(
        check_price_alerts,
        CronTrigger(hour=20, minute=30),
        id="price_alert_checker",
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
    _scheduler.add_job(
        prewarm_market_research,
        IntervalTrigger(hours=6),
        id="research_prewarm",
        replace_existing=True,
        misfire_grace_time=1800,
        next_run_time=datetime.now(timezone.utc),  # warm cache on startup
    )


def start() -> None:
    global _started
    if _started:
        return
    _register_jobs()
    _scheduler.start()
    _started = True
    log.info("Workers scheduler started (jobs: price_refresh, snapshot_writer, price_alert_checker, goal_evaluation, notification_alerts, market_prewarm, research_prewarm)")


def stop() -> None:
    global _started
    if not _started:
        return
    _scheduler.shutdown(wait=False)
    _started = False
    log.info("Workers scheduler stopped")

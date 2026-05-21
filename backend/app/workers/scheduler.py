"""APScheduler background scheduler — lifecycle managed by FastAPI lifespan.

Jobs:
  - price_refresh        : daily at 20:00 UTC (after US market close)
  - snapshot_writer      : daily at 21:00 UTC (end-of-day portfolio snapshots)
  - price_alert_checker  : daily at 20:30 UTC (check price alerts after price refresh)
  - goal_evaluation      : daily at 07:00 UTC (morning status sweep)
  - proactive_insights   : daily at 07:30 UTC (drift detection + AI insights + email)
  - notification_alerts  : daily at 08:30 UTC (email digest)
  - broker_auto_sync     : daily at 09:00 UTC (refresh prices for auto-sync accounts)
  - weekly_digest        : every Friday at 18:00 UTC (AI portfolio digest email)
  - market_prewarm       : every 30 minutes (keeps live market signal cache warm)
  - research_prewarm     : every 6 hours (keeps market research cache warm)

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
    from app.workers.jobs.broker_auto_sync import run_broker_auto_sync
    from app.workers.jobs.weekly_digest import send_weekly_digest
    from app.workers.jobs.proactive_insights import run_proactive_insights
    from app.workers.jobs.market_prewarm import prewarm_market_signals
    from app.workers.jobs.research_prewarm import prewarm_market_research
    from app.workers.jobs.sentiment_worker import run_sentiment_signals
    from app.workers.jobs.fx_history_sync import sync_fx_history
    from app.workers.jobs.net_worth_snapshot import write_net_worth_snapshots
    from app.workers.jobs.coach_refresh import refresh_all_coach_insights

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
        run_broker_auto_sync,
        CronTrigger(hour=9, minute=0),
        id="broker_auto_sync",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    _scheduler.add_job(
        run_proactive_insights,
        CronTrigger(hour=7, minute=30),
        id="proactive_insights",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    _scheduler.add_job(
        send_weekly_digest,
        CronTrigger(day_of_week="fri", hour=18, minute=0),
        id="weekly_digest",
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
    _scheduler.add_job(
        run_sentiment_signals,
        CronTrigger(hour=20, minute=15),   # after price_refresh (20:00), before snapshot (21:00)
        id="sentiment_signals",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    _scheduler.add_job(
        sync_fx_history,
        CronTrigger(hour=21, minute=30),   # after snapshot_writer (21:00)
        id="fx_history_sync",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    _scheduler.add_job(
        write_net_worth_snapshots,
        CronTrigger(hour=21, minute=15),   # after snapshot_writer (21:00)
        id="net_worth_snapshot",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    _scheduler.add_job(
        refresh_all_coach_insights,
        CronTrigger(hour=7, minute=45),    # after goal_evaluation + proactive_insights
        id="coach_refresh",
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
    log.info("Workers scheduler started (jobs: price_refresh, snapshot_writer, price_alert_checker, goal_evaluation, proactive_insights, notification_alerts, broker_auto_sync, weekly_digest, market_prewarm, research_prewarm, sentiment_signals, fx_history_sync)")


def stop() -> None:
    global _started
    if not _started:
        return
    _scheduler.shutdown(wait=False)
    _started = False
    log.info("Workers scheduler stopped")

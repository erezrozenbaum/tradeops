import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.broker_sync.status import get_outdated_accounts
from app.db.session import get_db
from app.goals_analysis import service as goals_analysis_service
from app.models.behavioral_risk_event import BehavioralRiskEvent
from app.models.portfolio_snapshot import PortfolioSnapshot
from app.models.price_alert import PriceAlert
from app.models.recurring_plan import RecurringPlan

router = APIRouter()


@router.get("")
def get_morning_brief(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)

    # Portfolio: last 2 snapshots for overnight delta
    snapshots = (
        db.query(PortfolioSnapshot)
        .filter(PortfolioSnapshot.investor_id == investor_id)
        .order_by(PortfolioSnapshot.snapshot_at.desc())
        .limit(2)
        .all()
    )
    portfolio = None
    if snapshots:
        latest = snapshots[0]
        prev = snapshots[1] if len(snapshots) > 1 else None
        overnight_delta = (latest.total_value - prev.total_value) if prev else None
        overnight_delta_pct = (
            (overnight_delta / prev.total_value * 100) if prev and prev.total_value else None
        )
        portfolio = {
            "value": round(latest.total_value, 2),
            "currency": latest.currency,
            "overnight_delta": round(overnight_delta, 2) if overnight_delta is not None else None,
            "overnight_delta_pct": round(overnight_delta_pct, 2) if overnight_delta_pct is not None else None,
            "snapshot_at": latest.snapshot_at.isoformat(),
            "pnl": round(latest.unrealized_pnl, 2),
            "pnl_pct": round(latest.unrealized_pnl_pct, 2),
        }

    # Goals health
    goals_summary = None
    analysis = goals_analysis_service.get_analysis(db, investor_id)
    if analysis:
        on_track = sum(1 for g in analysis.goals if g.status in ("on_track", "complete"))
        at_risk = sum(1 for g in analysis.goals if g.status == "at_risk")
        goals_summary = {
            "total": len(analysis.goals),
            "on_track": on_track,
            "at_risk": at_risk,
            "monthly_needed": analysis.total_monthly_contribution_needed,
        }

    # Triggered price alerts (most recent 5)
    triggered = (
        db.query(PriceAlert)
        .filter(
            PriceAlert.investor_id == investor_id,
            PriceAlert.triggered_at.isnot(None),
        )
        .order_by(PriceAlert.triggered_at.desc())
        .limit(5)
        .all()
    )
    triggered_alerts = [
        {
            "ticker": a.ticker,
            "alert_type": a.alert_type,
            "target_price": a.target_price,
            "triggered_price": a.triggered_price,
            "currency": a.currency,
            "triggered_at": a.triggered_at.isoformat(),
        }
        for a in triggered
    ]

    # Next recurring plan
    next_plan = (
        db.query(RecurringPlan)
        .filter(
            RecurringPlan.investor_id == investor_id,
            RecurringPlan.is_active.is_(True),
            RecurringPlan.next_run_at.isnot(None),
        )
        .order_by(RecurringPlan.next_run_at.asc())
        .first()
    )
    next_plan_data = None
    if next_plan:
        next_plan_data = {
            "id": str(next_plan.id),
            "name": next_plan.name,
            "frequency": next_plan.frequency,
            "next_run_at": next_plan.next_run_at.isoformat() if next_plan.next_run_at else None,
        }

    # Recent active behavioral risk events
    events = (
        db.query(BehavioralRiskEvent)
        .filter(
            BehavioralRiskEvent.investor_id == investor_id,
            BehavioralRiskEvent.status == "active",
        )
        .order_by(BehavioralRiskEvent.detected_at.desc())
        .limit(3)
        .all()
    )
    behavioral_events = [
        {
            "event_type": e.event_type,
            "severity": e.severity,
            "description": e.description,
            "recommendation": e.recommendation,
            "detected_at": e.detected_at.isoformat(),
        }
        for e in events
    ]

    # Broker sync warnings — accounts not synced in 25h+ (stale) or 72h+ (outdated)
    outdated_accounts = get_outdated_accounts(db, investor_id)
    broker_sync_warnings = [
        {
            "account_name": a["name"],
            "provider": a["provider"],
            "sync_status": a["sync_status"],
            "last_synced_at": a["last_synced_at"],
        }
        for a in outdated_accounts
    ]

    return {
        "generated_at": now.isoformat(),
        "portfolio": portfolio,
        "goals": goals_summary,
        "triggered_alerts": triggered_alerts,
        "next_plan": next_plan_data,
        "behavioral_events": behavioral_events,
        "broker_sync_warnings": broker_sync_warnings,
    }

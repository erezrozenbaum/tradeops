import uuid
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.portfolio_snapshot import PortfolioSnapshot

router = APIRouter()

_PERIOD_DAYS = {"1w": 7, "1m": 30, "3m": 90}


@router.get("/comparison")
def get_portfolio_comparison(
    investor_id: uuid.UUID,
    period: str = "1m",
    db: Session = Depends(get_db),
):
    days = _PERIOD_DAYS.get(period, 30)
    now = datetime.now(timezone.utc)
    target_date = now - timedelta(days=days)

    latest = (
        db.query(PortfolioSnapshot)
        .filter(PortfolioSnapshot.investor_id == investor_id)
        .order_by(PortfolioSnapshot.snapshot_at.desc())
        .first()
    )
    if not latest:
        raise HTTPException(status_code=404, detail="No portfolio snapshots found")

    past = (
        db.query(PortfolioSnapshot)
        .filter(
            PortfolioSnapshot.investor_id == investor_id,
            PortfolioSnapshot.snapshot_at <= target_date + timedelta(days=2),
        )
        .order_by(PortfolioSnapshot.snapshot_at.desc())
        .first()
    )
    if not past:
        past = (
            db.query(PortfolioSnapshot)
            .filter(
                PortfolioSnapshot.investor_id == investor_id,
                PortfolioSnapshot.id != latest.id,
            )
            .order_by(PortfolioSnapshot.snapshot_at.asc())
            .first()
        )

    if not past or past.id == latest.id:
        return {
            "period": period,
            "has_comparison": False,
            "value_now": round(latest.total_value, 2),
            "value_then": None,
            "value_delta": None,
            "value_delta_pct": None,
            "currency": latest.currency,
            "snapshot_at_now": latest.snapshot_at.isoformat(),
            "snapshot_at_then": None,
            "allocation_drift": [],
            "pnl_now": round(latest.unrealized_pnl, 2),
            "pnl_then": None,
        }

    value_delta = latest.total_value - past.total_value
    value_delta_pct = (value_delta / past.total_value * 100) if past.total_value else None

    all_keys = set(list(latest.asset_allocation.keys()) + list(past.asset_allocation.keys()))
    drift = []
    for k in sorted(all_keys):
        now_val = float(latest.asset_allocation.get(k) or 0)
        then_val = float(past.asset_allocation.get(k) or 0)
        drift.append({
            "label": k,
            "value_now": round(now_val, 2),
            "value_then": round(then_val, 2),
            "delta": round(now_val - then_val, 2),
        })

    return {
        "period": period,
        "has_comparison": True,
        "value_now": round(latest.total_value, 2),
        "value_then": round(past.total_value, 2),
        "value_delta": round(value_delta, 2),
        "value_delta_pct": round(value_delta_pct, 2) if value_delta_pct is not None else None,
        "currency": latest.currency,
        "snapshot_at_now": latest.snapshot_at.isoformat(),
        "snapshot_at_then": past.snapshot_at.isoformat(),
        "allocation_drift": drift,
        "pnl_now": round(latest.unrealized_pnl, 2),
        "pnl_then": round(past.unrealized_pnl, 2),
    }

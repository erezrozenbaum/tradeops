import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.investor_evolution import service
from app.investor_evolution.schemas import InvestorEvolutionReport, OverrideOrderOut
from app.models.staged_order import StagedOrder

router = APIRouter()


@router.get("", response_model=InvestorEvolutionReport)
def get_investor_evolution(
    investor_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """Rolling 90-day vs previous 90-day behavioral improvement report."""
    from app.core import cache
    key = f"iev:{investor_id}"
    cached = cache.get(key)
    if cached is not None:
        return cached
    report = service.get_investor_evolution(db, investor_id)
    cache.set(key, report.model_dump(), ttl=900)
    return report


@router.get("/overrides", response_model=list[OverrideOrderOut])
def get_current_window_overrides(
    investor_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """Return executed orders that were flagged 'reconsider' in the current 90-day window."""
    window_start = datetime.now(timezone.utc) - timedelta(days=90)
    orders = (
        db.query(StagedOrder)
        .filter(
            StagedOrder.investor_id == investor_id,
            StagedOrder.status == "executed",
            StagedOrder.created_at >= window_start,
        )
        .order_by(StagedOrder.created_at.desc())
        .all()
    )
    return [
        OverrideOrderOut(
            id=o.id,
            ticker=o.ticker,
            name=o.name,
            action=o.action,
            quantity=o.quantity,
            unit_price=o.unit_price,
            currency=o.currency,
            rationale=o.rationale,
            created_at=o.created_at,
        )
        for o in orders
        if (o.pre_flight_review or {}).get("verdict") == "reconsider"
    ]

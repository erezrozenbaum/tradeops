import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.decision_timeline import service
from app.decision_timeline.schemas import TimelinePage

router = APIRouter()


@router.get("", response_model=TimelinePage)
def get_timeline(
    investor_id: uuid.UUID,
    days: int = Query(30, ge=1, le=180),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """
    Unified chronological timeline merging AI decisions, coach insights,
    rebalance events, and portfolio transactions.
    Includes causal notes linking decisions to subsequent portfolio value changes.
    """
    return service.get_timeline(db, investor_id, days=days, limit=limit)

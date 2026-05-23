import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.strategy_drift import service
from app.strategy_drift.schemas import StrategyDriftReport

router = APIRouter()


@router.get("", response_model=StrategyDriftReport)
def get_strategy_drift(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    Compare current portfolio allocation against the investor's risk model targets.
    Returns per-tier drift, alignment score, and rebalancing guidance.
    """
    return service.compute_drift(db, investor_id)

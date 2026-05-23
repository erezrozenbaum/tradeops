import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.behavioral_patterns import service
from app.behavioral_patterns.schemas import BehavioralMetrics
from app.db.session import get_db

router = APIRouter()


@router.get("", response_model=BehavioralMetrics)
def get_behavioral_metrics(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    Analyze investor trading behavior over the last 12 months.
    Detects patterns such as overtrading, long-term discipline,
    strategy follow-through rate, and monthly trade frequency.
    Returns a behavioral score (0-100) where higher is more disciplined.
    """
    return service.compute_behavioral_metrics(db, investor_id)

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.decision_intelligence import service
from app.decision_intelligence.schemas import DecisionIntelligenceReport

router = APIRouter()


@router.get("", response_model=DecisionIntelligenceReport)
def get_decision_intelligence(
    investor_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """Compute the Decision Quality Score and behavioral insights for an investor."""
    return service.compute_decision_intelligence(db, investor_id)

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.behavioral_alpha import service
from app.behavioral_alpha.schemas import BehavioralAlphaReport

router = APIRouter()


@router.get("", response_model=BehavioralAlphaReport)
def get_behavioral_alpha(
    investor_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """Return behavioral alpha — how much decision discipline impacts actual returns."""
    return service.compute_behavioral_alpha(db, investor_id)

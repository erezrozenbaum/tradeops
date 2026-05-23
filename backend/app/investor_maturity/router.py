import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.investor_maturity import service
from app.investor_maturity.schemas import MaturitySnapshot

router = APIRouter()


@router.get("", response_model=MaturitySnapshot)
def get_maturity(
    investor_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    snap = service.get_latest_response(db, investor_id)
    if snap is None:
        # Compute on first access rather than returning 404
        return service.compute_and_respond(db, investor_id)
    return snap


@router.get("/history", response_model=list[MaturitySnapshot])
def get_maturity_history(
    investor_id: uuid.UUID,
    limit: int = Query(52, ge=1, le=104),
    db: Session = Depends(get_db),
):
    return service.get_history_response(db, investor_id, limit=limit)


@router.post("/refresh", response_model=MaturitySnapshot)
def refresh_maturity(
    investor_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    return service.compute_and_respond(db, investor_id)

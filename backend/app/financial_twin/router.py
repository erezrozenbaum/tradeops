import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.financial_twin import service
from app.financial_twin.schemas import HealthRadarSnapshot, TwinSnapshot

router = APIRouter()


@router.get("", response_model=TwinSnapshot)
def get_twin(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    return service.get_or_compute_twin_response(db, investor_id)


@router.get("/history", response_model=list[TwinSnapshot])
def get_twin_history(
    investor_id: uuid.UUID,
    limit: int = Query(30, ge=1, le=60),
    db: Session = Depends(get_db),
):
    return service.get_twin_history_response(db, investor_id, limit=limit)


@router.post("/refresh", response_model=TwinSnapshot)
def refresh_twin(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    twin, _ = service.refresh_and_respond(db, investor_id)
    return twin


health_router = APIRouter()


@health_router.get("", response_model=HealthRadarSnapshot)
def get_health_radar(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    return service.get_or_compute_health_response(db, investor_id)

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.behavioral_risk import service
from app.behavioral_risk.schemas import BehavioralRiskEventResponse, BehavioralRiskListResponse
from app.db.session import get_db

router = APIRouter()


@router.get("", response_model=BehavioralRiskListResponse)
def list_behavioral_risk_events(
    investor_id: uuid.UUID,
    status: str | None = Query(default=None, pattern="^(active|resolved|acknowledged)$"),
    db: Session = Depends(get_db),
):
    return service.get_events_response(db, investor_id, status=status)


@router.get("/{event_id}", response_model=BehavioralRiskEventResponse)
def get_behavioral_risk_event(
    investor_id: uuid.UUID,
    event_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    result = service.get_event_response(db, investor_id, event_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return result


@router.post("/{event_id}/resolve", response_model=BehavioralRiskEventResponse)
def resolve_behavioral_risk_event(
    investor_id: uuid.UUID,
    event_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    result = service.resolve_event(db, investor_id, event_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return result


@router.post("/detect", response_model=BehavioralRiskListResponse)
def run_detection(
    investor_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    return service.run_detection_response(db, investor_id)

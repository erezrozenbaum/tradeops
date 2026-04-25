import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.audit_event import AuditEvent
from app.schemas.audit_event import AuditEventOut

router = APIRouter()


@router.get("/{investor_id}/audit-events", response_model=list[AuditEventOut])
def list_audit_events(
    investor_id: uuid.UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    return (
        db.query(AuditEvent)
        .filter(AuditEvent.investor_profile_id == investor_id)
        .order_by(AuditEvent.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

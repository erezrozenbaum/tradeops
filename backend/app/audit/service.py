import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.models.audit_event import AuditEvent


def log_event(
    db: Session,
    event_type: str,
    description: str,
    investor_profile_id: uuid.UUID | None = None,
    metadata: dict[str, Any] | None = None,
) -> AuditEvent:
    event = AuditEvent(
        investor_profile_id=investor_profile_id,
        event_type=event_type,
        description=description,
        event_metadata=metadata,
    )
    db.add(event)
    db.flush()
    return event

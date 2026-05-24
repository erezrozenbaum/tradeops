from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.advisor_share_token import AdvisorShareToken

_TOKEN_TTL_DAYS = 7


def create_token(db: Session, investor_id: uuid.UUID) -> AdvisorShareToken:
    now = datetime.now(timezone.utc)
    entry = AdvisorShareToken(
        investor_id=investor_id,
        token=secrets.token_urlsafe(32),
        created_at=now,
        expires_at=now + timedelta(days=_TOKEN_TTL_DAYS),
        revoked=False,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def revoke_token(db: Session, investor_id: uuid.UUID, token_str: str) -> bool:
    entry = (
        db.query(AdvisorShareToken)
        .filter(
            AdvisorShareToken.token == token_str,
            AdvisorShareToken.investor_id == investor_id,
        )
        .first()
    )
    if not entry:
        return False
    entry.revoked = True
    db.commit()
    return True


def list_active(db: Session, investor_id: uuid.UUID) -> list[AdvisorShareToken]:
    now = datetime.now(timezone.utc)
    return (
        db.query(AdvisorShareToken)
        .filter(
            AdvisorShareToken.investor_id == investor_id,
            AdvisorShareToken.revoked == False,  # noqa: E712
            AdvisorShareToken.expires_at > now,
        )
        .order_by(AdvisorShareToken.created_at.desc())
        .all()
    )


def get_valid(db: Session, token_str: str) -> AdvisorShareToken | None:
    now = datetime.now(timezone.utc)
    return (
        db.query(AdvisorShareToken)
        .filter(
            AdvisorShareToken.token == token_str,
            AdvisorShareToken.revoked == False,  # noqa: E712
            AdvisorShareToken.expires_at > now,
        )
        .first()
    )

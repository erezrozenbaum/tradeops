"""Longitudinal AI memory — stores and retrieves rolling 3-month window of portfolio assessments."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.ai_memory_entry import AIMemoryEntry


def write_entry(
    db: Session,
    investor_id: uuid.UUID,
    verbosity: str,
    portfolio_assessment: str,
    key_metrics: dict | None = None,
) -> None:
    entry = AIMemoryEntry(
        investor_id=investor_id,
        summary_at=datetime.now(timezone.utc),
        verbosity=verbosity,
        portfolio_assessment=portfolio_assessment,
        key_metrics=key_metrics,
    )
    db.add(entry)
    db.commit()


def get_recent(
    db: Session,
    investor_id: uuid.UUID,
    months: int = 3,
    limit: int = 12,
) -> list[AIMemoryEntry]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=months * 30)
    return (
        db.query(AIMemoryEntry)
        .filter(
            AIMemoryEntry.investor_id == investor_id,
            AIMemoryEntry.summary_at >= cutoff,
        )
        .order_by(AIMemoryEntry.summary_at.desc())
        .limit(limit)
        .all()
    )

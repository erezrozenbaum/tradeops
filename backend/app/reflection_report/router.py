import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.reflection_report import service
from app.reflection_report.schemas import MonthlyReflectionReport

router = APIRouter()


@router.get("", response_model=MonthlyReflectionReport)
def get_reflection_report(
    investor_id: uuid.UUID,
    month: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}$", description="YYYY-MM"),
    db: Session = Depends(get_db),
):
    """Return the monthly investor reflection report for a given month (defaults to current)."""
    from datetime import datetime, timezone
    from app.core import cache
    resolved_month = month or datetime.now(timezone.utc).strftime("%Y-%m")
    key = f"rr:{investor_id}:{resolved_month}"
    cached = cache.get(key)
    if cached is not None:
        return cached
    report = service.compute_reflection_report(db, investor_id, month=month)
    cache.set(key, report.model_dump(), ttl=1800)
    return report

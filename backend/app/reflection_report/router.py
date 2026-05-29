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
    return service.compute_reflection_report(db, investor_id, month=month)

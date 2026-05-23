import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.attribution import service
from app.attribution.schemas import PerformanceAttribution
from app.db.session import get_db

router = APIRouter()


@router.get("", response_model=PerformanceAttribution)
def get_attribution(
    investor_id: uuid.UUID,
    period: Literal["ytd", "1y", "6m", "3m"] = Query("ytd"),
    db: Session = Depends(get_db),
):
    """
    Break down portfolio value change into constituent factors:
    capital deployed vs. market return vs. fees drag.
    Includes a multi-dimensional confidence score based on data quality.
    """
    result = service.compute_attribution(db, investor_id, period=period)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Not enough portfolio snapshots to compute attribution. "
            "Generate a portfolio analysis first.",
        )
    return result

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.ai_analysis import service
from app.core.config import settings
from app.db.session import get_db
from app.schemas.ai_analysis import AnalysisReportOut

router = APIRouter()


@router.post("", response_model=AnalysisReportOut, status_code=status.HTTP_201_CREATED)
def generate_report(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="AI analysis is unavailable — ANTHROPIC_API_KEY not configured.",
        )

    result = service.generate(db, investor_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Investor not found.")

    return result

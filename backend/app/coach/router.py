import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.coach import service

router = APIRouter()


class CoachInsightOut(BaseModel):
    id: uuid.UUID
    insight_type: str
    severity: str
    title: str
    message: str
    action_text: str | None
    link: str | None
    generated_at: datetime

    model_config = {"from_attributes": True}


@router.get("", response_model=list[CoachInsightOut])
def get_coach_insights(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    return service.get_insights(db, investor_id)


@router.post("/refresh", response_model=list[CoachInsightOut])
def refresh_coach_insights(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    return service.refresh_insights(db, investor_id, api_key=settings.ANTHROPIC_API_KEY)


@router.delete("/{insight_id}", status_code=status.HTTP_204_NO_CONTENT)
def dismiss_insight(investor_id: uuid.UUID, insight_id: uuid.UUID, db: Session = Depends(get_db)):
    if not service.dismiss_insight(db, investor_id, insight_id):
        raise HTTPException(status_code=404, detail="Insight not found")

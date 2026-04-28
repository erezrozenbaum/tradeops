import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.goals_analysis import service
from app.goals_analysis.schemas import GoalsAnalysisResult

router = APIRouter()


@router.get("", response_model=GoalsAnalysisResult)
def get_goals_analysis(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    result = service.get_analysis(db, investor_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Investor not found")
    return result

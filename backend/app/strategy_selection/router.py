import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.strategy import StrategyRecommendationOut
from app.strategy_selection import service

router = APIRouter()


@router.post("", response_model=list[StrategyRecommendationOut], status_code=status.HTTP_201_CREATED)
def generate_recommendations(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    result = service.generate(db, investor_id)
    if result is None:
        raise HTTPException(
            status_code=422,
            detail="Cannot generate strategy recommendations — investor profile or risk model not found. Generate a risk model first.",
        )
    return result


@router.get("", response_model=list[StrategyRecommendationOut])
def get_recommendations(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    return service.get_latest(db, investor_id)

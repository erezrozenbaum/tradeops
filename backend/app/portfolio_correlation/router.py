import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.portfolio_correlation import engine
from app.portfolio_correlation.schemas import CorrelationResult

router = APIRouter()


@router.get("/correlation", response_model=CorrelationResult)
def get_correlation(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    result = engine.compute(db, investor_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Investor not found")
    return result

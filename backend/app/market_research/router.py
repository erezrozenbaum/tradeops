"""Market Research router — deep fundamental analysis + AI investment brief."""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.market_research import service
from app.market_research.schemas import MarketResearchReport

router = APIRouter()


@router.get("/", response_model=MarketResearchReport)
def get_market_research(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    result = service.get_research(db, investor_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Investor not found")
    return result

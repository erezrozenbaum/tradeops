import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.portfolio_analysis import service
from app.portfolio_analysis.schemas import PortfolioSummary

router = APIRouter()


@router.get("", response_model=PortfolioSummary)
def get_portfolio(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    summary = service.get_portfolio(db, investor_id)
    if summary is None:
        raise HTTPException(status_code=404, detail="Investor not found")
    return summary

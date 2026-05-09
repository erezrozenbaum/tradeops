import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.holdings_news import service
from app.holdings_news.schemas import NewsFeedResult

router = APIRouter()


@router.get("", response_model=NewsFeedResult)
def get_news(
    investor_id: uuid.UUID,
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    result = service.get_news(db, investor_id, limit=limit)
    if result is None:
        raise HTTPException(status_code=404, detail="Investor not found")
    return result

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.market_data import service

router = APIRouter()


class QuoteResponse(BaseModel):
    ticker: str
    price: float
    currency: str
    cached: bool


@router.get("/quote/{ticker}", response_model=QuoteResponse)
def get_quote(ticker: str, force_refresh: bool = False, db: Session = Depends(get_db)):
    ticker = ticker.upper()
    if force_refresh:
        snapshot = service.fetch_and_cache(db, ticker)
    else:
        snapshot = service.get_or_fetch(db, ticker)

    if snapshot is None:
        raise HTTPException(status_code=503, detail=f"Price unavailable for {ticker}")

    cached = not force_refresh and service.get_cached_price(db, ticker) is not None
    return QuoteResponse(ticker=ticker, price=snapshot.price, currency=snapshot.currency, cached=cached)

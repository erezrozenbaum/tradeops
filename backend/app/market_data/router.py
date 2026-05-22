import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import SessionLocal, get_db
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


@router.get("/stream")
async def price_stream(
    tickers: str = Query(..., description="Comma-separated ticker list, e.g. AAPL,MSFT,ETH"),
    interval: int = Query(30, ge=5, le=300, description="Refresh interval in seconds"),
):
    """Server-Sent Events stream — pushes price updates at the given interval.

    Connect with EventSource('/api/v1/market/stream?tickers=AAPL,MSFT').
    Each event is a JSON object: { AAPL: {price, currency, fetched_at}, ... }
    Sends one initial event immediately, then every `interval` seconds.
    """
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()][:20]

    async def _fetch_prices() -> dict:
        loop = asyncio.get_event_loop()

        def _sync_fetch():
            db = SessionLocal()
            try:
                prices = {}
                for ticker in ticker_list:
                    snap = service.get_or_fetch(db, ticker)
                    if snap:
                        prices[ticker] = {
                            "price": snap.price,
                            "currency": snap.currency,
                            "fetched_at": snap.fetched_at.isoformat(),
                        }
                return prices
            finally:
                db.close()

        return await loop.run_in_executor(None, _sync_fetch)

    async def event_generator():
        try:
            while True:
                prices = await _fetch_prices()
                if prices:
                    payload = json.dumps(prices)
                    yield f"data: {payload}\n\n"
                await asyncio.sleep(interval)
        except asyncio.CancelledError:
            pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",     # disable nginx buffering for SSE
            "Connection": "keep-alive",
        },
    )

import logging
import uuid
from datetime import datetime
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.paper_trade import PaperPosition
from app.paper_trading import service
from app.schemas.paper_trade import (
    AdvanceTickRequest,
    PaperOrderCreate,
    PaperPortfolioCreate,
    PaperPortfolioOut,
    PaperPortfolioRename,
    PaperPortfolioSummaryOut,
)

log = logging.getLogger(__name__)

_YF_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
_YF_HEADERS = {"User-Agent": "Mozilla/5.0"}
_PERIOD_RANGE = {"1m": "1mo", "3m": "3mo", "6m": "6mo"}


def _fetch_price_history(ticker: str, yf_range: str) -> list[dict]:
    """Fetch daily closes from Yahoo Finance. Returns [{date, price}]."""
    try:
        r = httpx.get(
            _YF_URL.format(ticker=ticker),
            params={"interval": "1d", "range": yf_range},
            headers=_YF_HEADERS,
            timeout=8,
        )
        data = r.json()
        result_obj = data.get("chart", {}).get("result", [])
        if not result_obj:
            return []
        ts = result_obj[0].get("timestamp", [])
        closes = result_obj[0].get("indicators", {}).get("quote", [{}])[0].get("close", [])
        points = []
        for t, c in zip(ts, closes):
            if c is None:
                continue
            points.append({"date": datetime.utcfromtimestamp(t).strftime("%Y-%m-%d"), "price": round(c, 4)})
        return points
    except Exception as exc:
        log.debug("Price history fetch failed for %s: %s", ticker, exc)
        return []

router = APIRouter()


@router.post("", response_model=PaperPortfolioOut, status_code=status.HTTP_201_CREATED)
def create_portfolio(
    investor_id: uuid.UUID,
    body: PaperPortfolioCreate,
    db: Session = Depends(get_db),
):
    portfolio = service.create(
        db,
        investor_id=investor_id,
        initial_cash=body.initial_cash,
        currency=body.currency,
        strategy_template_id=body.strategy_template_id,
        backtest_run_id=body.backtest_run_id,
        name=body.name,
    )
    if portfolio is None:
        raise HTTPException(
            status_code=422,
            detail="Cannot create paper portfolio — investor not found or strategy template is inactive.",
        )
    return service.build_enriched_out(db, portfolio)


@router.get("", response_model=list[PaperPortfolioSummaryOut])
def list_portfolios(
    investor_id: uuid.UUID,
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    return service.list_for_investor(db, investor_id, skip=skip, limit=limit)


@router.get("/{portfolio_id}", response_model=PaperPortfolioOut)
def get_portfolio(
    investor_id: uuid.UUID, portfolio_id: uuid.UUID, db: Session = Depends(get_db)
):
    portfolio = service.get(db, investor_id, portfolio_id)
    if not portfolio:
        raise HTTPException(status_code=404, detail="Paper portfolio not found.")
    return service.build_enriched_out(db, portfolio)


@router.patch("/{portfolio_id}", response_model=PaperPortfolioSummaryOut)
def rename_portfolio(
    investor_id: uuid.UUID,
    portfolio_id: uuid.UUID,
    body: PaperPortfolioRename,
    db: Session = Depends(get_db),
):
    portfolio = service.rename_portfolio(db, investor_id, portfolio_id, body.name)
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Paper portfolio not found.")
    return portfolio


@router.post("/{portfolio_id}/orders", response_model=PaperPortfolioOut)
def place_order(
    investor_id: uuid.UUID,
    portfolio_id: uuid.UUID,
    body: PaperOrderCreate,
    db: Session = Depends(get_db),
):
    portfolio = service.place_order(
        db,
        investor_id=investor_id,
        portfolio_id=portfolio_id,
        symbol=body.symbol,
        side=body.side,
        quantity=body.quantity,
        price_per_share=body.price_per_share,
    )
    return service.build_enriched_out(db, portfolio)


@router.post("/{portfolio_id}/reprice", response_model=PaperPortfolioOut)
def reprice_positions(
    investor_id: uuid.UUID,
    portfolio_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """Fetch live market prices for all positions and recompute portfolio value."""
    portfolio = service.reprice_positions(db, investor_id=investor_id, portfolio_id=portfolio_id)
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Paper portfolio not found.")
    return service.build_enriched_out(db, portfolio)


@router.post("/{portfolio_id}/tick", response_model=PaperPortfolioOut)
def advance_tick(
    investor_id: uuid.UUID,
    portfolio_id: uuid.UUID,
    body: AdvanceTickRequest,
    db: Session = Depends(get_db),
):
    portfolio = service.advance_tick(
        db, investor_id=investor_id, portfolio_id=portfolio_id, seed=body.seed
    )
    if portfolio is None:
        raise HTTPException(
            status_code=422,
            detail="Cannot advance tick — portfolio not found, not active, or has no strategy template.",
        )
    return service.build_enriched_out(db, portfolio)


@router.post("/{portfolio_id}/close", response_model=PaperPortfolioOut)
def close_portfolio(
    investor_id: uuid.UUID,
    portfolio_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    portfolio = service.close_portfolio(db, investor_id=investor_id, portfolio_id=portfolio_id)
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Paper portfolio not found.")
    return service.build_enriched_out(db, portfolio)


class PromoteRequest(BaseModel):
    rationale: Optional[str] = None


@router.post(
    "/{portfolio_id}/positions/{position_id}/promote",
    status_code=status.HTTP_201_CREATED,
)
def promote_position(
    investor_id: uuid.UUID,
    portfolio_id: uuid.UUID,
    position_id: uuid.UUID,
    body: PromoteRequest = PromoteRequest(),
    db: Session = Depends(get_db),
):
    """Create a real staged buy order from a paper position."""
    return service.promote_position_to_real(db, investor_id, portfolio_id, position_id, rationale=body.rationale)


@router.get("/{portfolio_id}/positions/{position_id}/price-history")
def get_position_price_history(
    investor_id: uuid.UUID,
    portfolio_id: uuid.UUID,
    position_id: uuid.UUID,
    period: str = Query("3m", pattern="^(1m|3m|6m)$"),
    db: Session = Depends(get_db),
):
    """Return real market price history for a paper position since its entry date."""
    portfolio = service.get(db, investor_id, portfolio_id)
    if not portfolio:
        raise HTTPException(status_code=404, detail="Paper portfolio not found.")

    position = db.get(PaperPosition, position_id)
    if not position or position.portfolio_id != portfolio_id:
        raise HTTPException(status_code=404, detail="Position not found.")

    yf_range = _PERIOD_RANGE.get(period, "3mo")
    points = _fetch_price_history(position.symbol, yf_range)

    # Filter to only dates >= entry date
    entry_date = position.created_at.strftime("%Y-%m-%d")
    points = [p for p in points if p["date"] >= entry_date]

    # Compute return_pct relative to entry price for each point
    entry_price = position.avg_cost_per_share
    enriched = []
    for p in points:
        ret = round((p["price"] - entry_price) / entry_price * 100, 4) if entry_price > 0 else 0.0
        enriched.append({"date": p["date"], "price": p["price"], "return_pct": ret})

    current_price = enriched[-1]["price"] if enriched else None
    total_return_pct = enriched[-1]["return_pct"] if enriched else None

    return {
        "symbol": position.symbol,
        "entry_date": entry_date,
        "entry_price": entry_price,
        "period": period,
        "currency": position.currency,
        "points": enriched,
        "current_price": current_price,
        "total_return_pct": total_return_pct,
    }


@router.delete("/{portfolio_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_portfolio(
    investor_id: uuid.UUID,
    portfolio_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    deleted = service.delete_portfolio(db, investor_id=investor_id, portfolio_id=portfolio_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Paper portfolio not found.")

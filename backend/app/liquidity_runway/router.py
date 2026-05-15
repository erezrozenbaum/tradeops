import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.liquidity_runway.engine import compute_liquidity_runway
from app.liquidity_runway.schemas import LiquidityRunway

router = APIRouter()


@router.get("/liquidity-runway", response_model=LiquidityRunway)
def get_liquidity_runway(
    investor_id: uuid.UUID,
    target_amount: Optional[float] = Query(None, ge=0, description="Cash target in base currency"),
    db: Session = Depends(get_db),
):
    """Liquidity tier breakdown of current portfolio with optional emergency lever.

    Returns holdings grouped into three buckets:
    - Tier 1 (1–3 Days): stocks, ETFs, crypto, options
    - Tier 2 (1 Week): bonds, funds
    - Tier 3 (Locked): pension funds, keren hishtalmut, real estate

    Net-to-pocket = gross_value − estimated_tax − market_impact_buffer.

    If target_amount is provided, the emergency lever greedily selects the cheapest
    holdings to liquidate (lowest cost ratio first) until the target is met.
    """
    from app.portfolio_analysis.service import get_portfolio
    from app.models.investor_profile import InvestorProfile

    investor = db.get(InvestorProfile, investor_id)
    if investor is None:
        raise HTTPException(status_code=404, detail="Investor not found")

    portfolio = get_portfolio(db, investor_id)
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Investor not found")

    country = investor.country or "US"
    return compute_liquidity_runway(portfolio, investor_id, country, target_amount)

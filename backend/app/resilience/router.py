import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.resilience.engine import compute_resilience
from app.resilience.schemas import LifeEventRequest, ResilienceResult

router = APIRouter()


@router.post("/resilience", response_model=ResilienceResult)
def simulate_resilience(
    investor_id: uuid.UUID,
    request: LifeEventRequest,
    db: Session = Depends(get_db),
):
    """Simulate a life-event scenario (job loss, expense spike) against the current portfolio.

    Uses the Liquidity Runway tiers to build a depletion path — cash reserve first,
    then Tier 1 (T+2) holdings, then Tier 2 (1-week) holdings — and determines whether
    Tier 3 (locked: pension, real estate) must be broken to survive the scenario.

    Returns a Survival Score (0–100) and an optional AI-generated recommendation.
    AI recommendation is included when ANTHROPIC_API_KEY is configured.
    """
    from app.portfolio_analysis.service import get_portfolio
    from app.financial_profiles.service import get_by_investor
    from app.models.investor_profile import InvestorProfile

    investor = db.get(InvestorProfile, investor_id)
    if investor is None:
        raise HTTPException(status_code=404, detail="Investor not found")

    portfolio = get_portfolio(db, investor_id)
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Portfolio not found — add investment accounts first")

    financial_profile = get_by_investor(db, investor_id)
    country = investor.country or "US"

    return compute_resilience(
        portfolio=portfolio,
        financial_profile=financial_profile,
        investor_id=investor_id,
        country=country,
        request=request,
        api_key=settings.ANTHROPIC_API_KEY or None,
    )

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.family_portfolio.engine import compute_family_portfolio
from app.family_portfolio.schemas import FamilyPortfolioSummary

router = APIRouter()


@router.get("", response_model=FamilyPortfolioSummary)
def get_family_portfolio(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    """Aggregate all investment accounts by family member, grouped by generation.

    Returns household AUM, per-member breakdown, asset allocation, and
    cross-member ticker overlap. Minor members are flagged with education_mode=True.
    Returns 404 if no family profile exists for this investor.
    """
    result = compute_family_portfolio(db, investor_id)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail="No family profile found for this investor. Create one via /family-profiles.",
        )
    return result

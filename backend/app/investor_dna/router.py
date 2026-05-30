import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.investor_dna import service
from app.investor_dna.schemas import InvestorDnaReport

router = APIRouter()


@router.get("", response_model=InvestorDnaReport)
def get_investor_dna(
    investor_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """Return a synthesised Investor DNA profile — edge, risks, leakage, and recommendation."""
    from app.core import cache
    key = f"idna:{investor_id}"
    cached = cache.get(key)
    if cached is not None:
        return cached
    report = service.get_investor_dna(db, investor_id)
    cache.set(key, report.model_dump(), ttl=900)
    return report

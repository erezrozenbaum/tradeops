import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.investor_evolution import service
from app.investor_evolution.schemas import InvestorEvolutionReport

router = APIRouter()


@router.get("", response_model=InvestorEvolutionReport)
def get_investor_evolution(
    investor_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """Rolling 90-day vs previous 90-day behavioral improvement report."""
    from app.core import cache
    key = f"iev:{investor_id}"
    cached = cache.get(key)
    if cached is not None:
        return cached
    report = service.get_investor_evolution(db, investor_id)
    cache.set(key, report.model_dump(), ttl=900)
    return report

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.investor_dna import service
from app.investor_dna.schemas import InvestorDnaReport, PreFlightPreviewResponse

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


@router.get("/pre-flight-preview", response_model=PreFlightPreviewResponse)
def get_pre_flight_preview(
    investor_id: uuid.UUID,
    ticker: str = Query(..., min_length=1, max_length=10),
    db: Session = Depends(get_db),
):
    """Fast read-only correlation preview for a ticker before order submission.

    Backed entirely by local price_snapshots and holdings data — no external calls.
    Returns INSUFFICIENT_DATA / ISOLATED_ASSET silently when local data is thin.
    """
    from app.services.correlation_engine import compute_portfolio_correlation

    result = compute_portfolio_correlation(db, investor_id, ticker.upper().strip())

    status_map = {"SUCCESS": "PREVIEW_READY"}
    mapped_status = status_map.get(result["status"], result["status"])

    return PreFlightPreviewResponse(
        status=mapped_status,
        correlation_risk_tier=result.get("risk_tier"),
        avg_correlation=result.get("avg_correlation"),
        insight=result.get("insight"),
    )

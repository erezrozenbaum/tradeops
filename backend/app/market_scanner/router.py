import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.audit import service as audit
from app.db.session import get_db
from app.market_scanner import service
from app.market_scanner.schemas import MarketScanResult

router = APIRouter()


@router.get("", response_model=MarketScanResult)
def get_market_scan(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    result = service.get_scan(db, investor_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Investor profile not found")

    audit.log_event(
        db,
        event_type="market_scan.generated",
        description=f"Market scan generated: {len(result.suggestions)} suggestion(s)",
        investor_profile_id=investor_id,
        metadata={
            "readiness_classification": result.readiness_classification,
            "suggestion_count": len(result.suggestions),
        },
    )
    db.commit()

    return result

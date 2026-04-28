import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.audit import service as audit
from app.db.session import get_db
from app.investment_recommendations import service
from app.investment_recommendations.schemas import RecommendationReport

router = APIRouter()


@router.get("", response_model=RecommendationReport)
def get_recommendations(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    """Generate AI-powered personalised investment recommendations for this investor."""
    result = service.get_recommendations(db, investor_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Investor not found")

    audit.log_event(
        db,
        event_type="investment_recommendations.generated",
        description="Personalised investment recommendations generated.",
        investor_profile_id=investor_id,
        metadata={"recommendation_count": len(result.recommendations)},
    )
    db.commit()

    return result

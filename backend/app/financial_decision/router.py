import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.audit import service as audit
from app.db.session import get_db
from app.financial_decision import service
from app.financial_decision.schemas import InvestmentDecision

router = APIRouter()


@router.get("", response_model=InvestmentDecision)
def get_investment_decision(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    decision = service.get_decision(db, investor_id)
    if decision is None:
        raise HTTPException(status_code=404, detail="Investor profile not found")

    audit.log_event(
        db,
        event_type="decision.evaluated",
        description=f"Investment decision evaluated: {decision.readiness_classification}",
        investor_profile_id=investor_id,
        metadata={
            "can_invest": decision.can_invest,
            "readiness_classification": decision.readiness_classification,
            "recommended_investment_pct": decision.recommended_investment_pct,
        },
    )
    db.commit()

    return decision

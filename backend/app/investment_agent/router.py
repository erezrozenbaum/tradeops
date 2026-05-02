import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.investment_agent import engine
from app.investment_agent.schemas import AgentReport
from app.models.investor_profile import InvestorProfile

router = APIRouter()


@router.get("", response_model=AgentReport)
def get_agent_report(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    if not db.get(InvestorProfile, investor_id):
        raise HTTPException(status_code=404, detail="Investor not found")
    return engine.run_agent(db, investor_id)

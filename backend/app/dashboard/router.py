import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dashboard import service
from app.db.session import get_db
from app.schemas.dashboard import DashboardOut

router = APIRouter()


@router.get("/{investor_id}/dashboard", response_model=DashboardOut)
def get_dashboard(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    dashboard = service.get_dashboard(db, investor_id)
    if dashboard is None:
        raise HTTPException(status_code=404, detail="Investor profile not found")
    return dashboard

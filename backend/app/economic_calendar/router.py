import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.economic_calendar import service
from app.economic_calendar.schemas import CalendarResult

router = APIRouter()


@router.get("", response_model=CalendarResult)
def get_calendar(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    result = service.get_calendar(db, investor_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Investor not found")
    return result

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.notifications.center import AppNotification, get_notifications

router = APIRouter()


@router.get("", response_model=list[AppNotification])
def list_notifications(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    return get_notifications(db, investor_id)

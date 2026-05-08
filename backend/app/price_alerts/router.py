import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.price_alerts import service
from app.price_alerts.schemas import PriceAlertCreate, PriceAlertOut

router = APIRouter()


@router.get("", response_model=list[PriceAlertOut])
def list_alerts(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    return service.list_alerts(db, investor_id)


@router.post("", response_model=PriceAlertOut, status_code=201)
def create_alert(investor_id: uuid.UUID, body: PriceAlertCreate, db: Session = Depends(get_db)):
    try:
        return service.create_alert(db, investor_id, body)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.delete("/{alert_id}", status_code=204)
def delete_alert(alert_id: uuid.UUID, investor_id: uuid.UUID, db: Session = Depends(get_db)):
    alert = service.get_alert(db, alert_id)
    if not alert or alert.investor_id != investor_id:
        raise HTTPException(status_code=404, detail="Alert not found")
    service.delete_alert(db, alert)

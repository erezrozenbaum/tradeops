import uuid
from sqlalchemy.orm import Session

from app.models.price_alert import PriceAlert
from app.price_alerts.schemas import PriceAlertCreate


def list_alerts(db: Session, investor_id: uuid.UUID) -> list[PriceAlert]:
    return (
        db.query(PriceAlert)
        .filter(PriceAlert.investor_id == investor_id)
        .order_by(PriceAlert.created_at.desc())
        .all()
    )


def get_alert(db: Session, alert_id: uuid.UUID) -> PriceAlert | None:
    return db.get(PriceAlert, alert_id)


def create_alert(db: Session, investor_id: uuid.UUID, data: PriceAlertCreate) -> PriceAlert:
    if data.alert_type not in {"above", "below"}:
        raise ValueError("alert_type must be 'above' or 'below'")
    alert = PriceAlert(
        id=uuid.uuid4(),
        investor_id=investor_id,
        ticker=data.ticker.upper(),
        asset_name=data.asset_name,
        alert_type=data.alert_type,
        target_price=data.target_price,
        currency=data.currency,
        is_active=True,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


def delete_alert(db: Session, alert: PriceAlert) -> None:
    db.delete(alert)
    db.commit()


def get_active_alerts_for_ticker(db: Session, ticker: str) -> list[PriceAlert]:
    return (
        db.query(PriceAlert)
        .filter(PriceAlert.ticker == ticker.upper(), PriceAlert.is_active == True)  # noqa: E712
        .all()
    )

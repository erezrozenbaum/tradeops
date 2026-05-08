import uuid
from datetime import datetime
from pydantic import BaseModel


class PriceAlertCreate(BaseModel):
    ticker: str
    asset_name: str | None = None
    alert_type: str  # above | below
    target_price: float
    currency: str = "USD"


class PriceAlertOut(BaseModel):
    id: uuid.UUID
    investor_id: uuid.UUID
    ticker: str
    asset_name: str | None
    alert_type: str
    target_price: float
    currency: str
    is_active: bool
    triggered_at: datetime | None
    triggered_price: float | None
    created_at: datetime

    class Config:
        from_attributes = True

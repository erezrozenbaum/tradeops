import uuid
from datetime import datetime

from pydantic import BaseModel


class WatchlistItemCreate(BaseModel):
    ticker: str
    name: str
    asset_type: str
    notes: str | None = None


class WatchlistItemOut(BaseModel):
    id: uuid.UUID
    investor_id: uuid.UUID
    ticker: str
    name: str
    asset_type: str
    notes: str | None
    added_at: datetime
    current_price: float | None = None
    price_currency: str | None = None
    price_age_hours: float | None = None

    model_config = {"from_attributes": True}

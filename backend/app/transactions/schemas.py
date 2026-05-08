import uuid
from datetime import date, datetime
from pydantic import BaseModel

TX_TYPES = {"buy", "sell", "dividend", "fee", "split", "bonus"}


class TransactionCreate(BaseModel):
    account_id: uuid.UUID
    holding_id: uuid.UUID | None = None
    transaction_type: str  # buy | sell | dividend | fee | split | bonus
    ticker: str | None = None
    asset_name: str | None = None
    quantity: float | None = None
    price_per_unit: float | None = None
    total_amount: float
    fees: float = 0.0
    currency: str
    transaction_date: date
    notes: str | None = None


class TransactionUpdate(BaseModel):
    transaction_type: str | None = None
    ticker: str | None = None
    asset_name: str | None = None
    quantity: float | None = None
    price_per_unit: float | None = None
    total_amount: float | None = None
    fees: float | None = None
    currency: str | None = None
    transaction_date: date | None = None
    notes: str | None = None


class TransactionOut(BaseModel):
    id: uuid.UUID
    investor_id: uuid.UUID
    account_id: uuid.UUID
    holding_id: uuid.UUID | None
    transaction_type: str
    ticker: str | None
    asset_name: str | None
    quantity: float | None
    price_per_unit: float | None
    total_amount: float
    fees: float
    currency: str
    transaction_date: date
    notes: str | None
    created_at: datetime

    class Config:
        from_attributes = True

from pydantic import BaseModel


class BrokerImportRow(BaseModel):
    ticker: str | None = None
    isin: str | None = None
    name: str
    asset_type: str = "other"
    quantity: float = 0.0
    avg_buy_price: float = 0.0
    current_value: float | None = None
    currency: str = "USD"


class BrokerSyncResult(BaseModel):
    broker_type: str
    imported: int
    updated: int
    skipped: int
    errors: list[str]

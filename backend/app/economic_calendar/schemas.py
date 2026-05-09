import uuid
from datetime import date
from pydantic import BaseModel


class EarningsEvent(BaseModel):
    ticker: str
    company_name: str
    earnings_date: date | None
    eps_estimate: float | None
    revenue_estimate: float | None  # in millions
    source: str  # "holdings" | "watchlist"


class CalendarResult(BaseModel):
    investor_id: uuid.UUID
    events: list[EarningsEvent]
    tickers_checked: int
    tickers_with_dates: int

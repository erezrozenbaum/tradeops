import uuid
from datetime import datetime
from pydantic import BaseModel


class NewsItem(BaseModel):
    ticker: str
    title: str
    publisher: str
    url: str
    published_at: datetime | None
    summary: str | None = None
    source: str  # "holdings" | "watchlist"


class NewsFeedResult(BaseModel):
    investor_id: uuid.UUID
    items: list[NewsItem]
    tickers_checked: int

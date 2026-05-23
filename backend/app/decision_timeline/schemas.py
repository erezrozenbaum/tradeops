import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel


class TimelineEvent(BaseModel):
    event_id: str
    event_type: str  # ai_recommendation | coach_insight | rebalance | transaction | portfolio_snapshot
    occurred_at: datetime
    title: str
    description: Optional[str]
    amount: Optional[float]
    currency: Optional[str]
    ticker: Optional[str]
    metadata: dict[str, Any]
    causal_note: Optional[str]  # e.g. "followed by -6.2% drawdown over 7 days"


class TimelinePage(BaseModel):
    investor_id: uuid.UUID
    events: list[TimelineEvent]
    total: int
    days: int
    generated_at: datetime

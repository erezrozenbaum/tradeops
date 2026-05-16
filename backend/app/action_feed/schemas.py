import uuid
from datetime import datetime

from pydantic import BaseModel


class ActionItem(BaseModel):
    id: str                     # deterministic: "{source}-{key}"
    priority: int               # 1=urgent, 2=high, 3=medium
    category: str               # rebalance | alert | insight | signal | goal
    action_type: str            # BUY | SELL | REDUCE | ACCUMULATE | WATCH | CONTRIBUTE | URGENT | ALERT | REVIEW
    title: str
    reasoning: str
    ticker: str | None = None
    amount: float | None = None   # suggested amount in base currency
    units: float | None = None    # suggested units/shares
    unit_price: float | None = None
    currency: str
    source: str                 # rebalancing | price_alerts | proactive_insights | goals | market_signals


class DailyActionFeed(BaseModel):
    investor_id: uuid.UUID
    generated_at: datetime
    summary: str
    currency: str
    urgent_count: int
    high_count: int
    medium_count: int
    items: list[ActionItem]

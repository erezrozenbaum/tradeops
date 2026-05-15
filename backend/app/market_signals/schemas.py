import uuid
from datetime import date, datetime

from pydantic import BaseModel


class SentimentTick(BaseModel):
    signal_date: date
    sentiment_score: float
    composite_score: int


class TickerSignal(BaseModel):
    signal_id: uuid.UUID
    ticker: str
    signal_type: str                 # NEWS_SENTIMENT | WHALE_MENTION
    signal_date: date
    sentiment_score: float
    composite_score: int             # 0-100
    rationale: str
    whale_entities: list[str]        # institutional names detected in headlines
    guard_status: str                # APPROVED | MUTED
    mute_reason: str | None
    is_dismissed: bool
    # Portfolio context attached at query time
    position_value: float | None     # current value in base currency
    position_pct: float | None       # % of total portfolio
    unrealized_pnl: float | None
    holding_days: int | None         # days held (for tax context)
    # 7-day rolling trend
    trend_direction: str             # improving | deteriorating | stable
    trend_history: list[SentimentTick]
    # Connected insights from existing engines
    connected_insight: str | None    # e.g. "Tax-loss harvest window open"


class MarketSignalsResult(BaseModel):
    investor_id: uuid.UUID
    currency: str
    tickers_monitored: int
    approved_count: int
    muted_count: int
    whale_mention_count: int
    signals: list[TickerSignal]      # approved + non-dismissed only
    computed_at: datetime

"""Pydantic schemas for the deep market research engine."""
import uuid
from datetime import datetime

from pydantic import BaseModel


class MarketResearchHistoryItem(BaseModel):
    id: uuid.UUID
    generated_at: datetime
    picks_count: int
    universe_size: int

    model_config = {"from_attributes": True}


class StockFundamentals(BaseModel):
    ticker: str
    name: str
    sector: str
    market: str
    asset_type: str
    current_price: float | None = None
    currency: str = "USD"
    analyst_target: float | None = None
    analyst_upside_pct: float | None = None
    analyst_rating: str | None = None
    analyst_count: int | None = None
    trailing_pe: float | None = None
    forward_pe: float | None = None
    peg_ratio: float | None = None
    price_to_book: float | None = None
    revenue_growth_pct: float | None = None
    earnings_growth_pct: float | None = None
    profit_margin_pct: float | None = None
    return_on_equity_pct: float | None = None
    dividend_yield_pct: float | None = None
    pct_from_52w_low: float | None = None
    pct_from_52w_high: float | None = None
    opportunity_score: float = 0.0


class SectorPerformance(BaseModel):
    sector: str
    etf_ticker: str
    performance_1m_pct: float | None = None
    performance_3m_pct: float | None = None
    performance_1y_pct: float | None = None
    outlook: str = "neutral"


class OpportunityPick(BaseModel):
    ticker: str
    name: str
    sector: str
    asset_type: str
    current_price: float | None = None
    currency: str = "USD"
    analyst_target: float | None = None
    upside_pct: float | None = None
    risk_tier: str  # "stable" | "moderate" | "high_opportunity"
    time_horizon_months: int
    time_horizon_label: str
    thesis: str
    why_now: str
    key_risk: str
    suggested_allocation_pct: float | None = None
    opportunity_score: float = 0.0
    key_metrics: dict = {}


class MarketResearchReport(BaseModel):
    investor_id: uuid.UUID
    generated_at: datetime
    market_overview: str
    sector_insights: list[SectorPerformance]
    stable_picks: list[OpportunityPick]
    moderate_picks: list[OpportunityPick]
    opportunity_picks: list[OpportunityPick]
    screening_universe_size: int
    candidates_scored: int
    disclaimer: str
    all_stock_candidates: list[StockFundamentals] = []
    crypto_candidates: list[StockFundamentals] = []

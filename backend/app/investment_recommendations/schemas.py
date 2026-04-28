import uuid
from datetime import datetime

from pydantic import BaseModel


class PortfolioAction(BaseModel):
    action: str      # short imperative e.g. "Reduce crypto exposure"
    rationale: str
    urgency: str     # "immediate" | "soon" | "when_convenient"


class InstrumentRecommendation(BaseModel):
    ticker: str | None
    name: str
    asset_type: str   # etf | stock | crypto | bond | fund
    risk_level: str   # low | moderate | high | very_high
    why_fits: str     # personalised to this investor
    suggested_allocation_pct: float | None
    educational_note: str
    action: str       # "consider" | "increase" | "start_position"
    is_new_to_you: bool


class RecommendationReport(BaseModel):
    investor_id: uuid.UUID
    overall_guidance: str
    portfolio_actions: list[PortfolioAction]
    recommendations: list[InstrumentRecommendation]
    generated_at: datetime
    disclaimer: str

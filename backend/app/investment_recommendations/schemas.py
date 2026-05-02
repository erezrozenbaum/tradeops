import uuid
from datetime import datetime

from pydantic import BaseModel


class PortfolioAction(BaseModel):
    action: str
    rationale: str
    urgency: str  # "immediate" | "soon" | "when_convenient"


class InstrumentRecommendation(BaseModel):
    ticker: str | None
    name: str
    asset_type: str   # etf | stock | crypto | bond | fund
    risk_level: str   # low | moderate | high | very_high
    why_fits: str
    suggested_allocation_pct: float | None
    educational_note: str
    action: str       # "consider" | "increase" | "start_position"
    is_new_to_you: bool


class MonthlyAllocation(BaseModel):
    ticker: str
    name: str
    asset_type: str
    risk: str          # low | moderate | high
    monthly_amount: float
    pct: int           # percentage of monthly plan (sums to 100 per tier)
    note: str


class RoadmapPhase(BaseModel):
    number: int
    title: str
    status: str        # "current" | "next" | "future" | "completed"
    condition: str


class MonthlyPlan(BaseModel):
    conservative: list[MonthlyAllocation]
    balanced: list[MonthlyAllocation]
    growth: list[MonthlyAllocation]


class InvestmentRoadmap(BaseModel):
    monthly_investable_amount: float
    currency: str
    current_phase: int
    phases: list[RoadmapPhase]
    monthly_plan: MonthlyPlan


class RecommendationReport(BaseModel):
    investor_id: uuid.UUID
    overall_guidance: str
    portfolio_actions: list[PortfolioAction]
    investment_roadmap: InvestmentRoadmap | None = None
    recommendations: list[InstrumentRecommendation]
    generated_at: datetime
    disclaimer: str

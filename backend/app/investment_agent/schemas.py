from datetime import datetime
from pydantic import BaseModel


class ActionItem(BaseModel):
    action: str          # buy | sell | hold | save | reduce_debt
    instrument_name: str
    ticker: str | None = None
    urgency: str         # immediate | soon | when_convenient
    suggested_amount: float | None = None
    currency: str | None = None
    reasoning: str


class CapitalThresholdPlan(BaseModel):
    threshold_amount: float
    currency: str
    label: str
    primary_action: str
    instruments: list[str]
    rationale: str


class Opportunity(BaseModel):
    ticker: str
    name: str
    asset_type: str
    current_price: float | None = None
    price_currency: str | None = None
    why_now: str
    fit_score: int          # 1-10 fit to this investor's profile
    risk_level: str
    is_in_portfolio: bool
    suggested_allocation_pct: float


class AgentReport(BaseModel):
    generated_at: datetime
    portfolio_health_score: int   # 0-100
    market_pulse: str
    portfolio_assessment: str
    action_plan: list[ActionItem]
    top_opportunities: list[Opportunity]
    capital_thresholds: list[CapitalThresholdPlan]
    risk_warnings: list[str]
    no_data: bool = False

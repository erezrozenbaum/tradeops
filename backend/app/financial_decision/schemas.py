from pydantic import BaseModel


class InvestmentDecision(BaseModel):
    can_invest: bool
    readiness_classification: str  # ready | ready_with_limits | not_ready | education_only
    recommended_investment_pct: float
    max_high_risk_pct: float
    blocked_actions: list[str]
    required_actions: list[str]
    warnings: list[str]
    explanation: str

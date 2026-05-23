from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class TwinDimensions(BaseModel):
    financial_stability: float
    behavioral_discipline: float
    emotional_risk: float
    portfolio_consistency: float
    financial_resilience: float
    risk_alignment: float
    long_term_discipline: float
    contribution_momentum: float


class TwinSnapshot(BaseModel):
    id: str
    computed_at: datetime
    dimensions: TwinDimensions
    overall_score: float
    previous_overall: float | None = None  # for trend arrow

    model_config = {"from_attributes": True}


class HealthRadarDimensions(BaseModel):
    stability: float
    liquidity: float
    discipline: float
    diversification: float
    emotional_control: float
    contribution_consistency: float
    tax_efficiency: float
    risk_alignment: float
    financial_resilience: float


class HealthRadarSnapshot(BaseModel):
    id: str
    computed_at: datetime
    dimensions: HealthRadarDimensions
    overall_score: float
    previous_overall: float | None = None

    model_config = {"from_attributes": True}


TWIN_DIMENSION_LABELS: dict[str, str] = {
    "financial_stability": "Financial Stability",
    "behavioral_discipline": "Behavioral Discipline",
    "emotional_risk": "Emotional Risk",
    "portfolio_consistency": "Portfolio Consistency",
    "financial_resilience": "Financial Resilience",
    "risk_alignment": "Risk Alignment",
    "long_term_discipline": "Long-Term Discipline",
    "contribution_momentum": "Contribution Momentum",
}

TWIN_DIMENSION_DESCRIPTIONS: dict[str, str] = {
    "financial_stability": "Income-to-expense ratio, emergency fund coverage, and debt management",
    "behavioral_discipline": "Overall quality of trading behaviour based on 12-month transaction history",
    "emotional_risk": "Degree of short-term reactive trading — lower is better",
    "portfolio_consistency": "How closely your actual allocation tracks your risk model targets",
    "financial_resilience": "Ability to absorb financial shocks — emergency fund + net worth buffer",
    "risk_alignment": "Whether your portfolio's risk level matches your stated risk profile",
    "long_term_discipline": "Average holding duration — proxy for patience and conviction",
    "contribution_momentum": "Frequency of recent investment contributions",
}

HEALTH_DIMENSION_LABELS: dict[str, str] = {
    "stability": "Stability",
    "liquidity": "Liquidity",
    "discipline": "Discipline",
    "diversification": "Diversification",
    "emotional_control": "Emotional Control",
    "contribution_consistency": "Contribution Consistency",
    "tax_efficiency": "Tax Efficiency",
    "risk_alignment": "Risk Alignment",
    "financial_resilience": "Financial Resilience",
}

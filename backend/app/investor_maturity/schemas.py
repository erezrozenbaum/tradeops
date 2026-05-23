from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class ComponentScores(BaseModel):
    financial_stability: float
    debt_discipline: float
    savings_consistency: float
    emotional_discipline: float
    strategy_consistency: float
    contribution_regularity: float
    data_maturity: float
    portfolio_complexity: float


class MaturitySnapshot(BaseModel):
    id: str
    computed_at: datetime
    composite_score: float
    stage: str  # foundation | discipline | optimization | advanced_cognition
    stage_label: str
    component_scores: ComponentScores
    features_unlocked: list[str]
    notes: list[str]

    model_config = {"from_attributes": True}


STAGE_LABELS: dict[str, str] = {
    "foundation": "Foundation",
    "discipline": "Discipline",
    "optimization": "Optimization",
    "advanced_cognition": "Advanced Cognition",
}

STAGE_DESCRIPTIONS: dict[str, str] = {
    "foundation": "You're building the essentials — financial profile, risk model, and basic investing habits.",
    "discipline": "You're developing consistent habits. Behavioral analytics and strategy tools are now available.",
    "optimization": "You're refining your strategy with attribution analysis and advanced intelligence features.",
    "advanced_cognition": "You've reached institutional-grade financial thinking. All platform features are unlocked.",
}

# Which features are accessible per stage (cumulative)
FEATURES_BY_STAGE: dict[str, list[str]] = {
    "foundation": [
        "dashboard", "paper_trading", "risk_model", "strategy_recommendation",
        "backtesting", "goals", "financial_profile",
    ],
    "discipline": [
        "dashboard", "paper_trading", "risk_model", "strategy_recommendation",
        "backtesting", "goals", "financial_profile",
        "behavioral_intel", "timeline", "strategy_drift", "attribution",
    ],
    "optimization": [
        "dashboard", "paper_trading", "risk_model", "strategy_recommendation",
        "backtesting", "goals", "financial_profile",
        "behavioral_intel", "timeline", "strategy_drift", "attribution",
        "simulation", "counterfactual_replay", "financial_twin",
    ],
    "advanced_cognition": [
        "dashboard", "paper_trading", "risk_model", "strategy_recommendation",
        "backtesting", "goals", "financial_profile",
        "behavioral_intel", "timeline", "strategy_drift", "attribution",
        "simulation", "counterfactual_replay", "financial_twin",
        "health_radar", "thought_partner_advanced",
    ],
}

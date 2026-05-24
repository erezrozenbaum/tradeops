from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel


class ActionSeverity(str, Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    positive = "positive"


class PrioritizedAction(BaseModel):
    title: str
    rationale: str
    severity: ActionSeverity
    impact: str          # "high" | "medium" | "low"
    urgent: bool
    category: str        # "safety" | "behavior" | "portfolio" | "contribution"
    link: str | None = None


class EvolutionItem(BaseModel):
    metric: str
    label: str
    direction: str       # "up" | "down" | "flat"
    from_value: float | None
    to_value: float | None
    delta_display: str   # "+3.4 pts" or "–8.4%"
    cause: str | None    # only for discipline+ stage
    item_severity: str   # "positive" | "neutral" | "negative"


class HealthRadarPoint(BaseModel):
    dimension: str
    label: str
    value: float


class TwinInsight(BaseModel):
    label: str
    value: float


class TwinInsightsData(BaseModel):
    positive_drivers: list[TwinInsight]
    drag_factors: list[TwinInsight]


class BehavioralRiskCard(BaseModel):
    event_type: str
    severity: str
    description: str
    recommendation: str


class FuturesPath(BaseModel):
    label: str
    values: list[float]
    color: str


class FuturesPreview(BaseModel):
    paths: list[FuturesPath]
    fi_probability: float | None
    has_data: bool


class ReplayHighlight(BaseModel):
    scenario_type: str
    insight_text: str
    delta: float
    delta_pct: float
    reference_date: str | None


class ProgressionStage(BaseModel):
    key: str
    label: str
    is_current: bool
    is_complete: bool


class InvestorProgression(BaseModel):
    stages: list[ProgressionStage]
    current_stage: str
    current_stage_label: str
    composite_score: float
    features_unlocked: list[str]
    next_unlock_feature: str | None
    score_to_next_stage: float | None


class FinancialStatusHeader(BaseModel):
    twin_overall_score: float
    twin_score_delta_7d: float | None
    twin_trend: str              # "up" | "down" | "flat"
    maturity_stage: str
    maturity_stage_label: str
    stability_classification: str
    stability_score: float
    net_worth_change_pct_12m: float | None
    active_behavioral_risk_count: int


class GoalProgressItem(BaseModel):
    id: str
    name: str
    goal_type: str
    progress_pct: float
    months_to_target: float | None
    on_track: bool
    status: str          # "complete" | "on_track" | "at_risk" | "no_date" | "needs_log"
    currency: str
    target_amount: float
    current_amount: float
    monthly_contribution_needed: float | None


class CommandCenterReport(BaseModel):
    header: FinancialStatusHeader
    top_actions: list[PrioritizedAction]
    evolution_feed: list[EvolutionItem]
    health_radar: list[HealthRadarPoint]
    twin_insights: TwinInsightsData
    behavioral_risks: list[BehavioralRiskCard]
    futures_preview: FuturesPreview
    replay_highlight: ReplayHighlight | None
    ai_summary: str
    ai_summary_verbosity: str
    progression: InvestorProgression
    goal_progress: list[GoalProgressItem]
    maturity_stage: str
    generated_at: datetime


# ── AI Memory Timeline ─────────────────────────────────────────────────────

class AIMemoryItem(BaseModel):
    id: str
    summary_at: datetime
    verbosity: str
    portfolio_assessment: str
    key_metrics: dict | None = None

    model_config = {"from_attributes": True}


class AIMemoryResponse(BaseModel):
    items: list[AIMemoryItem]


# ── Score History ──────────────────────────────────────────────────────────

class TwinHistoryPoint(BaseModel):
    computed_at: datetime
    overall_score: float
    financial_stability: float
    behavioral_discipline: float
    emotional_risk: float
    portfolio_consistency: float
    financial_resilience: float
    risk_alignment: float
    long_term_discipline: float
    contribution_momentum: float


class MaturityHistoryPoint(BaseModel):
    computed_at: datetime
    composite_score: float
    stage: str


class ScoreHistoryResponse(BaseModel):
    twin_history: list[TwinHistoryPoint]
    maturity_history: list[MaturityHistoryPoint]

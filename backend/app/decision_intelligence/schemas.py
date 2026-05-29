import uuid
from datetime import datetime
from pydantic import BaseModel


class DQSComponents(BaseModel):
    documentation: float      # 0-35
    risk_intelligence: float  # 0-30
    goal_alignment: float     # 0-20
    outcome_correlation: float  # 0-15


class OutcomeComparison(BaseModel):
    documented_avg_return_pct: float | None
    undocumented_avg_return_pct: float | None
    documented_win_rate: float | None   # fraction with positive return
    undocumented_win_rate: float | None
    outperformance_pct: float | None    # documented - undocumented avg, positive = good
    sample_documented: int
    sample_undocumented: int
    has_sufficient_data: bool


class BehavioralInsight(BaseModel):
    category: str   # "strength" | "warning" | "pattern" | "opportunity"
    title: str
    body: str
    metric: str | None = None


class DQSHistoryPoint(BaseModel):
    month: str   # "2026-05"
    score: float
    order_count: int


class DecisionIntelligenceReport(BaseModel):
    investor_id: uuid.UUID
    dqs: float
    dqs_label: str   # "Excellent" | "Good" | "Fair" | "Needs Work"
    components: DQSComponents
    trend: str   # "improving" | "stable" | "declining" | "insufficient_data"
    trend_delta: float | None
    dqs_history: list[DQSHistoryPoint]
    insights: list[BehavioralInsight]
    outcome_comparison: OutcomeComparison | None
    coach_notes: list[str]
    total_orders: int
    executed_orders: int
    documented_orders: int
    sufficient_data: bool
    generated_at: datetime

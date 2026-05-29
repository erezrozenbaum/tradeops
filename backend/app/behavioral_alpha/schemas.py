import uuid
from datetime import datetime
from pydantic import BaseModel


class AlphaDimension(BaseModel):
    label: str
    group_a_label: str   # the "disciplined" group
    group_b_label: str   # the comparison group
    group_a_avg_return: float | None
    group_b_avg_return: float | None
    alpha_pct: float | None          # group_a - group_b; positive = discipline pays
    group_a_win_rate: float | None   # fraction of group_a trades with positive return
    group_b_win_rate: float | None
    group_a_count: int
    group_b_count: int
    has_data: bool


class DecisionHighlight(BaseModel):
    order_id: str
    ticker: str | None
    name: str
    action: str
    executed_at: str | None
    estimated_value: float
    currency: str
    return_pct: float
    had_rationale: bool
    was_goal_linked: bool
    pre_flight_verdict: str | None
    rationale_snippet: str | None   # first 120 chars of rationale


class MistakePattern(BaseModel):
    pattern_key: str
    label: str
    description: str
    frequency: int
    estimated_avg_return_pct: float | None   # avg outcome for trades matching this pattern


class BehavioralAlphaReport(BaseModel):
    investor_id: uuid.UUID
    documentation_alpha: AlphaDimension
    goal_alignment_alpha: AlphaDimension
    risk_compliance_alpha: AlphaDimension
    best_decisions: list[DecisionHighlight]
    worst_decisions: list[DecisionHighlight]
    mistake_patterns: list[MistakePattern]
    total_executed: int
    priced_orders: int          # orders with live price data
    price_coverage_pct: float
    sufficient_data: bool
    generated_at: datetime

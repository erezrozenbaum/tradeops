import uuid
from datetime import datetime
from pydantic import BaseModel


class MonthlyStats(BaseModel):
    total_decisions: int
    executed_decisions: int
    cancelled_decisions: int
    documented_decisions: int
    goal_linked_decisions: int
    documentation_rate: float
    goal_alignment_rate: float
    risk_override_count: int


class MonthlyReflectionReport(BaseModel):
    investor_id: uuid.UUID
    month: str           # "2026-05"
    month_label: str     # "May 2026"

    stats: MonthlyStats

    # DQS comparison
    dqs_this_month: float | None
    dqs_previous_month: float | None
    dqs_change: float | None
    dqs_trend: str   # "improved" | "declined" | "stable" | "first_month" | "no_data"

    # Narrative — deterministically generated from data
    headline: str
    decision_quality_narrative: str
    behavioral_narrative: str
    improvement_focus: str

    # Highlights
    achievements: list[str]
    watch_list: list[str]   # things to watch / improve

    # Available months for navigation
    available_months: list[str]

    sufficient_data: bool
    generated_at: datetime

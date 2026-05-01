import uuid
from datetime import datetime

from pydantic import BaseModel


class GoalAnalysis(BaseModel):
    id: uuid.UUID
    name: str
    goal_type: str
    tracking_mode: str
    target_amount: float
    current_amount: float
    progress_pct: float
    amount_remaining: float
    target_date: str | None
    months_to_target: float | None
    monthly_contribution_needed: float | None
    monthly_surplus: float | None
    gap: float | None  # positive = shortfall
    on_track: bool
    status: str  # "complete" | "on_track" | "at_risk" | "no_date" | "needs_log"
    currency: str
    # mode-specific computed fields
    streak_months: int | None = None          # monthly_contribution
    income_gap: float | None = None           # monthly_passive_income
    payoff_months: float | None = None        # debt_reduction
    threshold_type: str | None = None         # balance_threshold: "min" | "max"


class GoalsAnalysisResult(BaseModel):
    investor_id: uuid.UUID
    goals: list[GoalAnalysis]
    total_monthly_contribution_needed: float
    monthly_surplus: float | None
    computed_at: datetime

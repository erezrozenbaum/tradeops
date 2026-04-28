import uuid
from datetime import datetime

from pydantic import BaseModel


class GoalAnalysis(BaseModel):
    id: uuid.UUID
    name: str
    goal_type: str
    target_amount: float
    current_amount: float
    progress_pct: float
    amount_remaining: float
    target_date: str | None
    months_to_target: float | None
    monthly_contribution_needed: float | None
    monthly_surplus: float | None
    gap: float | None  # monthly_contribution_needed - monthly_surplus; positive = shortfall
    on_track: bool
    status: str  # "complete" | "on_track" | "at_risk" | "no_date"
    currency: str


class GoalsAnalysisResult(BaseModel):
    investor_id: uuid.UUID
    goals: list[GoalAnalysis]
    total_monthly_contribution_needed: float
    monthly_surplus: float | None
    computed_at: datetime

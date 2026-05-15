import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class LifeEventRequest(BaseModel):
    duration_months: int = Field(..., ge=1, le=36, description="Scenario duration in months")
    monthly_expense_increase: float = Field(default=0.0, ge=0, description="Extra monthly expenses in base currency")
    monthly_income_loss: float = Field(default=0.0, ge=0, description="Monthly income reduction in base currency")
    scenario_label: str | None = Field(default=None, max_length=100, description="Optional label, e.g. 'Job Loss 6 months'")


class DepletionStep(BaseModel):
    month: int                       # simulation month when this asset was liquidated
    source_label: str                # "Cash Reserve", "T+2 Settlement", "1 Week", etc.
    holding_name: str
    holding_ticker: str | None
    gross_sold: float
    tax_paid: float
    net_received: float
    cumulative_net_raised: float     # total cash raised so far including initial cash reserve


class ResilienceResult(BaseModel):
    investor_id: uuid.UUID
    currency: str
    scenario_label: str
    duration_months: int
    monthly_income: float            # baseline monthly income
    monthly_expenses: float          # baseline monthly expenses
    monthly_income_loss: float       # income reduction from request
    monthly_expense_increase: float  # extra expenses from request
    monthly_burn: float              # net monthly cash deficit (0 if income still covers expenses)
    total_cash_needed: float         # monthly_burn * duration_months
    cash_reserve: float              # liquid_savings from financial profile (Tier 0)
    tier3_total_gross: float         # value locked in Tier 3 (excluded from simulation)
    months_covered: int              # months before Tier 3 breach; equals duration_months if fully survived
    tier3_breach: bool               # True if Tier 3 must be broken to survive the scenario
    survival_score: int              # 0–100
    survival_verdict: str            # "Safe" / "At Risk" / "Critical"
    depletion_path: list[DepletionStep]
    ai_recommendation: str | None
    computed_at: datetime

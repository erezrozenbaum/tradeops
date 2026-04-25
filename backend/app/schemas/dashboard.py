import uuid
from datetime import date, datetime

from pydantic import BaseModel

from app.models.financial_goal import GoalType


class DashboardInvestor(BaseModel):
    id: uuid.UUID
    full_name: str
    base_currency: str
    experience_level: str
    is_minor: bool


class DashboardNetWorth(BaseModel):
    total_assets: float
    total_liabilities: float
    net_worth: float
    liquid_capital: float
    currency: str


class DashboardCashFlow(BaseModel):
    monthly_income: float
    monthly_expenses: float
    monthly_surplus: float
    savings_rate_pct: float
    emergency_fund_months: float
    currency: str


class DashboardStability(BaseModel):
    score: int
    classification: str
    risk_modifier: str
    recommendations: list[str]


class DashboardRiskModel(BaseModel):
    investable_capital: float
    low_risk_pct: float
    growth_pct: float
    high_risk_pct: float
    low_risk_amount: float
    growth_amount: float
    high_risk_amount: float
    max_drawdown_pct: float
    currency: str
    generated_at: datetime


class DashboardGoal(BaseModel):
    id: uuid.UUID
    name: str
    goal_type: GoalType
    target_amount: float
    current_amount: float
    progress_pct: float
    target_date: date | None
    priority: int
    currency: str


class DashboardOut(BaseModel):
    investor: DashboardInvestor
    net_worth: DashboardNetWorth | None
    cash_flow: DashboardCashFlow | None
    stability: DashboardStability | None
    risk_model: DashboardRiskModel | None
    goals: list[DashboardGoal]

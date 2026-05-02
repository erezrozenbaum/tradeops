import uuid
from datetime import date

from pydantic import BaseModel


class DebtItem(BaseModel):
    id: uuid.UUID
    name: str
    liability_type: str
    outstanding_balance: float
    monthly_payment: float
    interest_rate_pct: float
    currency: str
    priority: int
    payoff_months: int
    payoff_date: date
    total_interest: float


class DebtPlanResult(BaseModel):
    strategy: str
    total_debt: float
    currency: str
    monthly_minimum: float
    extra_monthly: float
    effective_monthly: float
    months_to_debt_free: int
    debt_free_date: date
    total_interest_paid: float
    total_paid: float
    debts: list[DebtItem]
    no_debts: bool

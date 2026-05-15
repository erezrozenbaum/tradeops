import uuid
from datetime import date, datetime
from pydantic import BaseModel


class DividendHolding(BaseModel):
    holding_id: uuid.UUID
    name: str
    ticker: str
    quantity: float
    annual_dividend_per_share: float
    annual_income: float         # in base currency
    yield_on_cost: float         # % based on avg_buy_price
    yield_on_value: float        # % based on current value
    next_ex_date: date | None
    pay_frequency: str           # "quarterly" | "annual" | "monthly" | "unknown"


class IncomeResult(BaseModel):
    investor_id: uuid.UUID
    currency: str
    total_annual_income: float
    portfolio_yield_on_value: float
    portfolio_yield_on_cost: float
    holdings: list[DividendHolding]
    upcoming_ex_dates: list[dict]   # [{ticker, name, ex_date, estimated_payment}]
    monthly_income: dict[int, float]  # month 1-12 → estimated base-currency income
    computed_at: datetime

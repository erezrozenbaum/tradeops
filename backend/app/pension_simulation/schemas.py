import uuid

from pydantic import BaseModel, Field


class PensionSimulationResult(BaseModel):
    holding_id: uuid.UUID
    fund_name: str
    currency: str
    current_balance: float
    current_age: float
    retirement_age: int
    years_to_retirement: float
    months_to_retirement: int
    monthly_contribution: float
    annual_return_rate: float
    withdrawal_years: int
    projected_balance: float
    projected_from_current_balance: float
    projected_from_contributions: float
    total_contributions_added: float
    total_gains: float
    monthly_pension_estimate: float

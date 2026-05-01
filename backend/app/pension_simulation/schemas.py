import uuid

from pydantic import BaseModel


class PensionSimulationResult(BaseModel):
    holding_id: uuid.UUID
    fund_name: str
    asset_type: str
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
    # Study fund specific
    fund_status: str | None = None
    tax_status: str | None = None          # "Tax-Free" | "Locked"
    tax_exemption_date: str | None = None  # ISO date
    years_until_tax_free: float | None = None
    monthly_contribution_employee: float | None = None
    monthly_contribution_employer: float | None = None

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.financial_profile import (
    AssetType,
    IncomeTrend,
    JobStability,
    LiabilityType,
)


class FinancialAssetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    asset_type: AssetType
    current_value: float = Field(..., ge=0)
    currency: str = Field(..., min_length=3, max_length=3)
    market: str | None = None
    is_liquid: bool = True
    notes: str | None = None


class FinancialAssetUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    asset_type: AssetType | None = None
    current_value: float | None = Field(None, ge=0)
    currency: str | None = Field(None, min_length=3, max_length=3)
    market: str | None = None
    is_liquid: bool | None = None
    notes: str | None = None


class FinancialAssetOut(FinancialAssetCreate):
    id: uuid.UUID
    financial_profile_id: uuid.UUID
    model_config = {"from_attributes": True}


class FinancialLiabilityCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    liability_type: LiabilityType
    outstanding_balance: float = Field(..., ge=0)
    monthly_payment: float = Field(0.0, ge=0)
    interest_rate_pct: float | None = Field(None, ge=0, le=100)
    currency: str = Field(..., min_length=3, max_length=3)
    notes: str | None = None


class FinancialLiabilityUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    liability_type: LiabilityType | None = None
    outstanding_balance: float | None = Field(None, ge=0)
    monthly_payment: float | None = Field(None, ge=0)
    interest_rate_pct: float | None = Field(None, ge=0, le=100)
    currency: str | None = Field(None, min_length=3, max_length=3)
    notes: str | None = None


class FinancialLiabilityOut(FinancialLiabilityCreate):
    id: uuid.UUID
    financial_profile_id: uuid.UUID
    model_config = {"from_attributes": True}


class FinancialProfileCreate(BaseModel):
    monthly_income: float = Field(..., ge=0)
    monthly_expenses: float = Field(..., ge=0)
    liquid_savings: float = Field(0.0, ge=0)
    emergency_fund_months: float = Field(0.0, ge=0)
    job_stability: JobStability = JobStability.stable
    income_trend: IncomeTrend = IncomeTrend.stable
    dependents_count: int = Field(0, ge=0)
    investable_capital_pct: float = Field(20.0, ge=0, le=100)
    spouse_income: float | None = Field(None, ge=0)
    currency: str = Field(..., min_length=3, max_length=3)


class FinancialProfileUpdate(BaseModel):
    monthly_income: float | None = Field(None, ge=0)
    monthly_expenses: float | None = Field(None, ge=0)
    liquid_savings: float | None = Field(None, ge=0)
    emergency_fund_months: float | None = Field(None, ge=0)
    job_stability: JobStability | None = None
    income_trend: IncomeTrend | None = None
    dependents_count: int | None = Field(None, ge=0)
    investable_capital_pct: float | None = Field(None, ge=0, le=100)
    spouse_income: float | None = Field(None, ge=0)


class FinancialProfileOut(FinancialProfileCreate):
    id: uuid.UUID
    investor_profile_id: uuid.UUID
    assets: list[FinancialAssetOut] = []
    liabilities: list[FinancialLiabilityOut] = []
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}

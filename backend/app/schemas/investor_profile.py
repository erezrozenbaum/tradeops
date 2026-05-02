import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.investor_profile import ExperienceLevel, RiskTolerance, TimeHorizon, TradingFrequency


class InvestorProfileCreate(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255)
    date_of_birth: date
    country: str = Field(..., min_length=2, max_length=3)
    nationality: str | None = None
    tax_residency: str | None = None
    base_currency: str = Field(..., min_length=3, max_length=3)
    local_currency: str = Field(..., min_length=3, max_length=3)
    experience_level: ExperienceLevel = ExperienceLevel.beginner
    is_minor: bool = False
    investment_goal: str | None = None
    risk_tolerance: RiskTolerance | None = None
    time_horizon: TimeHorizon | None = None
    preferred_assets: list[str] | None = None
    trading_frequency: TradingFrequency | None = None
    guardian_required: bool = False


class InvestorProfileUpdate(BaseModel):
    full_name: str | None = Field(None, min_length=1, max_length=255)
    country: str | None = Field(None, min_length=2, max_length=3)
    nationality: str | None = None
    tax_residency: str | None = None
    base_currency: str | None = Field(None, min_length=3, max_length=3)
    local_currency: str | None = Field(None, min_length=3, max_length=3)
    experience_level: ExperienceLevel | None = None
    is_minor: bool | None = None
    investment_goal: str | None = None
    risk_tolerance: RiskTolerance | None = None
    time_horizon: TimeHorizon | None = None
    preferred_assets: list[str] | None = None
    trading_frequency: TradingFrequency | None = None
    guardian_required: bool | None = None
    alert_email: str | None = None
    email_alerts_enabled: bool | None = None


class InvestorProfileOut(BaseModel):
    id: uuid.UUID
    full_name: str
    date_of_birth: date
    country: str
    nationality: str | None
    tax_residency: str | None
    base_currency: str
    local_currency: str
    experience_level: ExperienceLevel
    is_minor: bool
    investment_goal: str | None
    risk_tolerance: RiskTolerance | None
    time_horizon: TimeHorizon | None
    preferred_assets: list[str] | None
    trading_frequency: TradingFrequency | None
    guardian_required: bool
    alert_email: str | None
    email_alerts_enabled: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

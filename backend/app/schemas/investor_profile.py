import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.investor_profile import ExperienceLevel


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


class InvestorProfileUpdate(BaseModel):
    full_name: str | None = Field(None, min_length=1, max_length=255)
    country: str | None = Field(None, min_length=2, max_length=3)
    nationality: str | None = None
    tax_residency: str | None = None
    base_currency: str | None = Field(None, min_length=3, max_length=3)
    local_currency: str | None = Field(None, min_length=3, max_length=3)
    experience_level: ExperienceLevel | None = None
    is_minor: bool | None = None


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
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

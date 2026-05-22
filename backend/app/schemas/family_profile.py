import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.family_profile import RiskTolerance


class FamilyMemberCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    relationship_type: str = Field(..., min_length=1, max_length=50)
    age: int | None = Field(None, ge=0, le=120)
    is_primary: bool = False
    individual_risk_tolerance: RiskTolerance | None = None
    investor_profile_id: uuid.UUID | None = None


class FamilyMemberUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    relationship_type: str | None = Field(None, min_length=1, max_length=50)
    age: int | None = Field(None, ge=0, le=120)
    is_primary: bool | None = None
    individual_risk_tolerance: RiskTolerance | None = None
    investor_profile_id: uuid.UUID | None = None


class FamilyMemberOut(FamilyMemberCreate):
    id: uuid.UUID
    family_profile_id: uuid.UUID
    invite_status: str = "not_invited"
    invite_email: str | None = None
    model_config = {"from_attributes": True}


# ── Invite ────────────────────────────────────────────────────────────────────

class InviteRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)


class InviteOut(BaseModel):
    token: str
    invite_url: str
    email: str
    expires_at: datetime


class InviteInfo(BaseModel):
    family_name: str
    member_name: str
    relationship_type: str
    status: str


class FamilyProfileCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    primary_investor_id: uuid.UUID
    base_currency: str = Field(..., min_length=3, max_length=3)


class FamilyProfileUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    base_currency: str | None = Field(None, min_length=3, max_length=3)


class FamilyProfileOut(FamilyProfileCreate):
    id: uuid.UUID
    members: list[FamilyMemberOut] = []
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}

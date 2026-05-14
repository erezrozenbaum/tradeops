import uuid
from datetime import datetime

from pydantic import BaseModel


class AdminUserOut(BaseModel):
    id: uuid.UUID
    email: str
    role: str
    created_at: datetime
    profile_count: int

    model_config = {"from_attributes": True}


class AdminProfileOut(BaseModel):
    id: uuid.UUID
    full_name: str
    country: str
    base_currency: str
    user_id: uuid.UUID | None
    user_email: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminStats(BaseModel):
    total_users: int
    total_profiles: int
    unassigned_profiles: int


class RoleUpdate(BaseModel):
    role: str


class AssignProfile(BaseModel):
    user_id: uuid.UUID | None

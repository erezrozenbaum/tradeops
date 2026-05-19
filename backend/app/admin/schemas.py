import uuid
from datetime import datetime

from pydantic import BaseModel


class AiUsageFeatureRow(BaseModel):
    feature_name: str
    model: str
    calls: int
    input_tokens: int
    output_tokens: int
    cost_usd: float


class AiUsageUserRow(BaseModel):
    user_email: str | None
    investor_id: uuid.UUID | None
    calls: int
    input_tokens: int
    output_tokens: int
    cost_usd: float
    by_feature: list[AiUsageFeatureRow]


class AiUsageSummary(BaseModel):
    period_label: str
    total_calls: int
    total_input_tokens: int
    total_output_tokens: int
    total_cost_usd: float
    monthly_budget_usd: float
    budget_remaining_usd: float | None
    by_feature: list[AiUsageFeatureRow]
    by_user: list[AiUsageUserRow]


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


class LiveTradingGateOut(BaseModel):
    label: str
    passed: bool
    detail: str


class LiveTradingQueueEntry(BaseModel):
    investor_id: uuid.UUID
    investor_name: str
    user_email: str | None
    sharpe_ratio: float | None
    paper_days: int | None
    gates: list[LiveTradingGateOut]
    gates_1_2_4_passed: bool
    live_trading_allowed: bool

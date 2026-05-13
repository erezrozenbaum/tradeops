import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.investment_account import AccountType, HoldingAssetType


# ── Holdings ────────────────────────────────────────────────────────────────

class InvestmentHoldingCreate(BaseModel):
    ticker: str | None = Field(None, max_length=20)
    isin: str | None = Field(None, max_length=20)
    name: str = Field(..., min_length=1, max_length=200)
    asset_type: HoldingAssetType
    quantity: float = Field(0.0, ge=0)
    avg_buy_price: float = Field(0.0, ge=0)
    currency: str = Field(..., min_length=3, max_length=3)
    fees: float = Field(0.0, ge=0)
    purchase_date: date | None = None
    current_value: float | None = Field(None, ge=0)
    notes: str | None = None
    current_balance: float | None = Field(None, ge=0)
    total_deposits: float | None = Field(None, ge=0)
    monthly_contribution: float | None = Field(None, ge=0)
    annual_return_rate: float | None = Field(None, ge=0)
    monthly_contribution_employee: float | None = Field(None, ge=0)
    monthly_contribution_employer: float | None = Field(None, ge=0)
    fund_status: str | None = None
    is_emergency_fund: bool = False


class InvestmentHoldingUpdate(BaseModel):
    ticker: str | None = Field(None, max_length=20)
    isin: str | None = Field(None, max_length=20)
    name: str | None = Field(None, min_length=1, max_length=200)
    asset_type: HoldingAssetType | None = None
    quantity: float | None = Field(None, ge=0)
    avg_buy_price: float | None = Field(None, ge=0)
    currency: str | None = Field(None, min_length=3, max_length=3)
    fees: float | None = Field(None, ge=0)
    purchase_date: date | None = None
    current_value: float | None = Field(None, ge=0)
    notes: str | None = None
    current_balance: float | None = Field(None, ge=0)
    total_deposits: float | None = Field(None, ge=0)
    monthly_contribution: float | None = Field(None, ge=0)
    annual_return_rate: float | None = Field(None, ge=0)
    monthly_contribution_employee: float | None = Field(None, ge=0)
    monthly_contribution_employer: float | None = Field(None, ge=0)
    fund_status: str | None = None
    is_emergency_fund: bool | None = None


class InvestmentHoldingOut(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    ticker: str | None
    isin: str | None
    name: str
    asset_type: str
    quantity: float
    avg_buy_price: float
    currency: str
    fees: float
    purchase_date: date | None
    current_value: float | None
    notes: str | None
    current_balance: float | None
    total_deposits: float | None
    monthly_contribution: float | None
    annual_return_rate: float | None
    monthly_contribution_employee: float | None
    monthly_contribution_employer: float | None
    fund_status: str | None
    is_emergency_fund: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Accounts ─────────────────────────────────────────────────────────────────

class AutoSyncUpdate(BaseModel):
    auto_sync_enabled: bool
    sync_broker_type: str | None = None


class InvestmentAccountCreate(BaseModel):
    provider_name: str = Field(..., min_length=1, max_length=100)
    account_type: AccountType
    account_name: str | None = Field(None, max_length=200)
    currency: str = Field(..., min_length=3, max_length=3)
    notes: str | None = None
    family_member_id: uuid.UUID | None = None
    is_emergency_fund: bool = False


class InvestmentAccountUpdate(BaseModel):
    provider_name: str | None = Field(None, min_length=1, max_length=100)
    account_type: AccountType | None = None
    account_name: str | None = Field(None, max_length=200)
    currency: str | None = Field(None, min_length=3, max_length=3)
    notes: str | None = None
    family_member_id: uuid.UUID | None = None
    is_emergency_fund: bool | None = None


class InvestmentAccountOut(BaseModel):
    id: uuid.UUID
    investor_id: uuid.UUID
    provider_name: str
    account_type: str
    account_name: str | None
    currency: str
    notes: str | None
    family_member_id: uuid.UUID | None
    is_emergency_fund: bool = False
    auto_sync_enabled: bool = False
    last_synced_at: datetime | None = None
    sync_broker_type: str | None = None
    holdings: list[InvestmentHoldingOut] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

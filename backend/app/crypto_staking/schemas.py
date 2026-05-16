from __future__ import annotations

import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class StakingPosition(BaseModel):
    holding_id: uuid.UUID
    account_id: uuid.UUID
    name: str
    ticker: str | None
    quantity: float
    staking_apy: float                   # e.g. 5.2 means 5.2% APY
    current_price_usd: float | None      # live price in USD (may be None)
    current_price_base: float | None     # live price in investor's base currency
    estimated_annual_rewards_native: float   # tokens earned per year = quantity * apy/100
    estimated_annual_rewards_base: float | None  # in base currency (None if price unavailable)
    currency: str                        # holding currency
    tax_treatment: str = "income"        # always "income" for staking rewards
    tax_note: str


class StakingReport(BaseModel):
    investor_id: uuid.UUID
    base_currency: str
    total_estimated_annual_income_base: float | None
    positions: list[StakingPosition]
    tax_summary: str


class EnableStakingRequest(BaseModel):
    staking_apy: float = Field(..., gt=0, le=100, description="Annual staking yield percentage (e.g. 5.2 for 5.2%)")


class StakingToggleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    ticker: str | None
    fund_status: str | None
    annual_return_rate: float | None

import uuid
from datetime import datetime
from typing import Literal
from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator, model_validator

_ALLOWED_GATEWAY_HOSTS = {"localhost", "127.0.0.1"}


def _validate_gateway_url(v: str) -> str:
    """IBKR Client Portal Gateway always runs locally — reject any remote URL."""
    parsed = urlparse(v)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("gateway_url must use http or https scheme")
    if parsed.hostname not in _ALLOWED_GATEWAY_HOSTS:
        raise ValueError(
            f"gateway_url host must be localhost or 127.0.0.1, got: {parsed.hostname!r}"
        )
    return v


class GateStatus(BaseModel):
    passed: bool
    label: str
    detail: str


class LiveTradingReadiness(BaseModel):
    all_gates_passed: bool
    gates: list[GateStatus]
    sharpe_ratio: float | None = None
    paper_days: int | None = None


class AcknowledgeRiskRequest(BaseModel):
    confirmation: str = Field(..., description='Must be exactly "I UNDERSTAND"')
    ibkr_account_id: str
    gateway_url: str

    @field_validator("gateway_url")
    @classmethod
    def validate_gateway_url(cls, v: str) -> str:
        return _validate_gateway_url(v)

    @model_validator(mode="after")
    def check_confirmation(self) -> "AcknowledgeRiskRequest":
        if self.confirmation != "I UNDERSTAND":
            raise ValueError('confirmation must be exactly "I UNDERSTAND"')
        return self


class LiveTradingSessionOut(BaseModel):
    id: uuid.UUID
    investor_id: uuid.UUID
    ibkr_account_id: str
    gateway_url: str
    is_active: bool
    acknowledged_risk: bool
    acknowledged_at: datetime | None
    halted_at: datetime | None
    halt_reason: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class OrderRequest(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=20)
    order_type: Literal["market", "limit"]
    side: Literal["buy", "sell"]
    quantity: float = Field(..., gt=0)
    limit_price: float | None = Field(None, gt=0)

    @model_validator(mode="after")
    def limit_requires_price(self) -> "OrderRequest":
        if self.order_type == "limit" and self.limit_price is None:
            raise ValueError("limit_price is required for limit orders")
        return self


class LiveOrderOut(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    investor_id: uuid.UUID
    ticker: str
    order_type: str
    side: str
    quantity: float
    limit_price: float | None
    estimated_value: float | None
    ibkr_order_id: str | None
    status: str
    submitted_at: datetime | None
    filled_at: datetime | None
    rejection_reason: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class HaltRequest(BaseModel):
    reason: str = Field(default="User requested halt")

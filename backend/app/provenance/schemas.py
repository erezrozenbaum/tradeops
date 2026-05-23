import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel


class DecisionListItem(BaseModel):
    id: uuid.UUID
    decision_type: str
    triggered_at: datetime
    model_used: Optional[str]
    recommendation_count: Optional[int]
    decision_hash: Optional[str]
    output_summary: Optional[dict[str, Any]]

    model_config = {"from_attributes": True}


class DecisionDetail(BaseModel):
    id: uuid.UUID
    investor_id: uuid.UUID
    decision_type: str
    triggered_at: datetime
    portfolio_snapshot_id: Optional[uuid.UUID]
    risk_model_snapshot: Optional[dict[str, Any]]
    holdings_summary: Optional[dict[str, Any]]
    fx_rate_snapshot: Optional[dict[str, Any]]
    price_snapshot: Optional[dict[str, Any]]
    market_signals_snapshot: Optional[list[Any]]
    rule_results: Optional[dict[str, Any]]
    model_used: Optional[str]
    prompt_version: Optional[str]
    ai_input_summary: Optional[str]
    ai_output_summary: Optional[str]
    input_tokens: Optional[int]
    output_tokens: Optional[int]
    output_summary: Optional[dict[str, Any]]
    recommendation_count: Optional[int]
    decision_hash: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}

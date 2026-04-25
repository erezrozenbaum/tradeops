import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.strategy_template import StrategyType


class StrategyTemplateOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str
    strategy_type: StrategyType
    asset_classes: list[str]
    markets: list[str]
    min_stability_score: int
    allowed_risk_modifiers: list[str]
    min_experience_level: str
    suitable_for_minors: bool
    min_investable_capital: float
    time_horizon_min_months: int
    is_active: bool

    model_config = {"from_attributes": True}


class StrategyRecommendationOut(BaseModel):
    id: uuid.UUID
    investor_profile_id: uuid.UUID
    risk_model_id: uuid.UUID
    strategy_template_id: uuid.UUID
    template: StrategyTemplateOut
    fit_score: float
    notes: str
    generated_at: datetime

    model_config = {"from_attributes": True}

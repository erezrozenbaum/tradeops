import uuid
from datetime import datetime

from pydantic import BaseModel, computed_field


class RiskModelOut(BaseModel):
    id: uuid.UUID
    investor_profile_id: uuid.UUID
    stability_score: int
    stability_classification: str
    age_tier: str
    total_net_worth: float
    liquid_capital: float
    investable_capital: float
    low_risk_pct: float
    growth_pct: float
    high_risk_pct: float
    max_drawdown_pct: float
    currency: str
    generated_at: datetime

    # Enforcement fields
    allowed_strategy_families: list[str]
    blocked_strategy_families: list[str]
    live_trading_allowed: bool
    requires_paper_trading: bool
    max_trade_size_pct: float
    max_open_positions: int

    @computed_field
    @property
    def low_risk_amount(self) -> float:
        return round(self.investable_capital * self.low_risk_pct / 100, 2)

    @computed_field
    @property
    def growth_amount(self) -> float:
        return round(self.investable_capital * self.growth_pct / 100, 2)

    @computed_field
    @property
    def high_risk_amount(self) -> float:
        return round(self.investable_capital * self.high_risk_pct / 100, 2)

    model_config = {"from_attributes": True}

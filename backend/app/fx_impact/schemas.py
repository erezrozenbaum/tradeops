import uuid
from pydantic import BaseModel


class HoldingFxImpactOut(BaseModel):
    holding_id: str
    name: str
    ticker: str | None
    asset_type: str
    currency: str
    base_currency: str
    quantity: float
    avg_buy_price: float
    purchase_fx_rate: float | None
    current_fx_rate: float | None
    cost_basis_local: float
    cost_basis_base: float | None
    current_value_base: float | None
    asset_pnl: float | None
    fx_pnl: float | None
    total_pnl: float | None
    asset_pnl_pct: float | None
    fx_pnl_pct: float | None
    same_currency: bool
    fx_data_available: bool


class FxImpactResultOut(BaseModel):
    investor_id: uuid.UUID
    base_currency: str
    holdings: list[HoldingFxImpactOut]
    total_asset_pnl: float
    total_fx_pnl: float
    total_pnl: float
    total_cost_basis: float
    holdings_missing_fx_data: int

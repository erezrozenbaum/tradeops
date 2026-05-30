import uuid
from datetime import datetime

from pydantic import BaseModel


class DnaSignal(BaseModel):
    key: str
    title: str
    value: str
    detail: str


class LeakageByClass(BaseModel):
    asset_class: str
    documented_count: int
    undocumented_count: int
    documented_avg_return_pct: float | None
    undocumented_avg_return_pct: float | None
    leakage_pct: float | None
    leakage_dollar: float | None
    currency: str


class DnaRecommendation(BaseModel):
    continue_doing: list[str]
    reduce: list[str]
    avoid: list[str]


class InvestorDnaReport(BaseModel):
    investor_id: uuid.UUID
    has_sufficient_data: bool
    total_executed: int
    priced_orders: int
    dqs: float | None
    dqs_label: str | None
    doc_rate: float | None
    goal_rate: float | None
    edge: list[DnaSignal]
    risks: list[DnaSignal]
    recommendation: DnaRecommendation
    leakage_by_class: list[LeakageByClass]
    total_leakage_dollar: float | None
    total_leakage_currency: str | None
    generated_at: datetime

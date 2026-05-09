import uuid
from pydantic import BaseModel


class CorrelationPair(BaseModel):
    ticker_a: str
    ticker_b: str
    correlation: float  # -1.0 to 1.0


class SectorConcentration(BaseModel):
    sector: str
    weight_pct: float
    tickers: list[str]
    is_concentrated: bool  # True if > 40%


class ConcentrationRisk(BaseModel):
    sector_concentrations: list[SectorConcentration]
    highly_correlated_pairs: list[CorrelationPair]  # correlation > 0.8
    risk_score: int  # 0-100
    warnings: list[str]


class CorrelationResult(BaseModel):
    investor_id: uuid.UUID
    tickers: list[str]
    matrix: list[CorrelationPair]
    concentration_risk: ConcentrationRisk
    lookback_days: int
    data_quality: str  # "full" | "partial" | "insufficient"

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class PairAnalysis(BaseModel):
    ticker1: str
    ticker2: str
    lookback_days: int
    hedge_ratio: float                   # OLS beta: y = beta*x + alpha
    spread_mean: float
    spread_std: float
    z_score: float                       # current Z-score of the spread
    adf_stat: float                      # ADF(0) test statistic on spread
    is_cointegrated: bool                # ADF τ < -2.87 (5% level)
    signal: Literal["LONG_SPREAD", "SHORT_SPREAD", "EXIT", "STOP_LOSS", "NEUTRAL"]
    signal_reason: str
    data_points: int                     # number of overlapping trading days used


class PairSignalSave(BaseModel):
    ticker1: str
    ticker2: str
    lookback_days: int = 252


class PairSignalOut(BaseModel):
    id: uuid.UUID
    investor_id: uuid.UUID
    ticker1: str
    ticker2: str
    z_score: float
    hedge_ratio: float
    is_cointegrated: bool
    signal: str
    guard_status: str
    signal_date: date
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

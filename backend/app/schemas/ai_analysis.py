import uuid
from datetime import datetime

from pydantic import BaseModel


class AnalysisReportOut(BaseModel):
    investor_id: uuid.UUID
    generated_at: datetime
    summary: str
    financial_health: str
    risk_profile: str
    portfolio_analysis: str
    goals_progress: str
    strategy_analysis: str
    backtest_insights: str
    paper_trading_performance: str
    recommendations: str

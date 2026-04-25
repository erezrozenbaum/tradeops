import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.base import UUIDMixin


class BacktestRun(Base, UUIDMixin):
    __tablename__ = "backtest_runs"

    investor_profile_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("investor_profiles.id"), nullable=False
    )
    strategy_template_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("strategy_templates.id"), nullable=False
    )
    risk_model_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("risk_models.id"), nullable=False
    )

    initial_capital: Mapped[float] = mapped_column(Float, nullable=False)
    final_capital: Mapped[float] = mapped_column(Float, nullable=False)
    period_months: Mapped[int] = mapped_column(Integer, nullable=False)
    seed: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Summary metrics
    total_return_pct: Mapped[float] = mapped_column(Float, nullable=False)
    annualized_return_pct: Mapped[float] = mapped_column(Float, nullable=False)
    max_drawdown_pct: Mapped[float] = mapped_column(Float, nullable=False)
    sharpe_ratio: Mapped[float] = mapped_column(Float, nullable=False)
    win_rate_pct: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)

    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    investor: Mapped["InvestorProfile"] = relationship(
        "InvestorProfile", back_populates="backtest_runs"
    )
    template: Mapped["StrategyTemplate"] = relationship("StrategyTemplate")
    periods: Mapped[list["BacktestPeriod"]] = relationship(
        "BacktestPeriod", back_populates="run", cascade="all, delete-orphan",
        order_by="BacktestPeriod.month",
    )


class BacktestPeriod(Base, UUIDMixin):
    __tablename__ = "backtest_periods"

    backtest_run_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("backtest_runs.id"), nullable=False
    )
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    portfolio_value: Mapped[float] = mapped_column(Float, nullable=False)
    monthly_return_pct: Mapped[float] = mapped_column(Float, nullable=False)

    run: Mapped["BacktestRun"] = relationship("BacktestRun", back_populates="periods")

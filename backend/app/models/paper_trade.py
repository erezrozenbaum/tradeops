import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.base import UUIDMixin


class PortfolioStatus(str, enum.Enum):
    active = "active"
    paused = "paused"
    completed = "completed"


class PaperPortfolio(Base, UUIDMixin):
    __tablename__ = "paper_portfolios"

    investor_profile_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("investor_profiles.id"), nullable=False
    )
    strategy_template_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("strategy_templates.id"), nullable=False
    )
    risk_model_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("risk_models.id"), nullable=False
    )
    backtest_run_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("backtest_runs.id"), nullable=True
    )

    initial_capital: Mapped[float] = mapped_column(Float, nullable=False)
    current_value: Mapped[float] = mapped_column(Float, nullable=False)
    total_return_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    status: Mapped[PortfolioStatus] = mapped_column(
        Enum(PortfolioStatus, name="portfolio_status"),
        nullable=False,
        default=PortfolioStatus.active,
    )

    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_tick_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    investor: Mapped["InvestorProfile"] = relationship(
        "InvestorProfile", back_populates="paper_portfolios"
    )
    template: Mapped["StrategyTemplate"] = relationship("StrategyTemplate")
    ticks: Mapped[list["PaperTick"]] = relationship(
        "PaperTick",
        back_populates="portfolio",
        cascade="all, delete-orphan",
        order_by="PaperTick.tick_number",
    )


class PaperTick(Base, UUIDMixin):
    __tablename__ = "paper_ticks"

    portfolio_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("paper_portfolios.id"), nullable=False
    )
    tick_number: Mapped[int] = mapped_column(Integer, nullable=False)
    portfolio_value_before: Mapped[float] = mapped_column(Float, nullable=False)
    portfolio_value_after: Mapped[float] = mapped_column(Float, nullable=False)
    monthly_return_pct: Mapped[float] = mapped_column(Float, nullable=False)
    simulated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    portfolio: Mapped["PaperPortfolio"] = relationship(
        "PaperPortfolio", back_populates="ticks"
    )

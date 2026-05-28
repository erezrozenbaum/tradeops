import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, UniqueConstraint, func
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
    strategy_template_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("strategy_templates.id"), nullable=True
    )
    risk_model_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("risk_models.id"), nullable=True
    )
    backtest_run_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("backtest_runs.id"), nullable=True
    )

    name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    initial_capital: Mapped[float] = mapped_column(Float, nullable=False)
    cash_balance: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
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
    template: Mapped["StrategyTemplate | None"] = relationship("StrategyTemplate")
    ticks: Mapped[list["PaperTick"]] = relationship(
        "PaperTick",
        back_populates="portfolio",
        cascade="all, delete-orphan",
        order_by="PaperTick.tick_number",
    )
    positions: Mapped[list["PaperPosition"]] = relationship(
        "PaperPosition",
        back_populates="portfolio",
        cascade="all, delete-orphan",
        order_by="PaperPosition.symbol",
    )
    orders: Mapped[list["PaperOrder"]] = relationship(
        "PaperOrder",
        back_populates="portfolio",
        cascade="all, delete-orphan",
        order_by="PaperOrder.executed_at",
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


class PaperPosition(Base):
    __tablename__ = "paper_positions"
    __table_args__ = (
        UniqueConstraint("portfolio_id", "symbol", name="uq_paper_positions_portfolio_symbol"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    portfolio_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("paper_portfolios.id", ondelete="CASCADE"), nullable=False
    )
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    avg_cost_per_share: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="USD")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    portfolio: Mapped["PaperPortfolio"] = relationship("PaperPortfolio", back_populates="positions")


class PaperOrder(Base):
    __tablename__ = "paper_orders"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    portfolio_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("paper_portfolios.id", ondelete="CASCADE"), nullable=False
    )
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    side: Mapped[str] = mapped_column(String(4), nullable=False)  # "buy" | "sell"
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    price_per_share: Mapped[float] = mapped_column(Float, nullable=False)
    total_value: Mapped[float] = mapped_column(Float, nullable=False)
    executed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    portfolio: Mapped["PaperPortfolio"] = relationship("PaperPortfolio", back_populates="orders")

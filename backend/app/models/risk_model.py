import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.base import UUIDMixin


class RiskModel(Base, UUIDMixin):
    __tablename__ = "risk_models"

    investor_profile_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("investor_profiles.id"), nullable=False
    )
    stability_score: Mapped[int] = mapped_column(Integer, nullable=False)
    stability_classification: Mapped[str] = mapped_column(String(20), nullable=False)
    age_tier: Mapped[str] = mapped_column(String(20), nullable=False, default="adult")

    # Capital figures (in investor's base currency)
    total_net_worth: Mapped[float] = mapped_column(Float, nullable=False)
    liquid_capital: Mapped[float] = mapped_column(Float, nullable=False)
    investable_capital: Mapped[float] = mapped_column(Float, nullable=False)

    # Allocation percentages (must sum <= 100)
    low_risk_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    growth_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    high_risk_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    max_drawdown_pct: Mapped[float] = mapped_column(Float, nullable=False, default=10.0)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Enforcement fields
    allowed_strategy_families: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    blocked_strategy_families: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    live_trading_allowed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    requires_paper_trading: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    max_trade_size_pct: Mapped[float] = mapped_column(Float, nullable=False, default=2.0)
    max_open_positions: Mapped[int] = mapped_column(Integer, nullable=False, default=3)

    investor: Mapped["InvestorProfile"] = relationship(
        "InvestorProfile", back_populates="risk_models"
    )

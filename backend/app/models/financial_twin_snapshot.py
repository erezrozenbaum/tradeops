import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.base import UUIDMixin


class FinancialTwinSnapshot(Base, UUIDMixin):
    __tablename__ = "financial_twin_snapshots"

    investor_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("investor_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    financial_stability: Mapped[float] = mapped_column(Float, nullable=False)
    behavioral_discipline: Mapped[float] = mapped_column(Float, nullable=False)
    emotional_risk: Mapped[float] = mapped_column(Float, nullable=False)
    portfolio_consistency: Mapped[float] = mapped_column(Float, nullable=False)
    financial_resilience: Mapped[float] = mapped_column(Float, nullable=False)
    risk_alignment: Mapped[float] = mapped_column(Float, nullable=False)
    long_term_discipline: Mapped[float] = mapped_column(Float, nullable=False)
    contribution_momentum: Mapped[float] = mapped_column(Float, nullable=False)
    overall_score: Mapped[float] = mapped_column(Float, nullable=False)


class FinancialHealthScore(Base, UUIDMixin):
    __tablename__ = "financial_health_scores"

    investor_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("investor_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    stability: Mapped[float] = mapped_column(Float, nullable=False)
    liquidity: Mapped[float] = mapped_column(Float, nullable=False)
    discipline: Mapped[float] = mapped_column(Float, nullable=False)
    diversification: Mapped[float] = mapped_column(Float, nullable=False)
    emotional_control: Mapped[float] = mapped_column(Float, nullable=False)
    contribution_consistency: Mapped[float] = mapped_column(Float, nullable=False)
    tax_efficiency: Mapped[float] = mapped_column(Float, nullable=False)
    risk_alignment: Mapped[float] = mapped_column(Float, nullable=False)
    financial_resilience: Mapped[float] = mapped_column(Float, nullable=False)
    overall_score: Mapped[float] = mapped_column(Float, nullable=False)

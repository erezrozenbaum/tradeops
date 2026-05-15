import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class MarketSignal(Base):
    __tablename__ = "market_signals"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    investor_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("investor_profiles.id", ondelete="CASCADE"), nullable=False
    )
    ticker: Mapped[str] = mapped_column(String(10), nullable=False)
    signal_type: Mapped[str] = mapped_column(String(20), nullable=False)   # NEWS_SENTIMENT | WHALE_MENTION
    signal_date: Mapped[date] = mapped_column(Date, nullable=False)
    sentiment_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    composite_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    whale_entities: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    personal_guard_metadata: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    guard_status: Mapped[str] = mapped_column(String(20), nullable=False, default="APPROVED")
    mute_reason: Mapped[str | None] = mapped_column(String(200), nullable=True)
    is_dismissed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    investor: Mapped["InvestorProfile"] = relationship("InvestorProfile")

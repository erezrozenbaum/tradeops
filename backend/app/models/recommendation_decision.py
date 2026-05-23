import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.base import UUIDMixin


class RecommendationDecision(Base, UUIDMixin):
    __tablename__ = "recommendation_decisions"

    investor_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("investor_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    decision_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    triggered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    # Deterministic inputs at decision time
    portfolio_snapshot_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("portfolio_snapshots.id", ondelete="SET NULL"),
        nullable=True,
    )
    risk_model_snapshot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    holdings_summary: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    fx_rate_snapshot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    price_snapshot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    market_signals_snapshot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    rule_results: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # AI layer
    model_used: Mapped[str | None] = mapped_column(String(100), nullable=True)
    prompt_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ai_input_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_output_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    input_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    output_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Output
    output_summary: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    recommendation_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    decision_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

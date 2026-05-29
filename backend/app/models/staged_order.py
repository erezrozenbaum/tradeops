import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.base import TimestampMixin, UUIDMixin


class StagedOrder(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "staged_orders"

    investor_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("investor_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    ticker: Mapped[str | None] = mapped_column(String(20), nullable=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    action: Mapped[str] = mapped_column(String(10), nullable=False)  # buy | sell
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    unit_price: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    estimated_value: Mapped[float] = mapped_column(Float, nullable=False)
    asset_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")  # pending | executed | cancelled
    goal_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("financial_goals.id", ondelete="SET NULL"),
        nullable=True,
    )
    goal_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    tax_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    pre_flight_review: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    projected_metrics: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    executed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_outcome: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    outcome_snapshots: Mapped[list | None] = mapped_column(JSONB, nullable=True)  # list of {days, snapshot_at, metrics}
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    reflection: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    investor: Mapped["InvestorProfile"] = relationship("InvestorProfile")  # type: ignore[name-defined]

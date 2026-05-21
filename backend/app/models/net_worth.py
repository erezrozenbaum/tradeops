import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.base import UUIDMixin


class NetWorthSnapshot(Base, UUIDMixin):
    __tablename__ = "net_worth_snapshots"

    investor_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("investor_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    portfolio_value: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    financial_assets_value: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    total_liabilities: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    net_worth: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    snapshot_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

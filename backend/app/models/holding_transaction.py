import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.base import UUIDMixin


class HoldingTransaction(Base, UUIDMixin):
    __tablename__ = "holding_transactions"

    investor_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("investor_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("investment_accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    holding_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("investment_holdings.id", ondelete="SET NULL"),
        nullable=True,
    )
    # buy | sell | dividend | fee | split | bonus
    transaction_type: Mapped[str] = mapped_column(String(20), nullable=False)
    ticker: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    asset_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    quantity: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_per_unit: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_amount: Mapped[float] = mapped_column(Float, nullable=False)
    fees: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    currency: Mapped[str] = mapped_column(String(10), nullable=False)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

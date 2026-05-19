import uuid
from datetime import date

from sqlalchemy import Date, Float, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class FxRateHistory(Base):
    __tablename__ = "fx_rate_history"
    __table_args__ = (
        UniqueConstraint("from_currency", "to_currency", "date", name="uq_fx_rate_history_pair_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    from_currency: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    to_currency: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    # 1 from_currency = rate to_currency (e.g. from=USD, to=ILS, rate=3.70)
    rate: Mapped[float] = mapped_column(Float, nullable=False)
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="yfinance")

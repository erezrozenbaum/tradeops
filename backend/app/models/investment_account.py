import enum
import uuid
from datetime import date

from sqlalchemy import Date, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.base import TimestampMixin, UUIDMixin


class AccountType(str, enum.Enum):
    pension = "pension"
    keren_hishtalmut = "keren_hishtalmut"
    brokerage = "brokerage"
    crypto = "crypto"
    etf_fund = "etf_fund"
    bank = "bank"
    other = "other"


class HoldingAssetType(str, enum.Enum):
    stock = "stock"
    bond = "bond"
    etf = "etf"
    crypto = "crypto"
    fund = "fund"
    pension_fund = "pension_fund"
    real_estate = "real_estate"
    other = "other"


class InvestmentAccount(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "investment_accounts"

    investor_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("investor_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    provider_name: Mapped[str] = mapped_column(String(100), nullable=False)
    account_type: Mapped[str] = mapped_column(String(50), nullable=False)
    account_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    holdings: Mapped[list["InvestmentHolding"]] = relationship(
        "InvestmentHolding", back_populates="account", cascade="all, delete-orphan"
    )


class InvestmentHolding(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "investment_holdings"

    account_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("investment_accounts.id", ondelete="CASCADE"),
        nullable=False,
    )
    ticker: Mapped[str | None] = mapped_column(String(20), nullable=True)
    isin: Mapped[str | None] = mapped_column(String(20), nullable=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    asset_type: Mapped[str] = mapped_column(String(50), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    avg_buy_price: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    fees: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    purchase_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    current_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    account: Mapped["InvestmentAccount"] = relationship(
        "InvestmentAccount", back_populates="holdings"
    )

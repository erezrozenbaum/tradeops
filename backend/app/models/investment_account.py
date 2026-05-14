import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, String, Text
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
    study_fund = "study_fund"
    real_estate = "real_estate"
    call_option = "call_option"
    put_option = "put_option"
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
    is_emergency_fund: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    auto_sync_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sync_broker_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    family_member_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("family_members.id", ondelete="SET NULL"),
        nullable=True,
    )

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
    # Savings fund fields (pension_fund and study_fund)
    current_balance: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_deposits: Mapped[float | None] = mapped_column(Float, nullable=True)
    monthly_contribution: Mapped[float | None] = mapped_column(Float, nullable=True)
    annual_return_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Study fund specific
    monthly_contribution_employee: Mapped[float | None] = mapped_column(Float, nullable=True)
    monthly_contribution_employer: Mapped[float | None] = mapped_column(Float, nullable=True)
    fund_status: Mapped[str | None] = mapped_column(String(20), nullable=True)  # "active" | "inactive"
    is_emergency_fund: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    management_fee_balance_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    management_fee_contribution_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Options fields (call_option / put_option asset types)
    strike_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    option_type: Mapped[str | None] = mapped_column(String(10), nullable=True)  # "call" | "put"
    underlying_ticker: Mapped[str | None] = mapped_column(String(20), nullable=True)
    contract_multiplier: Mapped[float | None] = mapped_column(Float, nullable=True)
    position_type: Mapped[str | None] = mapped_column(String(10), nullable=True)  # "long" | "short"

    account: Mapped["InvestmentAccount"] = relationship(
        "InvestmentAccount", back_populates="holdings"
    )

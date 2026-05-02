import enum
import uuid

from sqlalchemy import Boolean, Enum, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.base import TimestampMixin, UUIDMixin


class JobStability(str, enum.Enum):
    stable = "stable"
    freelance = "freelance"
    unstable = "unstable"
    unemployed = "unemployed"


class IncomeTrend(str, enum.Enum):
    growing = "growing"
    stable = "stable"
    declining = "declining"


class AssetType(str, enum.Enum):
    cash = "cash"
    stocks = "stocks"
    bonds = "bonds"
    etf = "etf"
    real_estate = "real_estate"
    crypto = "crypto"
    pension = "pension"
    vehicle = "vehicle"
    other = "other"


class LiabilityType(str, enum.Enum):
    mortgage = "mortgage"
    car_loan = "car_loan"
    personal_loan = "personal_loan"
    credit_card = "credit_card"
    student_loan = "student_loan"
    other = "other"


class FinancialProfile(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "financial_profiles"

    investor_profile_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("investor_profiles.id"), nullable=False, unique=True
    )
    monthly_income: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    monthly_expenses: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    liquid_savings: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    emergency_fund_months: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    job_stability: Mapped[JobStability] = mapped_column(
        Enum(JobStability), nullable=False, default=JobStability.stable
    )
    income_trend: Mapped[IncomeTrend] = mapped_column(
        Enum(IncomeTrend), nullable=False, default=IncomeTrend.stable
    )
    dependents_count: Mapped[int] = mapped_column(nullable=False, default=0)
    investable_capital_pct: Mapped[float] = mapped_column(Float, nullable=False, default=20.0)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)

    investor: Mapped["InvestorProfile"] = relationship(
        "InvestorProfile", back_populates="financial_profile"
    )
    assets: Mapped[list["FinancialAsset"]] = relationship(
        "FinancialAsset", back_populates="financial_profile", cascade="all, delete-orphan"
    )
    liabilities: Mapped[list["FinancialLiability"]] = relationship(
        "FinancialLiability", back_populates="financial_profile", cascade="all, delete-orphan"
    )


class FinancialAsset(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "financial_assets"

    financial_profile_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("financial_profiles.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    asset_type: Mapped[AssetType] = mapped_column(Enum(AssetType), nullable=False)
    current_value: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    market: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_liquid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    financial_profile: Mapped["FinancialProfile"] = relationship(
        "FinancialProfile", back_populates="assets"
    )


class FinancialLiability(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "financial_liabilities"

    financial_profile_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("financial_profiles.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    liability_type: Mapped[LiabilityType] = mapped_column(Enum(LiabilityType), nullable=False)
    outstanding_balance: Mapped[float] = mapped_column(Float, nullable=False)
    monthly_payment: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    interest_rate_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    financial_profile: Mapped["FinancialProfile"] = relationship(
        "FinancialProfile", back_populates="liabilities"
    )

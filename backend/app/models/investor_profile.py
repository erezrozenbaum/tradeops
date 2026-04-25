import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.base import TimestampMixin, UUIDMixin


class ExperienceLevel(str, enum.Enum):
    beginner = "beginner"
    intermediate = "intermediate"
    advanced = "advanced"


class InvestorProfile(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "investor_profiles"

    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    date_of_birth: Mapped[date] = mapped_column(Date, nullable=False)
    country: Mapped[str] = mapped_column(String(3), nullable=False)  # ISO 3166-1 alpha-2/3
    nationality: Mapped[str | None] = mapped_column(String(3), nullable=True)
    tax_residency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    base_currency: Mapped[str] = mapped_column(String(3), nullable=False)  # ISO 4217
    local_currency: Mapped[str] = mapped_column(String(3), nullable=False)
    experience_level: Mapped[ExperienceLevel] = mapped_column(
        Enum(ExperienceLevel), nullable=False, default=ExperienceLevel.beginner
    )
    is_minor: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Relationships
    financial_profile: Mapped["FinancialProfile | None"] = relationship(
        "FinancialProfile", back_populates="investor", uselist=False, cascade="all, delete-orphan"
    )
    goals: Mapped[list["FinancialGoal"]] = relationship(
        "FinancialGoal", back_populates="investor", cascade="all, delete-orphan"
    )
    risk_models: Mapped[list["RiskModel"]] = relationship(
        "RiskModel", back_populates="investor", cascade="all, delete-orphan"
    )
    family_memberships: Mapped[list["FamilyMember"]] = relationship(
        "FamilyMember", back_populates="investor"
    )
    audit_events: Mapped[list["AuditEvent"]] = relationship(
        "AuditEvent", back_populates="investor"
    )
    strategy_recommendations: Mapped[list["StrategyRecommendation"]] = relationship(
        "StrategyRecommendation", back_populates="investor", cascade="all, delete-orphan"
    )
    backtest_runs: Mapped[list["BacktestRun"]] = relationship(
        "BacktestRun", back_populates="investor", cascade="all, delete-orphan"
    )

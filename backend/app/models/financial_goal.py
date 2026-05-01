import enum
import uuid
from datetime import date

from sqlalchemy import Date, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.base import TimestampMixin, UUIDMixin


class GoalType(str, enum.Enum):
    emergency_fund = "emergency_fund"
    house_purchase = "house_purchase"
    retirement = "retirement"
    child_education = "child_education"
    debt_reduction = "debt_reduction"
    wealth_growth = "wealth_growth"
    passive_income = "passive_income"
    custom = "custom"


class GoalRiskSuitability(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class FinancialGoal(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "financial_goals"

    investor_profile_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("investor_profiles.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    goal_type: Mapped[GoalType] = mapped_column(Enum(GoalType), nullable=False)
    target_amount: Mapped[float] = mapped_column(Float, nullable=False)
    current_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    risk_suitability: Mapped[GoalRiskSuitability] = mapped_column(
        Enum(GoalRiskSuitability), nullable=False, default=GoalRiskSuitability.low
    )
    tracking_mode: Mapped[str] = mapped_column(
        String(50), nullable=False, default="target_by_date"
    )
    mode_config: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    investor: Mapped["InvestorProfile"] = relationship(
        "InvestorProfile", back_populates="goals"
    )
    progress_logs: Mapped[list["GoalProgressLog"]] = relationship(
        "GoalProgressLog", back_populates="goal", cascade="all, delete-orphan"
    )

    @property
    def progress_pct(self) -> float:
        if self.target_amount <= 0:
            return 0.0
        return round(min(self.current_amount / self.target_amount * 100, 100), 2)

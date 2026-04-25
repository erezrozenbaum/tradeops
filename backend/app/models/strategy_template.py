import enum
import uuid

from sqlalchemy import Boolean, Enum, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.base import TimestampMixin, UUIDMixin


class StrategyType(str, enum.Enum):
    foundation_building = "foundation_building"
    conservative = "conservative"
    balanced = "balanced"
    growth = "growth"
    speculative = "speculative"
    education_only = "education_only"


class StrategyTemplate(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "strategy_templates"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    strategy_type: Mapped[StrategyType] = mapped_column(Enum(StrategyType), nullable=False)
    asset_classes: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False)
    markets: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False)

    # Selection criteria
    min_stability_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    allowed_risk_modifiers: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False)
    min_experience_level: Mapped[str] = mapped_column(String(20), nullable=False, default="beginner")
    suitable_for_minors: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    min_investable_capital: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    time_horizon_min_months: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    recommendations: Mapped[list["StrategyRecommendation"]] = relationship(
        "StrategyRecommendation", back_populates="template"
    )

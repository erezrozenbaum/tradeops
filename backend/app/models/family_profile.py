import enum
import uuid

from sqlalchemy import Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.base import TimestampMixin, UUIDMixin


class RiskTolerance(str, enum.Enum):
    conservative = "conservative"
    moderate = "moderate"
    aggressive = "aggressive"


class FamilyProfile(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "family_profiles"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    primary_investor_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("investor_profiles.id"), nullable=False
    )
    base_currency: Mapped[str] = mapped_column(String(3), nullable=False)

    members: Mapped[list["FamilyMember"]] = relationship(
        "FamilyMember", back_populates="family", cascade="all, delete-orphan"
    )


class FamilyMember(Base, UUIDMixin):
    __tablename__ = "family_members"

    family_profile_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("family_profiles.id"), nullable=False
    )
    investor_profile_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("investor_profiles.id"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    relationship_type: Mapped[str] = mapped_column(String(50), nullable=False)
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_primary: Mapped[bool] = mapped_column(default=False)
    individual_risk_tolerance: Mapped[RiskTolerance | None] = mapped_column(
        Enum(RiskTolerance), nullable=True
    )

    family: Mapped["FamilyProfile"] = relationship("FamilyProfile", back_populates="members")
    investor: Mapped["InvestorProfile | None"] = relationship(
        "InvestorProfile", back_populates="family_memberships"
    )

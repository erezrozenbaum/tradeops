from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.base import TimestampMixin, UUIDMixin


class Household(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "households"

    name: Mapped[str] = mapped_column(String(100), nullable=False)

    members: Mapped[list["InvestorProfile"]] = relationship(
        "InvestorProfile", back_populates="household"
    )

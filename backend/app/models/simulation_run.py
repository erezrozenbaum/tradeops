import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.base import UUIDMixin


class SimulationRun(Base, UUIDMixin):
    __tablename__ = "simulation_runs"

    investor_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("investor_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scenario_type: Mapped[str] = mapped_column(String(30), nullable=False)
    scenario_name: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="completed")
    horizon_months: Mapped[int] = mapped_column(Integer, nullable=False)
    parameters: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    data_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    results: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    random_seed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_saved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    disclaimer: Mapped[str] = mapped_column(Text, nullable=False)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class SimulationComparisonSet(Base, UUIDMixin):
    __tablename__ = "simulation_comparison_sets"

    investor_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("investor_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    simulation_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

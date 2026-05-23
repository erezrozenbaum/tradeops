import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class CommandCenterCheckpoint(Base):
    __tablename__ = "command_center_checkpoints"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    investor_id = Column(UUID(as_uuid=True), ForeignKey("investor_profiles.id", ondelete="CASCADE"), nullable=False)
    checkpoint_at = Column(DateTime(timezone=True), nullable=False)
    twin_overall_score = Column(Float, nullable=True)
    maturity_composite_score = Column(Float, nullable=True)
    stability_score = Column(Float, nullable=True)
    net_worth = Column(Float, nullable=True)
    behavioral_discipline = Column(Float, nullable=True)
    financial_resilience = Column(Float, nullable=True)
    active_risk_count = Column(Integer, nullable=True)
    top_concentration_pct = Column(Float, nullable=True)

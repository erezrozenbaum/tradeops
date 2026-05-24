import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.db.base import Base


class AIMemoryEntry(Base):
    __tablename__ = "ai_memory_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    investor_id = Column(UUID(as_uuid=True), ForeignKey("investor_profiles.id", ondelete="CASCADE"), nullable=False)
    summary_at = Column(DateTime(timezone=True), nullable=False)
    verbosity = Column(String(20), nullable=False)
    portfolio_assessment = Column(Text, nullable=False)
    key_metrics = Column(JSONB, nullable=True)

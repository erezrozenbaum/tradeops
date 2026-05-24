from __future__ import annotations

import uuid

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from sqlalchemy.dialects.postgresql import UUID as PG_UUID


class AdvisorShareToken(Base):
    __tablename__ = "advisor_share_tokens"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    investor_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("investor_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[object] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

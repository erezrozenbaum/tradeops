"""ai_memory_entries table

Revision ID: 0047
Revises: 0046
Create Date: 2026-05-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0047"
down_revision = "0046"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_memory_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("investor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("investor_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("summary_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("verbosity", sa.String(20), nullable=False),
        sa.Column("portfolio_assessment", sa.Text(), nullable=False),
        sa.Column("key_metrics", postgresql.JSONB(), nullable=True),
    )
    op.create_index("ix_ai_memory_investor_at", "ai_memory_entries", ["investor_id", "summary_at"])


def downgrade() -> None:
    op.drop_table("ai_memory_entries")

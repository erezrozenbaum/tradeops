"""market_research_history — persist market research reports

Revision ID: 0039
Revises: 0038
Create Date: 2026-05-20
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0039"
down_revision = "0038"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "market_research_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("investor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("investor_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("report", postgresql.JSONB(), nullable=False),
        sa.Column("picks_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("universe_size", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_mrr_investor_id", "market_research_reports", ["investor_id"])
    op.create_index("ix_mrr_generated_at", "market_research_reports", ["generated_at"])


def downgrade() -> None:
    op.drop_index("ix_mrr_generated_at", "market_research_reports")
    op.drop_index("ix_mrr_investor_id", "market_research_reports")
    op.drop_table("market_research_reports")

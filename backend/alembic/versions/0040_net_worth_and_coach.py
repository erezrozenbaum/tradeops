"""net_worth_snapshots + coach_insights

Revision ID: 0040
Revises: 0039
Create Date: 2026-05-20
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0040"
down_revision = "0039"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "net_worth_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("investor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("investor_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("portfolio_value", sa.Float(), nullable=False, server_default="0"),
        sa.Column("financial_assets_value", sa.Float(), nullable=False, server_default="0"),
        sa.Column("total_liabilities", sa.Float(), nullable=False, server_default="0"),
        sa.Column("net_worth", sa.Float(), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("snapshot_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_nws_investor_id", "net_worth_snapshots", ["investor_id"])
    op.create_index("ix_nws_snapshot_at", "net_worth_snapshots", ["snapshot_at"])

    op.create_table(
        "coach_insights",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("investor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("investor_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("insight_type", sa.String(50), nullable=False),
        sa.Column("dedup_key", sa.String(100), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False, server_default="info"),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("action_text", sa.Text(), nullable=True),
        sa.Column("link", sa.String(255), nullable=True),
        sa.Column("is_dismissed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("dismissed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_ci_investor_id", "coach_insights", ["investor_id"])
    op.create_index("ix_ci_dedup_key", "coach_insights", ["investor_id", "dedup_key"])


def downgrade() -> None:
    op.drop_index("ix_ci_dedup_key", "coach_insights")
    op.drop_index("ix_ci_investor_id", "coach_insights")
    op.drop_table("coach_insights")
    op.drop_index("ix_nws_snapshot_at", "net_worth_snapshots")
    op.drop_index("ix_nws_investor_id", "net_worth_snapshots")
    op.drop_table("net_worth_snapshots")

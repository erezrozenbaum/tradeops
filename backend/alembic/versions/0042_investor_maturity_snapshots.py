"""investor_maturity_snapshots table

Revision ID: 0042
Revises: 0041
Create Date: 2026-05-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0042"
down_revision = "0041"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "investor_maturity_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("investor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("investor_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("computed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("composite_score", sa.Float, nullable=False),
        sa.Column("stage", sa.String(30), nullable=False),
        sa.Column("component_scores", postgresql.JSONB, nullable=False),
        sa.Column("features_unlocked", postgresql.JSONB, nullable=False),
        sa.Column("notes", postgresql.JSONB, nullable=False),
    )
    op.create_index("ix_investor_maturity_investor", "investor_maturity_snapshots", ["investor_id"])
    op.create_index("ix_investor_maturity_computed_at", "investor_maturity_snapshots", ["computed_at"])
    op.create_index("ix_investor_maturity_stage", "investor_maturity_snapshots", ["stage"])


def downgrade() -> None:
    op.drop_index("ix_investor_maturity_stage", table_name="investor_maturity_snapshots")
    op.drop_index("ix_investor_maturity_computed_at", table_name="investor_maturity_snapshots")
    op.drop_index("ix_investor_maturity_investor", table_name="investor_maturity_snapshots")
    op.drop_table("investor_maturity_snapshots")

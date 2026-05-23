"""command_center_checkpoints table

Revision ID: 0046
Revises: 0045
Create Date: 2026-05-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0046"
down_revision = "0045"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "command_center_checkpoints",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("investor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("investor_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("checkpoint_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("twin_overall_score", sa.Float(), nullable=True),
        sa.Column("maturity_composite_score", sa.Float(), nullable=True),
        sa.Column("stability_score", sa.Float(), nullable=True),
        sa.Column("net_worth", sa.Numeric(precision=20, scale=2), nullable=True),
        sa.Column("behavioral_discipline", sa.Float(), nullable=True),
        sa.Column("financial_resilience", sa.Float(), nullable=True),
        sa.Column("active_risk_count", sa.Integer(), nullable=True),
        sa.Column("top_concentration_pct", sa.Float(), nullable=True),
    )
    op.create_index("ix_cc_checkpoints_investor_at", "command_center_checkpoints", ["investor_id", "checkpoint_at"])
    op.create_unique_constraint("uq_cc_checkpoints_investor_at", "command_center_checkpoints", ["investor_id", "checkpoint_at"])


def downgrade() -> None:
    op.drop_table("command_center_checkpoints")

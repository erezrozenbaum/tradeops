"""financial_twin_snapshots and financial_health_scores tables

Revision ID: 0043
Revises: 0042
Create Date: 2026-05-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0043"
down_revision = "0042"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "financial_twin_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("investor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("investor_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("computed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("financial_stability", sa.Float, nullable=False),
        sa.Column("behavioral_discipline", sa.Float, nullable=False),
        sa.Column("emotional_risk", sa.Float, nullable=False),
        sa.Column("portfolio_consistency", sa.Float, nullable=False),
        sa.Column("financial_resilience", sa.Float, nullable=False),
        sa.Column("risk_alignment", sa.Float, nullable=False),
        sa.Column("long_term_discipline", sa.Float, nullable=False),
        sa.Column("contribution_momentum", sa.Float, nullable=False),
        sa.Column("overall_score", sa.Float, nullable=False),
    )
    op.create_index("ix_financial_twin_investor", "financial_twin_snapshots", ["investor_id"])
    op.create_index("ix_financial_twin_computed_at", "financial_twin_snapshots", ["computed_at"])

    op.create_table(
        "financial_health_scores",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("investor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("investor_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("computed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("stability", sa.Float, nullable=False),
        sa.Column("liquidity", sa.Float, nullable=False),
        sa.Column("discipline", sa.Float, nullable=False),
        sa.Column("diversification", sa.Float, nullable=False),
        sa.Column("emotional_control", sa.Float, nullable=False),
        sa.Column("contribution_consistency", sa.Float, nullable=False),
        sa.Column("tax_efficiency", sa.Float, nullable=False),
        sa.Column("risk_alignment", sa.Float, nullable=False),
        sa.Column("financial_resilience", sa.Float, nullable=False),
        sa.Column("overall_score", sa.Float, nullable=False),
    )
    op.create_index("ix_financial_health_investor", "financial_health_scores", ["investor_id"])
    op.create_index("ix_financial_health_computed_at", "financial_health_scores", ["computed_at"])


def downgrade() -> None:
    op.drop_index("ix_financial_health_computed_at", table_name="financial_health_scores")
    op.drop_index("ix_financial_health_investor", table_name="financial_health_scores")
    op.drop_table("financial_health_scores")
    op.drop_index("ix_financial_twin_computed_at", table_name="financial_twin_snapshots")
    op.drop_index("ix_financial_twin_investor", table_name="financial_twin_snapshots")
    op.drop_table("financial_twin_snapshots")

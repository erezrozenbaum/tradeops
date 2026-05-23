"""recommendation_decisions provenance table

Revision ID: 0041
Revises: 0040
Create Date: 2026-05-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0041"
down_revision = "0040"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "recommendation_decisions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("investor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("investor_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("decision_type", sa.String(50), nullable=False),
        sa.Column("triggered_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        # Deterministic inputs captured at decision time
        sa.Column("portfolio_snapshot_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("portfolio_snapshots.id", ondelete="SET NULL"), nullable=True),
        sa.Column("risk_model_snapshot", postgresql.JSONB, nullable=True),
        sa.Column("holdings_summary", postgresql.JSONB, nullable=True),
        sa.Column("fx_rate_snapshot", postgresql.JSONB, nullable=True),
        sa.Column("price_snapshot", postgresql.JSONB, nullable=True),
        sa.Column("market_signals_snapshot", postgresql.JSONB, nullable=True),
        sa.Column("rule_results", postgresql.JSONB, nullable=True),
        # AI layer
        sa.Column("model_used", sa.String(100), nullable=True),
        sa.Column("prompt_version", sa.String(50), nullable=True),
        sa.Column("ai_input_summary", sa.Text, nullable=True),
        sa.Column("ai_output_summary", sa.Text, nullable=True),
        sa.Column("input_tokens", sa.Integer, nullable=True),
        sa.Column("output_tokens", sa.Integer, nullable=True),
        # Output
        sa.Column("output_summary", postgresql.JSONB, nullable=True),
        sa.Column("recommendation_count", sa.Integer, nullable=True),
        sa.Column("decision_hash", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_recommendation_decisions_investor", "recommendation_decisions", ["investor_id"])
    op.create_index("ix_recommendation_decisions_triggered_at", "recommendation_decisions", ["triggered_at"])
    op.create_index("ix_recommendation_decisions_type", "recommendation_decisions", ["decision_type"])


def downgrade() -> None:
    op.drop_index("ix_recommendation_decisions_type", table_name="recommendation_decisions")
    op.drop_index("ix_recommendation_decisions_triggered_at", table_name="recommendation_decisions")
    op.drop_index("ix_recommendation_decisions_investor", table_name="recommendation_decisions")
    op.drop_table("recommendation_decisions")

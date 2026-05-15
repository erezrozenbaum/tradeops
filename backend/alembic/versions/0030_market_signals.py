"""add market_signals table

Revision ID: 0030
Revises: 0029
Create Date: 2026-05-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0030"
down_revision = "0029"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "market_signals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("investor_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("investor_profiles.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("ticker", sa.String(10), nullable=False),
        sa.Column("signal_type", sa.String(20), nullable=False),   # NEWS_SENTIMENT | WHALE_MENTION
        sa.Column("signal_date", sa.Date(), nullable=False),
        sa.Column("sentiment_score", sa.Float(), nullable=True),    # -1.0 to +1.0
        sa.Column("composite_score", sa.Integer(), nullable=True),  # 0-100
        sa.Column("rationale", sa.Text(), nullable=True),
        sa.Column("whale_entities", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("personal_guard_metadata", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("guard_status", sa.String(20), nullable=False, server_default="APPROVED"),
        sa.Column("mute_reason", sa.String(200), nullable=True),
        sa.Column("is_dismissed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )
    # Unique: one signal record per investor + ticker + day (idempotent worker runs)
    op.create_index(
        "uq_market_signals_investor_ticker_date",
        "market_signals",
        ["investor_id", "ticker", "signal_date"],
        unique=True,
    )
    op.create_index("ix_market_signals_investor_id", "market_signals", ["investor_id"])


def downgrade() -> None:
    op.drop_index("ix_market_signals_investor_id", table_name="market_signals")
    op.drop_index("uq_market_signals_investor_ticker_date", table_name="market_signals")
    op.drop_table("market_signals")

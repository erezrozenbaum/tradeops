"""Live trading: sessions + orders tables

Revision ID: 0035
Revises: 0034
Create Date: 2026-05-16
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0035"
down_revision = "0034"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "live_trading_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("investor_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("investor_profiles.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("ibkr_account_id", sa.String(50), nullable=False),
        sa.Column("gateway_url", sa.String(200), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("acknowledged_risk", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("halted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("halt_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "live_orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("session_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("live_trading_sessions.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("investor_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("investor_profiles.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("ticker", sa.String(20), nullable=False),
        sa.Column("order_type", sa.String(10), nullable=False),
        sa.Column("side", sa.String(5), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("limit_price", sa.Float(), nullable=True),
        sa.Column("estimated_value", sa.Float(), nullable=True),
        sa.Column("ibkr_order_id", sa.String(50), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("filled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
    )
    op.create_check_constraint(
        "ck_live_orders_order_type", "live_orders",
        "order_type IN ('market', 'limit')"
    )
    op.create_check_constraint(
        "ck_live_orders_side", "live_orders",
        "side IN ('buy', 'sell')"
    )
    op.create_check_constraint(
        "ck_live_orders_status", "live_orders",
        "status IN ('pending', 'submitted', 'filled', 'rejected', 'cancelled')"
    )


def downgrade() -> None:
    op.drop_table("live_orders")
    op.drop_table("live_trading_sessions")

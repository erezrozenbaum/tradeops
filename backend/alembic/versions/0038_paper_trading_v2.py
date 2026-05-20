"""paper_trading_v2 — cash balance, positions, orders; relax FK constraints

Revision ID: 0038
Revises: 0037
Create Date: 2026-05-20
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0038"
down_revision = "0037"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- paper_portfolios -------------------------------------------------
    # Add cash_balance (current liquid cash in portfolio)
    op.add_column(
        "paper_portfolios",
        sa.Column("cash_balance", sa.Float(), nullable=False, server_default="0"),
    )
    # Make strategy_template_id / risk_model_id optional (free-form portfolios)
    op.alter_column("paper_portfolios", "strategy_template_id", nullable=True)
    op.alter_column("paper_portfolios", "risk_model_id", nullable=True)

    # --- paper_positions --------------------------------------------------
    op.create_table(
        "paper_positions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("portfolio_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("paper_portfolios.id", ondelete="CASCADE"), nullable=False),
        sa.Column("symbol", sa.String(20), nullable=False),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("avg_cost_per_share", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(10), nullable=False, server_default="USD"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("portfolio_id", "symbol", name="uq_paper_positions_portfolio_symbol"),
    )
    op.create_index("ix_paper_positions_portfolio_id", "paper_positions", ["portfolio_id"])

    # --- paper_orders -----------------------------------------------------
    op.create_table(
        "paper_orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("portfolio_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("paper_portfolios.id", ondelete="CASCADE"), nullable=False),
        sa.Column("symbol", sa.String(20), nullable=False),
        sa.Column("side", sa.String(4), nullable=False),   # "buy" | "sell"
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("price_per_share", sa.Float(), nullable=False),
        sa.Column("total_value", sa.Float(), nullable=False),
        sa.Column("executed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_paper_orders_portfolio_id", "paper_orders", ["portfolio_id"])


def downgrade() -> None:
    op.drop_index("ix_paper_orders_portfolio_id", "paper_orders")
    op.drop_table("paper_orders")
    op.drop_index("ix_paper_positions_portfolio_id", "paper_positions")
    op.drop_table("paper_positions")
    op.drop_column("paper_portfolios", "cash_balance")
    op.alter_column("paper_portfolios", "strategy_template_id", nullable=False)
    op.alter_column("paper_portfolios", "risk_model_id", nullable=False)

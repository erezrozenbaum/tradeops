"""paper trading tables

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "paper_portfolios",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "investor_profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("investor_profiles.id"),
            nullable=False,
        ),
        sa.Column(
            "strategy_template_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("strategy_templates.id"),
            nullable=False,
        ),
        sa.Column(
            "risk_model_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("risk_models.id"),
            nullable=False,
        ),
        sa.Column(
            "backtest_run_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("backtest_runs.id"),
            nullable=True,
        ),
        sa.Column("initial_capital", sa.Float, nullable=False),
        sa.Column("current_value", sa.Float, nullable=False),
        sa.Column("total_return_pct", sa.Float, nullable=False, server_default="0"),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column(
            "status",
            sa.Enum("active", "paused", "completed", name="portfolio_status"),
            nullable=False,
            server_default="active",
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("last_tick_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "paper_ticks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "portfolio_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("paper_portfolios.id"),
            nullable=False,
        ),
        sa.Column("tick_number", sa.Integer, nullable=False),
        sa.Column("portfolio_value_before", sa.Float, nullable=False),
        sa.Column("portfolio_value_after", sa.Float, nullable=False),
        sa.Column("monthly_return_pct", sa.Float, nullable=False),
        sa.Column("simulated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_index("ix_paper_portfolios_investor_id", "paper_portfolios", ["investor_profile_id"])
    op.create_index("ix_paper_portfolios_status", "paper_portfolios", ["status"])
    op.create_index("ix_paper_ticks_portfolio_id", "paper_ticks", ["portfolio_id"])


def downgrade() -> None:
    op.drop_index("ix_paper_ticks_portfolio_id", "paper_ticks")
    op.drop_index("ix_paper_portfolios_status", "paper_portfolios")
    op.drop_index("ix_paper_portfolios_investor_id", "paper_portfolios")
    op.drop_table("paper_ticks")
    op.drop_table("paper_portfolios")
    op.execute("DROP TYPE IF EXISTS portfolio_status")

"""backtest tables

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "backtest_runs",
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
        sa.Column("initial_capital", sa.Float, nullable=False),
        sa.Column("final_capital", sa.Float, nullable=False),
        sa.Column("period_months", sa.Integer, nullable=False),
        sa.Column("seed", sa.Integer, nullable=True),
        sa.Column("total_return_pct", sa.Float, nullable=False),
        sa.Column("annualized_return_pct", sa.Float, nullable=False),
        sa.Column("max_drawdown_pct", sa.Float, nullable=False),
        sa.Column("sharpe_ratio", sa.Float, nullable=False),
        sa.Column("win_rate_pct", sa.Float, nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("notes", sa.Text, nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "backtest_periods",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "backtest_run_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("backtest_runs.id"),
            nullable=False,
        ),
        sa.Column("month", sa.Integer, nullable=False),
        sa.Column("portfolio_value", sa.Float, nullable=False),
        sa.Column("monthly_return_pct", sa.Float, nullable=False),
    )

    op.create_index("ix_backtest_runs_investor_id", "backtest_runs", ["investor_profile_id"])
    op.create_index("ix_backtest_runs_template_id", "backtest_runs", ["strategy_template_id"])
    op.create_index("ix_backtest_periods_run_id", "backtest_periods", ["backtest_run_id"])


def downgrade() -> None:
    op.drop_index("ix_backtest_periods_run_id", "backtest_periods")
    op.drop_index("ix_backtest_runs_template_id", "backtest_runs")
    op.drop_index("ix_backtest_runs_investor_id", "backtest_runs")
    op.drop_table("backtest_periods")
    op.drop_table("backtest_runs")

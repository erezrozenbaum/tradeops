"""goal tracking modes + progress logs

Revision ID: 0011
Revises: 0010
Create Date: 2026-05-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add tracking_mode and mode_config to financial_goals
    op.add_column(
        "financial_goals",
        sa.Column(
            "tracking_mode",
            sa.String(50),
            nullable=False,
            server_default="target_by_date",
        ),
    )
    op.add_column(
        "financial_goals",
        sa.Column("mode_config", postgresql.JSONB, nullable=True),
    )

    # New table: goal_progress_logs
    op.create_table(
        "goal_progress_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "goal_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("financial_goals.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("period_year", sa.Integer, nullable=False),
        sa.Column("period_month", sa.Integer, nullable=False),
        sa.Column("planned_amount", sa.Float, nullable=False, server_default="0"),
        sa.Column("actual_amount", sa.Float, nullable=False, server_default="0"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "goal_id", "period_year", "period_month",
            name="uq_goal_progress_period",
        ),
    )
    op.create_index("ix_goal_progress_logs_goal_id", "goal_progress_logs", ["goal_id"])


def downgrade() -> None:
    op.drop_index("ix_goal_progress_logs_goal_id", table_name="goal_progress_logs")
    op.drop_table("goal_progress_logs")
    op.drop_column("financial_goals", "mode_config")
    op.drop_column("financial_goals", "tracking_mode")

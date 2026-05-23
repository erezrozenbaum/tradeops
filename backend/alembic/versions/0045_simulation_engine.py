"""simulation_runs and simulation_comparison_sets tables

Revision ID: 0045
Revises: 0044
Create Date: 2026-05-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0045"
down_revision = "0044"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "simulation_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "investor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("investor_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("scenario_type", sa.String(30), nullable=False),
        sa.Column("scenario_name", sa.String(100), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="completed"),
        sa.Column("horizon_months", sa.Integer, nullable=False),
        sa.Column("parameters", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("data_snapshot", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("results", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("random_seed", sa.Integer, nullable=True),
        sa.Column("is_saved", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("disclaimer", sa.Text, nullable=False),
        sa.Column(
            "computed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_simulation_runs_investor_id", "simulation_runs", ["investor_id"])
    op.create_index("ix_simulation_runs_computed_at", "simulation_runs", ["computed_at"])
    op.create_index(
        "ix_simulation_runs_investor_saved",
        "simulation_runs",
        ["investor_id", "is_saved"],
    )

    op.create_table(
        "simulation_comparison_sets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "investor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("investor_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("simulation_ids", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_simulation_comparison_sets_investor_id",
        "simulation_comparison_sets",
        ["investor_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_simulation_comparison_sets_investor_id",
        table_name="simulation_comparison_sets",
    )
    op.drop_table("simulation_comparison_sets")
    op.drop_index("ix_simulation_runs_investor_saved", table_name="simulation_runs")
    op.drop_index("ix_simulation_runs_computed_at", table_name="simulation_runs")
    op.drop_index("ix_simulation_runs_investor_id", table_name="simulation_runs")
    op.drop_table("simulation_runs")

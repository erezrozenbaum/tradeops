"""recurring_investment_plans table

Revision ID: 0052
Revises: 0051
Create Date: 2026-05-27
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "0052"
down_revision = "0051"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "recurring_investment_plans",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "investor_id",
            UUID(as_uuid=True),
            sa.ForeignKey("investor_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("frequency", sa.String(20), nullable=False, server_default="monthly"),
        sa.Column("day_of_month", sa.Integer(), nullable=True, server_default="1"),
        sa.Column("allocations", JSONB(), nullable=False, server_default="[]"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_recurring_plans_investor_id", "recurring_investment_plans", ["investor_id"])
    op.create_index("ix_recurring_plans_next_run_at", "recurring_investment_plans", ["next_run_at"])


def downgrade() -> None:
    op.drop_index("ix_recurring_plans_next_run_at", table_name="recurring_investment_plans")
    op.drop_index("ix_recurring_plans_investor_id", table_name="recurring_investment_plans")
    op.drop_table("recurring_investment_plans")

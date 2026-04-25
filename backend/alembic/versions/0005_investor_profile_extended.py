"""investor profile extended fields

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("investor_profiles", sa.Column("investment_goal", sa.String(50), nullable=True))
    op.add_column("investor_profiles", sa.Column("risk_tolerance", sa.String(20), nullable=True))
    op.add_column("investor_profiles", sa.Column("time_horizon", sa.String(20), nullable=True))
    op.add_column(
        "investor_profiles",
        sa.Column("preferred_assets", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column("investor_profiles", sa.Column("trading_frequency", sa.String(10), nullable=True))
    op.add_column(
        "investor_profiles",
        sa.Column("guardian_required", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("investor_profiles", "guardian_required")
    op.drop_column("investor_profiles", "trading_frequency")
    op.drop_column("investor_profiles", "preferred_assets")
    op.drop_column("investor_profiles", "time_horizon")
    op.drop_column("investor_profiles", "risk_tolerance")
    op.drop_column("investor_profiles", "investment_goal")

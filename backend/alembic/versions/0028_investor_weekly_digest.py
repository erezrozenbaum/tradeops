"""add weekly_digest_enabled to investor_profiles

Revision ID: 0028
Revises: 0027
Create Date: 2026-05-15
"""
from alembic import op
import sqlalchemy as sa

revision = "0028"
down_revision = "0027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "investor_profiles",
        sa.Column("weekly_digest_enabled", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("investor_profiles", "weekly_digest_enabled")

"""add vehicle to asset_type enum

Revision ID: 0014
Revises: 0013
Create Date: 2026-05-01
"""
import sqlalchemy as sa
from alembic import op

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(sa.text("ALTER TYPE asset_type ADD VALUE IF NOT EXISTS 'vehicle'"))


def downgrade() -> None:
    # PostgreSQL does not support removing enum values; downgrade is a no-op
    pass

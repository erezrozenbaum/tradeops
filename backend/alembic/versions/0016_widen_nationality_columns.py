"""widen nationality and tax_residency from VARCHAR(3) to VARCHAR(100)

Revision ID: 0016
Revises: 0015
Create Date: 2026-05-02
"""
import sqlalchemy as sa
from alembic import op

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("investor_profiles", "nationality", type_=sa.String(100), existing_nullable=True)
    op.alter_column("investor_profiles", "tax_residency", type_=sa.String(100), existing_nullable=True)


def downgrade() -> None:
    op.alter_column("investor_profiles", "nationality", type_=sa.String(3), existing_nullable=True)
    op.alter_column("investor_profiles", "tax_residency", type_=sa.String(3), existing_nullable=True)

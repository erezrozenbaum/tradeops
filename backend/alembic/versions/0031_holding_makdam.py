"""Add makdam column to investment_holdings for Israeli pension coefficient.

Revision ID: 0031
Revises: 0030
Create Date: 2026-05-15
"""
from alembic import op
import sqlalchemy as sa

revision = "0031"
down_revision = "0030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "investment_holdings",
        sa.Column("makdam", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("investment_holdings", "makdam")

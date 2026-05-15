"""add purchase_fx_rate to investment_holdings

Revision ID: 0029
Revises: 0028
Create Date: 2026-05-15
"""
from alembic import op
import sqlalchemy as sa

revision = "0029"
down_revision = "0028"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "investment_holdings",
        sa.Column("purchase_fx_rate", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("investment_holdings", "purchase_fx_rate")

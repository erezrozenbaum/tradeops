"""pension fund fields on investment_holdings

Revision ID: 0012
Revises: 0011
Create Date: 2026-05-01
"""
from alembic import op
import sqlalchemy as sa

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("investment_holdings", sa.Column("current_balance", sa.Float, nullable=True))
    op.add_column("investment_holdings", sa.Column("total_deposits", sa.Float, nullable=True))
    op.add_column("investment_holdings", sa.Column("monthly_contribution", sa.Float, nullable=True))
    op.add_column("investment_holdings", sa.Column("annual_return_rate", sa.Float, nullable=True))


def downgrade() -> None:
    op.drop_column("investment_holdings", "annual_return_rate")
    op.drop_column("investment_holdings", "monthly_contribution")
    op.drop_column("investment_holdings", "total_deposits")
    op.drop_column("investment_holdings", "current_balance")

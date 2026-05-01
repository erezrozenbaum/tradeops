"""study fund fields on investment_holdings

Revision ID: 0013
Revises: 0012
Create Date: 2026-05-01
"""
from alembic import op
import sqlalchemy as sa

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("investment_holdings", sa.Column("monthly_contribution_employee", sa.Float, nullable=True))
    op.add_column("investment_holdings", sa.Column("monthly_contribution_employer", sa.Float, nullable=True))
    op.add_column("investment_holdings", sa.Column("fund_status", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("investment_holdings", "fund_status")
    op.drop_column("investment_holdings", "monthly_contribution_employer")
    op.drop_column("investment_holdings", "monthly_contribution_employee")

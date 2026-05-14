"""Add management fee fields to investment_holdings

Revision ID: 0026
Revises: 0025
Create Date: 2026-05-14
"""
from alembic import op
import sqlalchemy as sa

revision = "0026"
down_revision = "0025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("investment_holdings", sa.Column(
        "management_fee_balance_pct", sa.Float(), nullable=True,
        comment="Annual % fee charged on accumulated balance (דמי ניהול מהצבירה)"
    ))
    op.add_column("investment_holdings", sa.Column(
        "management_fee_contribution_pct", sa.Float(), nullable=True,
        comment="% fee deducted from each contribution before investing (דמי ניהול מהפקדות)"
    ))


def downgrade() -> None:
    op.drop_column("investment_holdings", "management_fee_contribution_pct")
    op.drop_column("investment_holdings", "management_fee_balance_pct")

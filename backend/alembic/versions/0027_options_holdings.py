"""Add options fields to investment_holdings

Revision ID: 0027
Revises: 0026
Create Date: 2026-05-14
"""
from alembic import op
import sqlalchemy as sa

revision = "0027"
down_revision = "0026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("investment_holdings", sa.Column("strike_price", sa.Float(), nullable=True))
    op.add_column("investment_holdings", sa.Column("expiry_date", sa.Date(), nullable=True))
    op.add_column("investment_holdings", sa.Column("option_type", sa.String(10), nullable=True))
    op.add_column("investment_holdings", sa.Column("underlying_ticker", sa.String(20), nullable=True))
    op.add_column("investment_holdings", sa.Column("contract_multiplier", sa.Float(), nullable=True))
    op.add_column("investment_holdings", sa.Column("position_type", sa.String(10), nullable=True))


def downgrade() -> None:
    op.drop_column("investment_holdings", "position_type")
    op.drop_column("investment_holdings", "contract_multiplier")
    op.drop_column("investment_holdings", "underlying_ticker")
    op.drop_column("investment_holdings", "option_type")
    op.drop_column("investment_holdings", "expiry_date")
    op.drop_column("investment_holdings", "strike_price")

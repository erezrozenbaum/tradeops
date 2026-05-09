"""Add is_emergency_fund flag to investment_holdings

Revision ID: 0022
Revises: 0021
Create Date: 2026-05-09
"""
from alembic import op
import sqlalchemy as sa

revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "investment_holdings",
        sa.Column(
            "is_emergency_fund",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("investment_holdings", "is_emergency_fund")

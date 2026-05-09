"""Add is_emergency_fund flag to investment_accounts

Revision ID: 0021
Revises: 0020
Create Date: 2026-05-09
"""

from alembic import op
import sqlalchemy as sa

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "investment_accounts",
        sa.Column(
            "is_emergency_fund",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("investment_accounts", "is_emergency_fund")

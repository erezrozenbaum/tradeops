"""Add linked_account_id FK to financial_goals

Revision ID: 0023
Revises: 0022
Create Date: 2026-05-13
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0023"
down_revision = "0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "financial_goals",
        sa.Column(
            "linked_account_id",
            UUID(as_uuid=True),
            sa.ForeignKey("investment_accounts.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("financial_goals", "linked_account_id")

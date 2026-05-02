"""family financial model: spouse_income + account family_member_id

Revision ID: 0018
Revises: 0017
Create Date: 2026-05-02
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "financial_profiles",
        sa.Column("spouse_income", sa.Float(), nullable=True),
    )
    op.add_column(
        "investment_accounts",
        sa.Column(
            "family_member_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_investment_accounts_family_member",
        "investment_accounts",
        "family_members",
        ["family_member_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_investment_accounts_family_member", "investment_accounts", type_="foreignkey")
    op.drop_column("investment_accounts", "family_member_id")
    op.drop_column("financial_profiles", "spouse_income")

"""family multiuser + projected balance

Revision ID: 0033
Revises: 0032
Create Date: 2026-05-15
"""
from alembic import op
import sqlalchemy as sa

revision = "0033"
down_revision = "0032"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── investment_holdings: balance_updated_at ───────────────────────────────
    op.add_column(
        "investment_holdings",
        sa.Column("balance_updated_at", sa.DateTime(timezone=True), nullable=True),
    )

    # ── investment_accounts: owner_type (personal | joint) ────────────────────
    op.add_column(
        "investment_accounts",
        sa.Column("owner_type", sa.String(20), nullable=False, server_default="personal"),
    )

    # ── family_members: invite fields ─────────────────────────────────────────
    op.add_column("family_members", sa.Column("invite_email", sa.String(255), nullable=True))
    op.add_column("family_members", sa.Column("invite_token", sa.String(64), nullable=True))
    op.add_column("family_members", sa.Column("invite_status", sa.String(20), nullable=False, server_default="not_invited"))
    op.add_column("family_members", sa.Column("invite_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_family_members_invite_token", "family_members", ["invite_token"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_family_members_invite_token", table_name="family_members")
    op.drop_column("family_members", "invite_expires_at")
    op.drop_column("family_members", "invite_status")
    op.drop_column("family_members", "invite_token")
    op.drop_column("family_members", "invite_email")
    op.drop_column("investment_accounts", "owner_type")
    op.drop_column("investment_holdings", "balance_updated_at")

"""advisor_share_tokens — read-only advisor share links

Revision ID: 0049
Revises: 0048
Create Date: 2026-05-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0049"
down_revision = "0048"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "advisor_share_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "investor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("investor_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token", sa.String(64), unique=True, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.create_index("ix_advisor_share_tokens_token", "advisor_share_tokens", ["token"], unique=True)
    op.create_index(
        "ix_advisor_share_tokens_investor_active",
        "advisor_share_tokens",
        ["investor_id", "revoked", "expires_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_advisor_share_tokens_investor_active", table_name="advisor_share_tokens")
    op.drop_index("ix_advisor_share_tokens_token", table_name="advisor_share_tokens")
    op.drop_table("advisor_share_tokens")

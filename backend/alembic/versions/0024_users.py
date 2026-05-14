"""Add users table and user_id FK on investor_profiles

Revision ID: 0024
Revises: 0023
Create Date: 2026-05-14
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0024"
down_revision = "0023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="user"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.add_column(
        "investor_profiles",
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_investor_profiles_user_id", "investor_profiles", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_investor_profiles_user_id", table_name="investor_profiles")
    op.drop_column("investor_profiles", "user_id")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

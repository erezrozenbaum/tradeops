"""household_link — households table + investor_profiles.household_id FK

Revision ID: 0048
Revises: 0047
Create Date: 2026-05-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0048"
down_revision = "0047"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "households",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.add_column(
        "investor_profiles",
        sa.Column(
            "household_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("households.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_investor_profiles_household_id", "investor_profiles", ["household_id"])


def downgrade() -> None:
    op.drop_index("ix_investor_profiles_household_id", table_name="investor_profiles")
    op.drop_column("investor_profiles", "household_id")
    op.drop_table("households")

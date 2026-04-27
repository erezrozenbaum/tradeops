"""currency rates cache table

Revision ID: 0008
Revises: 0007
Create Date: 2026-04-27
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "currency_rates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("base_currency", sa.String(10), nullable=False),
        sa.Column("target_currency", sa.String(10), nullable=False),
        sa.Column("rate", sa.Float(), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "ix_currency_rates_pair",
        "currency_rates",
        ["base_currency", "target_currency"],
    )


def downgrade() -> None:
    op.drop_index("ix_currency_rates_pair", table_name="currency_rates")
    op.drop_table("currency_rates")

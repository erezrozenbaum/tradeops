"""price snapshots cache table

Revision ID: 0009
Revises: 0008
Create Date: 2026-04-27
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "price_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("ticker", sa.String(20), nullable=False),
        sa.Column("price", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(10), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_price_snapshots_ticker", "price_snapshots", ["ticker"])


def downgrade() -> None:
    op.drop_index("ix_price_snapshots_ticker", table_name="price_snapshots")
    op.drop_table("price_snapshots")

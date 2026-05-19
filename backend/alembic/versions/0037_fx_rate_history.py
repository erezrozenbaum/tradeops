"""FX rate history table for historical currency rate lookup

Revision ID: 0037
Revises: 0036
Create Date: 2026-05-19
"""
import uuid
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision = "0037"
down_revision = "0036"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "fx_rate_history",
        sa.Column("id", PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("from_currency", sa.String(10), nullable=False),
        sa.Column("to_currency", sa.String(10), nullable=False),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("rate", sa.Float, nullable=False),
        sa.Column("source", sa.String(50), nullable=False, server_default="yfinance"),
    )
    op.create_index("ix_fx_rate_history_from", "fx_rate_history", ["from_currency"])
    op.create_index("ix_fx_rate_history_to", "fx_rate_history", ["to_currency"])
    op.create_index("ix_fx_rate_history_date", "fx_rate_history", ["date"])
    op.create_unique_constraint(
        "uq_fx_rate_history_pair_date",
        "fx_rate_history",
        ["from_currency", "to_currency", "date"],
    )


def downgrade() -> None:
    op.drop_table("fx_rate_history")

"""Add auto-sync fields to investment_accounts

Revision ID: 0025
Revises: 0024
Create Date: 2026-05-13
"""
from alembic import op
import sqlalchemy as sa

revision = "0025"
down_revision = "0023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("investment_accounts", sa.Column("auto_sync_enabled", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("investment_accounts", sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("investment_accounts", sa.Column("sync_broker_type", sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column("investment_accounts", "sync_broker_type")
    op.drop_column("investment_accounts", "last_synced_at")
    op.drop_column("investment_accounts", "auto_sync_enabled")

"""holdings tables: investment_accounts and investment_holdings

Revision ID: 0007
Revises: 0006
Create Date: 2026-04-27
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "investment_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "investor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("investor_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("provider_name", sa.String(100), nullable=False),
        sa.Column("account_type", sa.String(50), nullable=False),
        sa.Column("account_name", sa.String(200), nullable=True),
        sa.Column("currency", sa.String(3), nullable=False, server_default="ILS"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_investment_accounts_investor_id", "investment_accounts", ["investor_id"])

    op.create_table(
        "investment_holdings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("investment_accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("ticker", sa.String(20), nullable=True),
        sa.Column("isin", sa.String(20), nullable=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("asset_type", sa.String(50), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("avg_buy_price", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("fees", sa.Float(), nullable=False, server_default="0"),
        sa.Column("purchase_date", sa.Date(), nullable=True),
        sa.Column("current_value", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_investment_holdings_account_id", "investment_holdings", ["account_id"])


def downgrade() -> None:
    op.drop_index("ix_investment_holdings_account_id", table_name="investment_holdings")
    op.drop_table("investment_holdings")
    op.drop_index("ix_investment_accounts_investor_id", table_name="investment_accounts")
    op.drop_table("investment_accounts")

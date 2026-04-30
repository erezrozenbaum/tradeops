"""portfolio_snapshots history table

Revision ID: 0010
Revises: 0009
Create Date: 2026-04-30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "portfolio_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("investor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("total_value", sa.Float(), nullable=False),
        sa.Column("cost_basis", sa.Float(), nullable=False),
        sa.Column("unrealized_pnl", sa.Float(), nullable=False),
        sa.Column("unrealized_pnl_pct", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(10), nullable=False),
        sa.Column(
            "asset_allocation",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "snapshot_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_portfolio_snapshots_investor_id", "portfolio_snapshots", ["investor_id"]
    )
    op.create_index(
        "ix_portfolio_snapshots_snapshot_at", "portfolio_snapshots", ["snapshot_at"]
    )
    op.create_foreign_key(
        "fk_portfolio_snapshots_investor_id",
        "portfolio_snapshots",
        "investor_profiles",
        ["investor_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_portfolio_snapshots_investor_id", "portfolio_snapshots", type_="foreignkey"
    )
    op.drop_index(
        "ix_portfolio_snapshots_snapshot_at", table_name="portfolio_snapshots"
    )
    op.drop_index(
        "ix_portfolio_snapshots_investor_id", table_name="portfolio_snapshots"
    )
    op.drop_table("portfolio_snapshots")

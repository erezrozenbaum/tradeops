"""staged_orders table

Revision ID: 0050
Revises: 0049
Create Date: 2026-05-27
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "0050"
down_revision = "0049"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "staged_orders",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "investor_id",
            UUID(as_uuid=True),
            sa.ForeignKey("investor_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("ticker", sa.String(20), nullable=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("action", sa.String(10), nullable=False),          # buy | sell
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("unit_price", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("estimated_value", sa.Float(), nullable=False),
        sa.Column("asset_type", sa.String(50), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),  # pending | executed | cancelled
        sa.Column(
            "goal_id",
            UUID(as_uuid=True),
            sa.ForeignKey("financial_goals.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("goal_name", sa.String(255), nullable=True),
        sa.Column("tax_note", sa.Text(), nullable=True),
        sa.Column("pre_flight_review", JSONB(), nullable=True),
        sa.Column("projected_metrics", JSONB(), nullable=True),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("actual_outcome", JSONB(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_staged_orders_investor_id", "staged_orders", ["investor_id"])
    op.create_index("ix_staged_orders_status", "staged_orders", ["status"])


def downgrade() -> None:
    op.drop_index("ix_staged_orders_status", table_name="staged_orders")
    op.drop_index("ix_staged_orders_investor_id", table_name="staged_orders")
    op.drop_table("staged_orders")

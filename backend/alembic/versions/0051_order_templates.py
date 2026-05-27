"""order_templates table

Revision ID: 0051
Revises: 0050
Create Date: 2026-05-27
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "0051"
down_revision = "0050"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "order_templates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "investor_id",
            UUID(as_uuid=True),
            sa.ForeignKey("investor_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("orders", JSONB(), nullable=False),  # list of StagedOrderCreate dicts
        sa.Column("times_applied", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_applied_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_order_templates_investor_id", "order_templates", ["investor_id"])
    # Add outcome_snapshots column to staged_orders for 30/90/180d tracking
    op.add_column(
        "staged_orders",
        sa.Column("outcome_snapshots", JSONB(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("staged_orders", "outcome_snapshots")
    op.drop_index("ix_order_templates_investor_id", table_name="order_templates")
    op.drop_table("order_templates")

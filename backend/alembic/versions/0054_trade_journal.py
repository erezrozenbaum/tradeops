"""add rationale and reflection to staged_orders for trade journal"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0054"
down_revision = "0053"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("staged_orders", sa.Column("rationale", sa.Text(), nullable=True))
    op.add_column("staged_orders", sa.Column("reflection", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("staged_orders", "reflection")
    op.drop_column("staged_orders", "rationale")

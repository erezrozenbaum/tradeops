"""add thesis_params JSONB to staged_orders for thesis expiry monitoring"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0055"
down_revision = "0054"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("staged_orders", sa.Column("thesis_params", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("staged_orders", "thesis_params")

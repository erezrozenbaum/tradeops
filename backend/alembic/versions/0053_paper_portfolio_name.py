"""Add name column to paper_portfolios

Revision ID: 0053
Revises: 0052
Create Date: 2026-05-28
"""

from alembic import op
import sqlalchemy as sa

revision = "0053"
down_revision = "0052"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("paper_portfolios", sa.Column("name", sa.String(200), nullable=True))


def downgrade():
    op.drop_column("paper_portfolios", "name")

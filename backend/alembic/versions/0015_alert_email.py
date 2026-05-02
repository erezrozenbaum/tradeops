"""alert email settings on investor_profiles

Revision ID: 0015
Revises: 0014
Create Date: 2026-05-01
"""
import sqlalchemy as sa
from alembic import op

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("investor_profiles", sa.Column("alert_email", sa.String(255), nullable=True))
    op.add_column(
        "investor_profiles",
        sa.Column("email_alerts_enabled", sa.Boolean, nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("investor_profiles", "email_alerts_enabled")
    op.drop_column("investor_profiles", "alert_email")

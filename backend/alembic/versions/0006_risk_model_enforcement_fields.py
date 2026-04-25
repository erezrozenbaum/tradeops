"""risk model enforcement fields

Revision ID: 0006
Revises: 0005
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "risk_models",
        sa.Column(
            "allowed_strategy_families",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),
    )
    op.add_column(
        "risk_models",
        sa.Column(
            "blocked_strategy_families",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="[]",
        ),
    )
    op.add_column(
        "risk_models",
        sa.Column("live_trading_allowed", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "risk_models",
        sa.Column("requires_paper_trading", sa.Boolean(), nullable=False, server_default="true"),
    )
    op.add_column(
        "risk_models",
        sa.Column("max_trade_size_pct", sa.Float(), nullable=False, server_default="2.0"),
    )
    op.add_column(
        "risk_models",
        sa.Column("max_open_positions", sa.Integer(), nullable=False, server_default="3"),
    )
    op.add_column(
        "risk_models",
        sa.Column("age_tier", sa.String(20), nullable=False, server_default="adult"),
    )


def downgrade() -> None:
    op.drop_column("risk_models", "age_tier")
    op.drop_column("risk_models", "max_open_positions")
    op.drop_column("risk_models", "max_trade_size_pct")
    op.drop_column("risk_models", "requires_paper_trading")
    op.drop_column("risk_models", "live_trading_allowed")
    op.drop_column("risk_models", "blocked_strategy_families")
    op.drop_column("risk_models", "allowed_strategy_families")

"""behavioral_risk_events table

Revision ID: 0044
Revises: 0043
Create Date: 2026-05-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0044"
down_revision = "0043"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "behavioral_risk_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "investor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("investor_profiles.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # panic_selling | performance_chasing | revenge_trading | overtrading_spike |
        # concentration_addiction | risk_creep | strategy_abandonment
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False),   # low | medium | high | critical
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),  # active | resolved | acknowledged
        sa.Column(
            "detected_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("evidence", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("recommendation", sa.Text, nullable=False),
        sa.Column(
            "decision_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("recommendation_decisions.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_behavioral_risk_events_investor_id", "behavioral_risk_events", ["investor_id"])
    op.create_index("ix_behavioral_risk_events_detected_at", "behavioral_risk_events", ["detected_at"])
    op.create_index(
        "ix_behavioral_risk_events_investor_status",
        "behavioral_risk_events",
        ["investor_id", "status"],
    )


def downgrade() -> None:
    op.drop_index("ix_behavioral_risk_events_investor_status", table_name="behavioral_risk_events")
    op.drop_index("ix_behavioral_risk_events_detected_at", table_name="behavioral_risk_events")
    op.drop_index("ix_behavioral_risk_events_investor_id", table_name="behavioral_risk_events")
    op.drop_table("behavioral_risk_events")

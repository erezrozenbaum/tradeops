"""Audit event index + pct field CHECK constraints

Revision ID: 0036
Revises: 0035
Create Date: 2026-05-18
"""
from alembic import op

revision = "0036"
down_revision = "0035"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Index for audit log queries by investor
    op.create_index(
        "ix_audit_events_investor_profile_id",
        "audit_events",
        ["investor_profile_id"],
    )

    # Range constraints: investable_capital_pct must be 0–100
    op.create_check_constraint(
        "ck_fp_investable_capital_pct",
        "financial_profiles",
        "investable_capital_pct >= 0 AND investable_capital_pct <= 100",
    )

    # Range constraints: max_trade_size_pct must be 0–100
    op.create_check_constraint(
        "ck_rm_max_trade_size_pct",
        "risk_models",
        "max_trade_size_pct >= 0 AND max_trade_size_pct <= 100",
    )


def downgrade() -> None:
    op.drop_constraint("ck_rm_max_trade_size_pct", "risk_models", type_="check")
    op.drop_constraint("ck_fp_investable_capital_pct", "financial_profiles", type_="check")
    op.drop_index("ix_audit_events_investor_profile_id", table_name="audit_events")

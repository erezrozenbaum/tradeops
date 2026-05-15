"""DB CHECK constraints on enum-like VARCHAR columns

Revision ID: 0034
Revises: 0033
Create Date: 2026-05-15

Adds CHECK constraints to columns that store a bounded set of values
but were previously unconstrained at the DB level. Pydantic validates at
the API boundary; these constraints protect against direct SQL inserts
(migrations, admin tools, future scripts).

All constraints are named so they can be dropped individually in downgrade.
"""
from alembic import op

revision = "0034"
down_revision = "0033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_check_constraint(
        "ck_investment_accounts_owner_type",
        "investment_accounts",
        "owner_type IN ('personal', 'joint')",
    )
    op.create_check_constraint(
        "ck_family_members_invite_status",
        "family_members",
        "invite_status IN ('not_invited', 'pending', 'accepted', 'expired')",
    )
    op.create_check_constraint(
        "ck_investment_holdings_fund_status",
        "investment_holdings",
        "fund_status IS NULL OR fund_status IN ('active', 'inactive')",
    )
    op.create_check_constraint(
        "ck_investment_holdings_option_type",
        "investment_holdings",
        "option_type IS NULL OR option_type IN ('call', 'put')",
    )
    op.create_check_constraint(
        "ck_investment_holdings_position_type",
        "investment_holdings",
        "position_type IS NULL OR position_type IN ('long', 'short')",
    )
    op.create_check_constraint(
        "ck_price_alerts_alert_type",
        "price_alerts",
        "alert_type IN ('above', 'below')",
    )
    op.create_check_constraint(
        "ck_market_signals_guard_status",
        "market_signals",
        "guard_status IN ('APPROVED', 'MUTED')",
    )
    op.create_check_constraint(
        "ck_holding_transactions_type",
        "holding_transactions",
        "transaction_type IN ('buy', 'sell', 'dividend', 'fee', 'split', 'bonus')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_holding_transactions_type", "holding_transactions", type_="check")
    op.drop_constraint("ck_market_signals_guard_status", "market_signals", type_="check")
    op.drop_constraint("ck_price_alerts_alert_type", "price_alerts", type_="check")
    op.drop_constraint("ck_investment_holdings_position_type", "investment_holdings", type_="check")
    op.drop_constraint("ck_investment_holdings_option_type", "investment_holdings", type_="check")
    op.drop_constraint("ck_investment_holdings_fund_status", "investment_holdings", type_="check")
    op.drop_constraint("ck_family_members_invite_status", "family_members", type_="check")
    op.drop_constraint("ck_investment_accounts_owner_type", "investment_accounts", type_="check")

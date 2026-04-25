"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "investor_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("date_of_birth", sa.Date, nullable=False),
        sa.Column("country", sa.String(3), nullable=False),
        sa.Column("nationality", sa.String(3), nullable=True),
        sa.Column("tax_residency", sa.String(3), nullable=True),
        sa.Column("base_currency", sa.String(3), nullable=False),
        sa.Column("local_currency", sa.String(3), nullable=False),
        sa.Column(
            "experience_level",
            sa.Enum("beginner", "intermediate", "advanced", name="experiencelevel"),
            nullable=False,
            server_default="beginner",
        ),
        sa.Column("is_minor", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "family_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "primary_investor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("investor_profiles.id"),
            nullable=False,
        ),
        sa.Column("base_currency", sa.String(3), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "family_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "family_profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("family_profiles.id"),
            nullable=False,
        ),
        sa.Column(
            "investor_profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("investor_profiles.id"),
            nullable=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("relationship_type", sa.String(50), nullable=False),
        sa.Column("age", sa.Integer, nullable=True),
        sa.Column("is_primary", sa.Boolean, server_default="false"),
        sa.Column(
            "individual_risk_tolerance",
            sa.Enum("conservative", "moderate", "aggressive", name="risktolerance"),
            nullable=True,
        ),
    )

    op.create_table(
        "financial_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "investor_profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("investor_profiles.id"),
            nullable=False,
            unique=True,
        ),
        sa.Column("monthly_income", sa.Float, nullable=False, server_default="0"),
        sa.Column("monthly_expenses", sa.Float, nullable=False, server_default="0"),
        sa.Column("liquid_savings", sa.Float, nullable=False, server_default="0"),
        sa.Column("emergency_fund_months", sa.Float, nullable=False, server_default="0"),
        sa.Column(
            "job_stability",
            sa.Enum("stable", "freelance", "unstable", "unemployed", name="jobstability"),
            nullable=False,
            server_default="stable",
        ),
        sa.Column(
            "income_trend",
            sa.Enum("growing", "stable", "declining", name="incometrend"),
            nullable=False,
            server_default="stable",
        ),
        sa.Column("dependents_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("investable_capital_pct", sa.Float, nullable=False, server_default="20"),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "financial_assets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "financial_profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("financial_profiles.id"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "asset_type",
            sa.Enum("cash", "stocks", "bonds", "etf", "real_estate", "crypto", "pension", "other", name="assettype"),
            nullable=False,
        ),
        sa.Column("current_value", sa.Float, nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("market", sa.String(50), nullable=True),
        sa.Column("is_liquid", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "financial_liabilities",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "financial_profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("financial_profiles.id"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "liability_type",
            sa.Enum("mortgage", "car_loan", "personal_loan", "credit_card", "student_loan", "other", name="liabilitytype"),
            nullable=False,
        ),
        sa.Column("outstanding_balance", sa.Float, nullable=False),
        sa.Column("monthly_payment", sa.Float, nullable=False, server_default="0"),
        sa.Column("interest_rate_pct", sa.Float, nullable=True),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "financial_goals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "investor_profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("investor_profiles.id"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "goal_type",
            sa.Enum(
                "emergency_fund", "house_purchase", "retirement", "child_education",
                "debt_reduction", "wealth_growth", "passive_income", "custom",
                name="goaltype",
            ),
            nullable=False,
        ),
        sa.Column("target_amount", sa.Float, nullable=False),
        sa.Column("current_amount", sa.Float, nullable=False, server_default="0"),
        sa.Column("target_date", sa.Date, nullable=True),
        sa.Column("priority", sa.Integer, nullable=False, server_default="1"),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column(
            "risk_suitability",
            sa.Enum("low", "medium", "high", name="goalrisksuitability"),
            nullable=False,
            server_default="low",
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "risk_models",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "investor_profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("investor_profiles.id"),
            nullable=False,
        ),
        sa.Column("stability_score", sa.Integer, nullable=False),
        sa.Column("stability_classification", sa.String(20), nullable=False),
        sa.Column("total_net_worth", sa.Float, nullable=False),
        sa.Column("liquid_capital", sa.Float, nullable=False),
        sa.Column("investable_capital", sa.Float, nullable=False),
        sa.Column("low_risk_pct", sa.Float, nullable=False, server_default="0"),
        sa.Column("growth_pct", sa.Float, nullable=False, server_default="0"),
        sa.Column("high_risk_pct", sa.Float, nullable=False, server_default="0"),
        sa.Column("max_drawdown_pct", sa.Float, nullable=False, server_default="10"),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "audit_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "investor_profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("investor_profiles.id"),
            nullable=True,
        ),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("event_metadata", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Indexes
    op.create_index("ix_audit_events_investor_id", "audit_events", ["investor_profile_id"])
    op.create_index("ix_audit_events_event_type", "audit_events", ["event_type"])
    op.create_index("ix_risk_models_investor_id", "risk_models", ["investor_profile_id"])
    op.create_index("ix_financial_goals_investor_id", "financial_goals", ["investor_profile_id"])


def downgrade() -> None:
    op.drop_table("audit_events")
    op.drop_table("risk_models")
    op.drop_table("financial_goals")
    op.drop_table("financial_liabilities")
    op.drop_table("financial_assets")
    op.drop_table("financial_profiles")
    op.drop_table("family_members")
    op.drop_table("family_profiles")
    op.drop_table("investor_profiles")

    for enum_name in [
        "experiencelevel", "risktolerance", "jobstability", "incometrend",
        "assettype", "liabilitytype", "goaltype", "goalrisksuitability",
    ]:
        op.execute(f"DROP TYPE IF EXISTS {enum_name}")

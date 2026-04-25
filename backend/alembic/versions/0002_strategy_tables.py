"""strategy tables

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-25
"""
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "strategy_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column(
            "strategy_type",
            sa.Enum(
                "foundation_building", "conservative", "balanced",
                "growth", "speculative", "education_only",
                name="strategytype",
            ),
            nullable=False,
        ),
        sa.Column("asset_classes", postgresql.ARRAY(sa.Text), nullable=False, server_default="{}"),
        sa.Column("markets", postgresql.ARRAY(sa.Text), nullable=False, server_default="{}"),
        sa.Column("min_stability_score", sa.Integer, nullable=False, server_default="0"),
        sa.Column("allowed_risk_modifiers", postgresql.ARRAY(sa.Text), nullable=False),
        sa.Column("min_experience_level", sa.String(20), nullable=False, server_default="beginner"),
        sa.Column("suitable_for_minors", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("min_investable_capital", sa.Float, nullable=False, server_default="0"),
        sa.Column("time_horizon_min_months", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "strategy_recommendations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "investor_profile_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("investor_profiles.id"),
            nullable=False,
        ),
        sa.Column(
            "risk_model_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("risk_models.id"),
            nullable=False,
        ),
        sa.Column(
            "strategy_template_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("strategy_templates.id"),
            nullable=False,
        ),
        sa.Column("fit_score", sa.Float, nullable=False),
        sa.Column("notes", sa.Text, nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_index(
        "ix_strategy_recommendations_investor_id",
        "strategy_recommendations",
        ["investor_profile_id"],
    )
    op.create_index(
        "ix_strategy_recommendations_risk_model_id",
        "strategy_recommendations",
        ["risk_model_id"],
    )

    # Seed strategy templates
    _seed_templates()


def _seed_templates() -> None:
    templates = sa.table(
        "strategy_templates",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("name", sa.String),
        sa.column("description", sa.Text),
        sa.column("strategy_type", sa.String),
        sa.column("asset_classes", postgresql.ARRAY(sa.Text)),
        sa.column("markets", postgresql.ARRAY(sa.Text)),
        sa.column("min_stability_score", sa.Integer),
        sa.column("allowed_risk_modifiers", postgresql.ARRAY(sa.Text)),
        sa.column("min_experience_level", sa.String),
        sa.column("suitable_for_minors", sa.Boolean),
        sa.column("min_investable_capital", sa.Float),
        sa.column("time_horizon_min_months", sa.Integer),
        sa.column("is_active", sa.Boolean),
    )

    op.bulk_insert(templates, [
        {
            "id": uuid.UUID("00000000-0000-0000-0000-000000000001"),
            "name": "Financial Education Mode",
            "description": (
                "Learn about investing through paper trading and financial literacy content. "
                "No real capital is deployed. Suitable for minors and anyone starting their financial journey."
            ),
            "strategy_type": "education_only",
            "asset_classes": ["etf", "bonds", "stocks"],
            "markets": ["global"],
            "min_stability_score": 0,
            "allowed_risk_modifiers": ["reduce", "neutral", "allow_growth"],
            "min_experience_level": "beginner",
            "suitable_for_minors": True,
            "min_investable_capital": 0.0,
            "time_horizon_min_months": 0,
            "is_active": True,
        },
        {
            "id": uuid.UUID("00000000-0000-0000-0000-000000000002"),
            "name": "Build Financial Foundation",
            "description": (
                "Your financial situation requires stability before investing. "
                "Focus on building an emergency fund, reducing high-interest debt, "
                "and stabilizing your income. This is not a failure — it is the right first step."
            ),
            "strategy_type": "foundation_building",
            "asset_classes": [],
            "markets": [],
            "min_stability_score": 0,
            "allowed_risk_modifiers": ["reduce"],
            "min_experience_level": "beginner",
            "suitable_for_minors": False,
            "min_investable_capital": 0.0,
            "time_horizon_min_months": 0,
            "is_active": True,
        },
        {
            "id": uuid.UUID("00000000-0000-0000-0000-000000000003"),
            "name": "Capital Preservation",
            "description": (
                "Low-volatility allocation in government bonds and broad market ETFs. "
                "Designed to protect capital and generate modest returns while maintaining "
                "high liquidity. Suitable for investors rebuilding financial stability."
            ),
            "strategy_type": "conservative",
            "asset_classes": ["bonds", "etf"],
            "markets": ["local", "global"],
            "min_stability_score": 25,
            "allowed_risk_modifiers": ["reduce", "neutral", "allow_growth"],
            "min_experience_level": "beginner",
            "suitable_for_minors": False,
            "min_investable_capital": 1000.0,
            "time_horizon_min_months": 12,
            "is_active": True,
        },
        {
            "id": uuid.UUID("00000000-0000-0000-0000-000000000004"),
            "name": "Balanced Portfolio",
            "description": (
                "Diversified mix of bonds, broad-market ETFs, and dividend-paying equities "
                "targeting steady long-term growth with managed volatility. "
                "Balanced between capital preservation and growth."
            ),
            "strategy_type": "balanced",
            "asset_classes": ["bonds", "etf", "stocks"],
            "markets": ["local", "global"],
            "min_stability_score": 45,
            "allowed_risk_modifiers": ["neutral", "allow_growth"],
            "min_experience_level": "beginner",
            "suitable_for_minors": False,
            "min_investable_capital": 5000.0,
            "time_horizon_min_months": 24,
            "is_active": True,
        },
        {
            "id": uuid.UUID("00000000-0000-0000-0000-000000000005"),
            "name": "Growth ETF Strategy",
            "description": (
                "Focus on global equity ETFs and sector-specific growth funds "
                "targeting above-average long-term returns. Requires tolerance for "
                "higher volatility and a medium-to-long investment horizon."
            ),
            "strategy_type": "growth",
            "asset_classes": ["etf", "stocks"],
            "markets": ["global"],
            "min_stability_score": 56,
            "allowed_risk_modifiers": ["neutral", "allow_growth"],
            "min_experience_level": "intermediate",
            "suitable_for_minors": False,
            "min_investable_capital": 10000.0,
            "time_horizon_min_months": 36,
            "is_active": True,
        },
        {
            "id": uuid.UUID("00000000-0000-0000-0000-000000000006"),
            "name": "Aggressive Growth",
            "description": (
                "High-conviction strategy combining individual equities, global sector bets, "
                "and select emerging market positions. Suitable only for investors with strong "
                "financial profiles, advanced knowledge, and long time horizons."
            ),
            "strategy_type": "speculative",
            "asset_classes": ["stocks", "etf"],
            "markets": ["global"],
            "min_stability_score": 70,
            "allowed_risk_modifiers": ["allow_growth"],
            "min_experience_level": "advanced",
            "suitable_for_minors": False,
            "min_investable_capital": 25000.0,
            "time_horizon_min_months": 48,
            "is_active": True,
        },
    ])


def downgrade() -> None:
    op.drop_index("ix_strategy_recommendations_risk_model_id", "strategy_recommendations")
    op.drop_index("ix_strategy_recommendations_investor_id", "strategy_recommendations")
    op.drop_table("strategy_recommendations")
    op.drop_table("strategy_templates")
    op.execute("DROP TYPE IF EXISTS strategytype")

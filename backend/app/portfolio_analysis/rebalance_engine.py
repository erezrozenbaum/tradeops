"""Pure portfolio rebalancing engine — no DB access.

Maps portfolio asset types to risk tiers and compares against the investor's
risk model target allocation.
"""
from datetime import datetime, timezone
import uuid

from app.portfolio_analysis.rebalance_schemas import RebalanceTier, RebalanceResult

_ASSET_TO_TIER: dict[str, str | None] = {
    "bond": "low_risk",
    "fund": "low_risk",
    "pension_fund": "low_risk",
    "etf": "growth",
    "stock": "growth",
    "real_estate": "growth",
    "crypto": "high_risk",
    "other": None,  # excluded from rebalancing
}

_TIER_META = [
    ("low_risk", "Low Risk", ["bond", "fund", "pension_fund"]),
    ("growth", "Growth", ["etf", "stock", "real_estate"]),
    ("high_risk", "High Risk", ["crypto"]),
]

_THRESHOLD_PCT = 5.0  # deviation threshold that triggers a rebalance suggestion


def compute_rebalance(
    investor_id: uuid.UUID,
    risk_model,               # RiskModel ORM object or None
    asset_allocation: dict[str, float],  # e.g. {"etf": 45.0, "crypto": 25.0}
    total_value: float | None = None,    # total portfolio value in base currency
    currency: str | None = None,
) -> RebalanceResult:
    notes: list[str] = []

    if not risk_model:
        notes.append("No risk model found. Generate a risk model to see rebalancing guidance.")
        return RebalanceResult(
            investor_id=investor_id,
            rebalance_needed=False,
            tiers=[],
            notes=notes,
            computed_at=datetime.now(timezone.utc),
        )

    if not asset_allocation:
        notes.append("No portfolio holdings found. Add holdings to see rebalancing guidance.")
        return RebalanceResult(
            investor_id=investor_id,
            rebalance_needed=False,
            tiers=[],
            notes=notes,
            computed_at=datetime.now(timezone.utc),
        )

    # Aggregate asset_allocation into risk tiers
    tier_actual: dict[str, float] = {"low_risk": 0.0, "growth": 0.0, "high_risk": 0.0}
    other_pct = 0.0
    for asset_type, pct in asset_allocation.items():
        tier = _ASSET_TO_TIER.get(asset_type)
        if tier is not None:
            tier_actual[tier] += pct
        else:
            other_pct += pct

    if other_pct > 0.5:
        notes.append(
            f"{other_pct:.1f}% of your portfolio is in unclassified assets (other) "
            "and is excluded from rebalancing analysis."
        )

    target: dict[str, float] = {
        "low_risk": risk_model.low_risk_pct,
        "growth": risk_model.growth_pct,
        "high_risk": risk_model.high_risk_pct,
    }

    rebalance_needed = False
    tiers: list[RebalanceTier] = []

    for tier_key, tier_label, asset_types in _TIER_META:
        actual = round(tier_actual[tier_key], 1)
        tgt = round(target[tier_key], 1)
        delta = round(actual - tgt, 1)

        if abs(delta) >= _THRESHOLD_PCT:
            rebalance_needed = True
            action = "reduce" if delta > 0 else "buy_more"
        else:
            action = "hold"

        target_amount = round(total_value * tgt / 100, 2) if total_value else None
        actual_amount = round(total_value * actual / 100, 2) if total_value else None
        gap_amount = (
            round(actual_amount - target_amount, 2)
            if target_amount is not None and actual_amount is not None
            else None
        )

        tiers.append(RebalanceTier(
            tier=tier_key,
            label=tier_label,
            target_pct=tgt,
            actual_pct=actual,
            delta_pct=delta,
            action=action,
            asset_types=asset_types,
            target_amount=target_amount,
            actual_amount=actual_amount,
            gap_amount=gap_amount,
        ))

    if rebalance_needed:
        notes.append(
            "One or more tiers deviate from your risk model targets by more than 5%. "
            "Consider rebalancing to align with your target allocation."
        )
    else:
        notes.append("Portfolio allocation is within 5% of your risk model targets.")

    return RebalanceResult(
        investor_id=investor_id,
        rebalance_needed=rebalance_needed,
        tiers=tiers,
        notes=notes,
        computed_at=datetime.now(timezone.utc),
        total_portfolio_value=round(total_value, 2) if total_value else None,
        currency=currency,
    )

"""Pure portfolio rebalancing engine — no DB access.

Maps portfolio asset types to risk tiers and compares against the investor's
risk model target allocation.
"""
from datetime import datetime, timezone
from typing import TypedDict
import uuid

from app.portfolio_analysis.rebalance_schemas import RebalanceTier, RebalanceResult, SuggestedTrade


class HoldingInfo(TypedDict):
    ticker: str | None
    name: str
    asset_type: str
    current_value_base: float  # value in base currency
    unit_price_base: float | None  # live price converted to base currency (None if no live price)

_ASSET_TO_TIER: dict[str, str | None] = {
    "bond": "low_risk",
    "fund": "low_risk",
    "pension_fund": None,   # locked — excluded from rebalancing
    "study_fund": None,     # locked — excluded from rebalancing
    "etf": "growth",
    "stock": "growth",
    "real_estate": "growth",
    "crypto": "high_risk",
    "other": None,          # excluded from rebalancing
}

_TIER_META = [
    ("low_risk", "Low Risk", ["bond", "fund"]),
    ("growth", "Growth", ["etf", "stock", "real_estate"]),
    ("high_risk", "High Risk", ["crypto"]),
]

# Reverse mapping: tier → list of asset types (used for suggested trades)
_ASSET_TO_TIER_REVERSE: dict[str, list[str]] = {
    "low_risk": ["bond", "fund"],
    "growth": ["etf", "stock", "real_estate"],
    "high_risk": ["crypto"],
}

_THRESHOLD_PCT = 5.0  # deviation threshold that triggers a rebalance suggestion


def _suggested_trades(
    tier_key: str,
    action: str,
    gap_amount: float | None,
    holdings: list[HoldingInfo],
    base_currency: str,
) -> list[SuggestedTrade]:
    """Compute buy/sell suggestions for the largest tickered holding in a tier."""
    if action == "hold" or not gap_amount or abs(gap_amount) < 1:
        return []

    tier_asset_types = set(_ASSET_TO_TIER_REVERSE.get(tier_key, []))
    candidates = [
        h for h in holdings
        if h["ticker"]
        and h["asset_type"] in tier_asset_types
        and h["unit_price_base"] and h["unit_price_base"] > 0
    ]
    if not candidates:
        return []

    # Sort by current value descending — suggest adding to / trimming the largest position first
    candidates.sort(key=lambda h: h["current_value_base"], reverse=True)
    top = candidates[0]

    direction = "buy" if action == "buy_more" else "sell"
    units = abs(gap_amount) / top["unit_price_base"]
    units = round(units, 4)
    estimated = round(units * top["unit_price_base"], 2)

    return [SuggestedTrade(
        ticker=top["ticker"],
        name=top["name"],
        action=direction,
        suggested_units=units,
        unit_price=round(top["unit_price_base"], 4),
        estimated_value=estimated,
        currency=base_currency,
    )]


def compute_rebalance(
    investor_id: uuid.UUID,
    risk_model,               # RiskModel ORM object or None
    asset_allocation: dict[str, float],  # e.g. {"etf": 45.0, "crypto": 25.0}
    total_value: float | None = None,    # total portfolio value in base currency
    currency: str | None = None,
    holdings: "list[HoldingInfo] | None" = None,
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
    locked_pct = 0.0   # pension_fund, study_fund, other — cannot be rebalanced
    for asset_type, pct in asset_allocation.items():
        tier = _ASSET_TO_TIER.get(asset_type)
        if tier is not None:
            tier_actual[tier] += pct
        else:
            locked_pct += pct

    # Normalize percentages to the tradeable portion only.
    # Pension/study funds are locked and must not distort the gap calculations.
    tradeable_pct = 100.0 - locked_pct
    if tradeable_pct < 0.5:
        notes.append(
            "Your entire portfolio consists of locked assets (pension funds, study funds) "
            "that cannot be rebalanced. Add tradeable holdings to see rebalancing guidance."
        )
        return RebalanceResult(
            investor_id=investor_id,
            rebalance_needed=False,
            tiers=[],
            notes=notes,
            computed_at=datetime.now(timezone.utc),
        )

    if locked_pct > 0.5:
        locked_value_approx = round((total_value or 0) * locked_pct / 100, 0) if total_value else None
        notes.append(
            f"{locked_pct:.0f}% of your portfolio is in pension/study funds "
            f"(≈{locked_value_approx:,.0f} {currency or 'ILS'}) which are locked "
            f"and excluded from rebalancing. Analysis is based on the {tradeable_pct:.0f}% "
            "that is tradeable."
        )
        # Re-normalize tier percentages to tradeable basis
        for t in tier_actual:
            tier_actual[t] = round(tier_actual[t] / tradeable_pct * 100, 1)

    tradeable_value = round(total_value * tradeable_pct / 100, 2) if total_value else None

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

        target_amount = round(tradeable_value * tgt / 100, 2) if tradeable_value else None
        actual_amount = round(tradeable_value * actual / 100, 2) if tradeable_value else None
        gap_amount = (
            round(actual_amount - target_amount, 2)
            if target_amount is not None and actual_amount is not None
            else None
        )

        trades = _suggested_trades(
            tier_key=tier_key,
            action=action,
            gap_amount=gap_amount,
            holdings=holdings or [],
            base_currency=currency or "ILS",
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
            suggested_trades=trades,
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
        total_portfolio_value=round(tradeable_value, 2) if tradeable_value else None,
        currency=currency,
    )

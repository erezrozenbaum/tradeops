import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.portfolio_snapshot import PortfolioSnapshot
from app.risk_modeling.service import get_latest as get_latest_risk_model
from app.strategy_drift.schemas import DriftItem, StrategyDriftReport

# Reuse the same asset→tier mapping as the rebalance engine
_ASSET_TO_TIER: dict[str, str | None] = {
    "bond": "low_risk",
    "fund": "low_risk",
    "pension_fund": None,
    "study_fund": None,
    "etf": "growth",
    "stock": "growth",
    "real_estate": "growth",
    "crypto": "high_risk",
    "call_option": "high_risk",
    "put_option": "high_risk",
    "other": None,
}

_TIER_LABELS = {
    "low_risk": "Low Risk (Bonds / Funds)",
    "growth": "Growth (ETFs / Stocks)",
    "high_risk": "High Risk (Crypto / Options)",
}


def compute_drift(db: Session, investor_id: uuid.UUID) -> StrategyDriftReport:
    risk_model = get_latest_risk_model(db, investor_id)
    snapshot = (
        db.query(PortfolioSnapshot)
        .filter(PortfolioSnapshot.investor_id == investor_id)
        .order_by(PortfolioSnapshot.snapshot_at.desc())
        .first()
    )

    now = datetime.now(timezone.utc)

    if not risk_model or not snapshot:
        return StrategyDriftReport(
            investor_id=investor_id,
            computed_at=now,
            alignment_score=None,
            risk_profile=risk_model.stability_classification if risk_model else None,
            stability_score=risk_model.stability_score if risk_model else None,
            locked_pct=0.0,
            tradeable_pct=0.0,
            drift_items=[],
            top_concern=None,
            summary=(
                "No portfolio snapshot found. Generate a portfolio analysis first to enable drift detection."
                if risk_model
                else "No risk model found. Generate a risk model first."
            ),
            last_snapshot_at=snapshot.snapshot_at if snapshot else None,
            risk_model_generated_at=risk_model.generated_at if risk_model else None,
        )

    asset_allocation: dict[str, float] = snapshot.asset_allocation or {}

    # Aggregate by tier
    tier_actual: dict[str, float] = {"low_risk": 0.0, "growth": 0.0, "high_risk": 0.0}
    locked_pct = 0.0
    for asset_type, pct in asset_allocation.items():
        tier = _ASSET_TO_TIER.get(asset_type)
        if tier is not None:
            tier_actual[tier] += pct
        else:
            locked_pct += pct

    tradeable_pct = max(0.0, 100.0 - locked_pct)

    # Normalize to tradeable basis
    if tradeable_pct > 0.5:
        for t in tier_actual:
            tier_actual[t] = round(tier_actual[t] / tradeable_pct * 100, 1)

    targets = {
        "low_risk": risk_model.low_risk_pct,
        "growth": risk_model.growth_pct,
        "high_risk": risk_model.high_risk_pct,
    }

    drift_items: list[DriftItem] = []
    total_squared_error = 0.0
    max_abs_drift = 0.0
    top_concern: str | None = None

    for tier_key, target in targets.items():
        actual = tier_actual[tier_key]
        drift = actual - target
        abs_drift = abs(drift)

        if abs_drift < 3.0:
            status = "on_track"
        elif abs_drift < 8.0:
            status = "minor_drift"
        else:
            status = "major_drift"

        total_squared_error += drift**2

        if abs_drift > max_abs_drift:
            max_abs_drift = abs_drift
            top_concern = _TIER_LABELS[tier_key]

        drift_items.append(
            DriftItem(
                category=_TIER_LABELS[tier_key],
                tier_key=tier_key,
                target_pct=target,
                actual_pct=round(actual, 1),
                drift_pct=round(drift, 1),
                status=status,
            )
        )

    # Alignment score: 100 - RMSE*2, clamped 0-100
    rmse = (total_squared_error / 3) ** 0.5
    alignment_score = round(max(0.0, min(100.0, 100.0 - rmse * 2)), 1)

    major = [d for d in drift_items if d.status == "major_drift"]
    minor = [d for d in drift_items if d.status == "minor_drift"]

    if not major and not minor:
        summary = f"Portfolio is well-aligned with your risk model. Alignment score: {alignment_score}%."
    elif major:
        cats = ", ".join(d.category for d in major)
        summary = (
            f"Major drift detected in {cats}. "
            f"Consider rebalancing via the Rebalance tool. Alignment score: {alignment_score}%."
        )
    else:
        cats = ", ".join(d.category for d in minor)
        summary = (
            f"Minor drift in {cats}. Monitor and rebalance if it worsens. "
            f"Alignment score: {alignment_score}%."
        )

    return StrategyDriftReport(
        investor_id=investor_id,
        computed_at=now,
        alignment_score=alignment_score,
        risk_profile=risk_model.stability_classification,
        stability_score=risk_model.stability_score,
        locked_pct=round(locked_pct, 1),
        tradeable_pct=round(tradeable_pct, 1),
        drift_items=drift_items,
        top_concern=top_concern,
        summary=summary,
        last_snapshot_at=snapshot.snapshot_at,
        risk_model_generated_at=risk_model.generated_at,
    )

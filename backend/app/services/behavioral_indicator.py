"""Behavioral Confidence Indicator — read-only pre-flight advisory.

Computes a kappa score (0.0–1.0) from the investor's decision history and
surfaces it as an informational chip inside the pre-flight review.
Never modifies order sizing or the Risk Engine verdict.

Tiers:
  HIGH_ALPHA          κ ≥ 0.75 + thesis present
  STANDARD            0.65 ≤ κ < 0.75 (or κ ≥ 0.75 without thesis)
  CAUTION_IMPULSE     0.50 ≤ κ < 0.65
  HIGH_RISK_OVERRIDE  κ < 0.50
  INSUFFICIENT_DATA   fewer than MIN_ORDERS_FOR_SIGNAL executed orders
"""
import logging
import uuid
from dataclasses import dataclass

from sqlalchemy.orm import Session

log = logging.getLogger(__name__)

MIN_ORDERS_FOR_SIGNAL = 5


@dataclass
class BehavioralMetrics:
    rolling_dqs: float              # 0–100 (raw from compute_monthly_dqs)
    documentation_alpha_pct: float  # percentage-point spread (documented vs undocumented returns)
    override_ratio: float           # fraction of executed orders that had 'reconsider' verdict
    has_thesis: bool                # current order has written rationale
    historical_asset_edge: bool     # positive avg return for this asset_type with ≥ MIN_ORDERS_FOR_SIGNAL buys
    sufficient_data: bool           # True when executed order count ≥ MIN_ORDERS_FOR_SIGNAL


def compute_behavioral_metrics(
    db: Session,
    investor_id: uuid.UUID,
    asset_type: str | None,
    has_thesis: bool,
) -> BehavioralMetrics:
    """Gather all inputs for the behavioral confidence calculation."""
    from app.models.staged_order import StagedOrder

    executed = (
        db.query(StagedOrder)
        .filter(
            StagedOrder.investor_id == investor_id,
            StagedOrder.status == "executed",
        )
        .all()
    )

    if len(executed) < MIN_ORDERS_FOR_SIGNAL:
        return BehavioralMetrics(
            rolling_dqs=0.0,
            documentation_alpha_pct=0.0,
            override_ratio=0.0,
            has_thesis=has_thesis,
            historical_asset_edge=False,
            sufficient_data=False,
        )

    # DQS (0–100) ──────────────────────────────────────────────────────────────
    dqs = 0.0
    try:
        from app.decision_intelligence.service import compute_monthly_dqs
        result = compute_monthly_dqs(db, executed)
        if result is not None:
            dqs = float(result)
    except Exception as exc:
        log.debug("[behavioral_indicator] DQS unavailable: %s", exc)

    # Documentation alpha (percentage points) ──────────────────────────────────
    doc_alpha_pct = 0.0
    try:
        from app.behavioral_alpha.service import compute_behavioral_alpha
        ba = compute_behavioral_alpha(db, investor_id)
        if ba and ba.documentation_alpha and ba.documentation_alpha.alpha_pct is not None:
            doc_alpha_pct = float(ba.documentation_alpha.alpha_pct)
    except Exception as exc:
        log.debug("[behavioral_indicator] Behavioral alpha unavailable: %s", exc)

    # Override ratio ───────────────────────────────────────────────────────────
    reconsider_count = sum(
        1 for o in executed
        if (o.pre_flight_review or {}).get("verdict") == "reconsider"
    )
    override_ratio = reconsider_count / len(executed)

    # Historical asset edge ────────────────────────────────────────────────────
    historical_asset_edge = False
    if asset_type:
        try:
            from app.models.price_snapshot import PriceSnapshot
            asset_buys = [
                o for o in executed
                if o.asset_type == asset_type and o.ticker and o.action == "buy" and o.unit_price > 0
            ]
            if len(asset_buys) >= MIN_ORDERS_FOR_SIGNAL:
                returns: list[float] = []
                for o in asset_buys:
                    snap = (
                        db.query(PriceSnapshot)
                        .filter(PriceSnapshot.ticker == o.ticker)
                        .order_by(PriceSnapshot.fetched_at.desc())
                        .first()
                    )
                    if snap and snap.price > 0:
                        returns.append((snap.price - o.unit_price) / o.unit_price * 100)
                if returns:
                    historical_asset_edge = (sum(returns) / len(returns)) > 0
        except Exception as exc:
            log.debug("[behavioral_indicator] Asset edge unavailable: %s", exc)

    return BehavioralMetrics(
        rolling_dqs=dqs,
        documentation_alpha_pct=doc_alpha_pct,
        override_ratio=override_ratio,
        has_thesis=has_thesis,
        historical_asset_edge=historical_asset_edge,
        sufficient_data=True,
    )


def evaluate_behavioral_confidence(metrics: BehavioralMetrics) -> dict:
    """Compute κ and confidence tier. Returns an advisory dict, never modifies order."""
    if not metrics.sufficient_data:
        return {
            "kappa_score": None,
            "confidence_tier": "INSUFFICIENT_DATA",
            "suggested_action": "NO_ACTION",
            "rationale": (
                f"Behavioral confidence requires at least {MIN_ORDERS_FOR_SIGNAL} executed orders. "
                "Keep staging and documenting orders to unlock this signal."
            ),
        }

    # Normalize DQS 0–100 → 0–1
    base_score = min(metrics.rolling_dqs / 100.0, 1.0)

    # Documentation alpha: clamp ±25pp, scale to ±0.125 contribution
    clamped_alpha = max(-25.0, min(metrics.documentation_alpha_pct, 25.0))
    alpha_modifier = (clamped_alpha / 25.0) * 0.125

    override_penalty = metrics.override_ratio * 0.25
    thesis_penalty = 0.0 if metrics.has_thesis else 0.15
    asset_penalty = 0.0 if metrics.historical_asset_edge else 0.10

    kappa = base_score + alpha_modifier - override_penalty - thesis_penalty - asset_penalty
    kappa = round(max(0.0, min(kappa, 1.0)), 2)

    # Tier assignment ──────────────────────────────────────────────────────────
    if kappa >= 0.75 and metrics.has_thesis:
        tier = "HIGH_ALPHA"
        action = "NO_ACTION"
        rationale = (
            f"Strong decision history (DQS {metrics.rolling_dqs:.0f}/100) with documented thesis. "
            "Behavioral signals support this setup."
        )
    elif kappa < 0.50:
        tier = "HIGH_RISK_OVERRIDE"
        action = "RECOMMEND_PAPER_TRADING"
        parts: list[str] = []
        if metrics.rolling_dqs < 50:
            parts.append(f"low DQS ({metrics.rolling_dqs:.0f}/100)")
        if not metrics.has_thesis:
            parts.append("no written thesis")
        if metrics.override_ratio > 0.30:
            parts.append(f"high override rate ({metrics.override_ratio * 100:.0f}%)")
        rationale = (
            "Impulse-risk zone — "
            + (", ".join(parts) if parts else "combined behavioral signals")
            + ". Consider paper trading before committing capital."
        )
    elif kappa < 0.65:
        tier = "CAUTION_IMPULSE"
        action = "CONSIDER_REDUCING_SIZE"
        rationale = (
            f"Moderate behavioral confidence (κ={kappa:.2f}). "
            "Consider reducing position size or adding a written thesis before executing."
        )
    else:
        tier = "STANDARD"
        action = "NO_ACTION"
        rationale = (
            f"Behavioral compliance within normal range (κ={kappa:.2f}). "
            "Proceed with standard risk-model sizing."
        )

    return {
        "kappa_score": kappa,
        "confidence_tier": tier,
        "suggested_action": action,
        "rationale": rationale,
    }

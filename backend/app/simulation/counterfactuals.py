"""
Counterfactual replay engine — "what would have happened if…"

All three types return the same results dict format as v2.5 simulations
(p10=p50=p90 deterministic trajectory) plus additional counterfactual-specific
fields: actual_trajectory, actual_final, delta, delta_pct, is_counterfactual, etc.

Values are illustrative estimates. The frozen data_snapshot preserves the
investor's financial state at compute time for full auditability.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models.behavioral_risk_event import BehavioralRiskEvent
from app.models.holding_transaction import HoldingTransaction
from app.models.portfolio_snapshot import PortfolioSnapshot
from app.models.price_snapshot import PriceSnapshot
from app.models.recommendation_decision import RecommendationDecision
from app.models.risk_model import RiskModel

# ─── Reference return rates per tier (annual) ────────────────────────────────
# Conservative reference rates used for tier-weighted counterfactual estimates.
_TIER_RATES = {"low_risk": 0.04, "growth": 0.08, "high_risk": 0.12}


def _weighted_rate(alloc: dict) -> float:
    """Annual weighted return rate from tier allocation dict (values are 0–100 %)."""
    total = sum(alloc.values()) or 100.0
    rate = 0.0
    for tier, base_rate in _TIER_RATES.items():
        rate += (alloc.get(tier, 0.0) / total) * base_rate
    return rate


def _monthly_points(
    start_value: float,
    annual_rate: float,
    elapsed_months: int,
) -> list[dict[str, Any]]:
    """Build a simple compound-growth trajectory for one path."""
    r = annual_rate / 12
    v = start_value
    pts = []
    for m in range(elapsed_months + 1):
        pts.append({"month": m, "p10": round(v, 2), "p50": round(v, 2), "p90": round(v, 2)})
        v = v * (1 + r) if r != 0 else v
    return pts


def _actual_trajectory_from_snapshots(
    snapshots: list[PortfolioSnapshot],
    fork_date: datetime,
    elapsed_months: int,
    start_value: float,
    actual_current: float,
) -> list[dict[str, Any]]:
    """Build a monthly actual path aligned with the counterfactual trajectory."""
    if not snapshots:
        r_month = (actual_current / start_value) ** (1.0 / max(elapsed_months, 1)) - 1 if start_value else 0.0
        v = start_value
        pts = []
        for m in range(elapsed_months + 1):
            pts.append({"month": m, "value": round(v, 2)})
            v = v * (1 + r_month)
        return pts

    snap_map: dict[int, float] = {}
    for s in snapshots:
        months_since = max(0, round((s.snapshot_at - fork_date).days / 30))
        snap_map[months_since] = s.total_value

    pts = []
    prev_m, prev_v = 0, start_value
    for m in range(elapsed_months + 1):
        if m in snap_map:
            pts.append({"month": m, "value": round(snap_map[m], 2)})
            prev_m, prev_v = m, snap_map[m]
        else:
            next_m = min((k for k in snap_map if k > m), default=elapsed_months)
            next_v = snap_map.get(next_m, actual_current)
            if next_m > prev_m:
                alpha = (m - prev_m) / (next_m - prev_m)
                interp = prev_v + alpha * (next_v - prev_v)
            else:
                interp = prev_v
            pts.append({"month": m, "value": round(interp, 2)})
    return pts


# ─── Type A: Rebalance counterfactual ─────────────────────────────────────────

def run_counterfactual_rebalance(
    db: Session,
    investor_id: uuid.UUID,
    decision_id: uuid.UUID,
) -> dict[str, Any]:
    """
    Type A: What if I had followed the rebalance recommendation?

    Compares the actual portfolio path to a counterfactual where the
    suggested allocation shift was executed at the decision date.
    Uses tier-weighted reference return rates for the estimate.
    """
    decision: RecommendationDecision | None = (
        db.query(RecommendationDecision)
        .filter(
            RecommendationDecision.id == decision_id,
            RecommendationDecision.investor_id == investor_id,
        )
        .first()
    )
    if not decision:
        raise ValueError(f"Decision {decision_id} not found for this investor.")

    holdings = decision.holdings_summary or {}
    risk_snap = decision.risk_model_snapshot or {}

    start_value: float = float(holdings.get("total_value") or 0.0)
    if start_value <= 0:
        raise ValueError("Decision holdings_summary has no usable total_value.")

    actual_alloc: dict = holdings.get("asset_allocation") or {}
    target_alloc = {
        "low_risk": float(risk_snap.get("low_risk_pct") or 30.0),
        "growth": float(risk_snap.get("growth_pct") or 55.0),
        "high_risk": float(risk_snap.get("high_risk_pct") or 15.0),
    }

    fork_date: datetime = decision.triggered_at
    now = datetime.now(timezone.utc)
    elapsed_months = max(1, round((now - fork_date).days / 30))

    snapshots: list[PortfolioSnapshot] = (
        db.query(PortfolioSnapshot)
        .filter(
            PortfolioSnapshot.investor_id == investor_id,
            PortfolioSnapshot.snapshot_at >= fork_date,
        )
        .order_by(PortfolioSnapshot.snapshot_at.asc())
        .all()
    )

    actual_current = snapshots[-1].total_value if snapshots else start_value

    actual_rate = _weighted_rate(actual_alloc)
    target_rate = _weighted_rate(target_alloc)
    elapsed_years = elapsed_months / 12

    if actual_rate > 0 and elapsed_years > 0:
        actual_compounded = start_value * ((1 + actual_rate) ** elapsed_years)
        target_compounded = start_value * ((1 + target_rate) ** elapsed_years)
        adjustment = target_compounded / actual_compounded
    else:
        adjustment = 1.0

    counterfactual_current = round(actual_current * adjustment, 2)

    traj = _monthly_points(start_value, target_rate, elapsed_months)
    actual_traj = _actual_trajectory_from_snapshots(
        snapshots, fork_date, elapsed_months, start_value, actual_current
    )

    delta = round(counterfactual_current - actual_current, 2)
    delta_pct = round(delta / actual_current * 100, 2) if actual_current else None

    return {
        "trajectory": traj,
        "final_p10": counterfactual_current,
        "final_p50": counterfactual_current,
        "final_p90": counterfactual_current,
        "probability_positive": None,
        "is_monte_carlo": False,
        "iterations": 1,
        "is_counterfactual": True,
        "counterfactual_type": "rebalance",
        "actual_trajectory": actual_traj,
        "actual_final": actual_current,
        "actual_start": start_value,
        "delta": delta,
        "delta_pct": delta_pct,
        "reference_date": fork_date.isoformat(),
        "elapsed_months": elapsed_months,
        "explanation": (
            f"Reference fork: {fork_date.strftime('%b %d, %Y')}. "
            f"Actual allocation weighted rate: {actual_rate*100:.1f}%/yr → "
            f"target rate: {target_rate*100:.1f}%/yr over {elapsed_months} months. "
            "Values are tier-rate-weighted illustrative estimates, not guaranteed returns."
        ),
    }


# ─── Type B: Constraint enforcement counterfactual ───────────────────────────

def run_counterfactual_constraint(
    db: Session,
    investor_id: uuid.UUID,
) -> dict[str, Any]:
    """
    Type B: What if the allocation constraint was always enforced?

    Finds the earliest portfolio snapshot where drift from the risk model
    exceeds the threshold, then models the portfolio as if it had been
    rebalanced to targets from that point forward.
    """
    risk_model: RiskModel | None = (
        db.query(RiskModel)
        .filter(RiskModel.investor_id == investor_id)
        .order_by(RiskModel.generated_at.desc())
        .first()
    )
    if not risk_model:
        raise ValueError("No risk model found. Generate a risk model first.")

    target_alloc = {
        "low_risk": float(getattr(risk_model, "low_risk_pct", 30.0)),
        "growth": float(getattr(risk_model, "growth_pct", 55.0)),
        "high_risk": float(getattr(risk_model, "high_risk_pct", 15.0)),
    }
    target_rate = _weighted_rate(target_alloc)

    snapshots: list[PortfolioSnapshot] = (
        db.query(PortfolioSnapshot)
        .filter(PortfolioSnapshot.investor_id == investor_id)
        .order_by(PortfolioSnapshot.snapshot_at.asc())
        .all()
    )
    if len(snapshots) < 2:
        raise ValueError("Not enough portfolio snapshots for counterfactual analysis (need ≥ 2).")

    # Find the first snapshot with significant drift (>15% total deviation from targets)
    fork_snapshot: PortfolioSnapshot | None = None
    for snap in snapshots:
        alloc = snap.asset_allocation or {}
        drift = sum(
            abs(alloc.get(tier, 0.0) - target_alloc[tier])
            for tier in _TIER_RATES
        )
        if drift > 15.0:
            fork_snapshot = snap
            break

    if fork_snapshot is None:
        fork_snapshot = snapshots[0]

    fork_date = fork_snapshot.snapshot_at
    start_value = fork_snapshot.total_value
    now = datetime.now(timezone.utc)
    elapsed_months = max(1, round((now - fork_date).days / 30))

    snapshots_after = [s for s in snapshots if s.snapshot_at >= fork_date]
    actual_current = snapshots_after[-1].total_value if snapshots_after else start_value

    actual_alloc = fork_snapshot.asset_allocation or {}
    actual_rate = _weighted_rate(actual_alloc) if actual_alloc else target_rate

    elapsed_years = elapsed_months / 12
    if actual_rate > 0 and elapsed_years > 0:
        adjustment = ((1 + target_rate) ** elapsed_years) / ((1 + actual_rate) ** elapsed_years)
    else:
        adjustment = 1.0

    counterfactual_current = round(actual_current * adjustment, 2)

    traj = _monthly_points(start_value, target_rate, elapsed_months)
    actual_traj = _actual_trajectory_from_snapshots(
        snapshots_after, fork_date, elapsed_months, start_value, actual_current
    )

    delta = round(counterfactual_current - actual_current, 2)
    delta_pct = round(delta / actual_current * 100, 2) if actual_current else None

    return {
        "trajectory": traj,
        "final_p10": counterfactual_current,
        "final_p50": counterfactual_current,
        "final_p90": counterfactual_current,
        "probability_positive": None,
        "is_monte_carlo": False,
        "iterations": 1,
        "is_counterfactual": True,
        "counterfactual_type": "constraint",
        "actual_trajectory": actual_traj,
        "actual_final": actual_current,
        "actual_start": start_value,
        "delta": delta,
        "delta_pct": delta_pct,
        "reference_date": fork_date.isoformat(),
        "elapsed_months": elapsed_months,
        "explanation": (
            f"Fork detected at {fork_date.strftime('%b %d, %Y')} (first snapshot with "
            f">15% tier drift). Constrained path uses target rate {target_rate*100:.1f}%/yr vs "
            f"actual {actual_rate*100:.1f}%/yr over {elapsed_months} months. "
            "Values are tier-rate-weighted illustrative estimates."
        ),
    }


# ─── Type C: Panic-sell reversal counterfactual ───────────────────────────────

def run_counterfactual_hold(
    db: Session,
    investor_id: uuid.UUID,
    event_id: uuid.UUID,
) -> dict[str, Any]:
    """
    Type C: What if I hadn't panic-sold?

    Reverses the sell transactions from the panic-selling window,
    estimates their current value using portfolio growth rate or live prices,
    and shows the portfolio trajectory with those holdings intact.
    """
    event: BehavioralRiskEvent | None = (
        db.query(BehavioralRiskEvent)
        .filter(
            BehavioralRiskEvent.id == event_id,
            BehavioralRiskEvent.investor_id == investor_id,
        )
        .first()
    )
    if not event:
        raise ValueError(f"Behavioral risk event {event_id} not found for this investor.")
    if event.event_type != "panic_selling":
        raise ValueError(
            f"Counterfactual hold requires a panic_selling event (got '{event.event_type}')."
        )

    fork_date = event.detected_at
    window_start = fork_date - timedelta(days=3)
    window_end = fork_date + timedelta(days=1)
    now = datetime.now(timezone.utc)
    elapsed_months = max(1, round((now - fork_date).days / 30))

    # Sells during the panic window
    panic_sells: list[HoldingTransaction] = (
        db.query(HoldingTransaction)
        .filter(
            HoldingTransaction.investor_id == investor_id,
            HoldingTransaction.transaction_type == "sell",
            HoldingTransaction.transaction_date >= window_start.date(),
            HoldingTransaction.transaction_date <= window_end.date(),
        )
        .all()
    )

    total_sold = sum(t.total_amount for t in panic_sells)

    # Portfolio snapshots from fork to now
    snapshots: list[PortfolioSnapshot] = (
        db.query(PortfolioSnapshot)
        .filter(
            PortfolioSnapshot.investor_id == investor_id,
            PortfolioSnapshot.snapshot_at >= fork_date,
        )
        .order_by(PortfolioSnapshot.snapshot_at.asc())
        .all()
    )

    # Portfolio snapshot closest to and before the panic event as start
    pre_snap: PortfolioSnapshot | None = (
        db.query(PortfolioSnapshot)
        .filter(
            PortfolioSnapshot.investor_id == investor_id,
            PortfolioSnapshot.snapshot_at < fork_date,
        )
        .order_by(PortfolioSnapshot.snapshot_at.desc())
        .first()
    )

    start_value = pre_snap.total_value if pre_snap else (
        snapshots[0].total_value if snapshots else total_sold
    )
    actual_current = snapshots[-1].total_value if snapshots else start_value

    # Estimate current value of sold holdings
    # Prefer current live prices; fall back to portfolio growth rate
    held_current_value = 0.0
    for txn in panic_sells:
        if txn.ticker and txn.quantity:
            price_snap: PriceSnapshot | None = (
                db.query(PriceSnapshot)
                .filter(PriceSnapshot.ticker == txn.ticker)
                .order_by(PriceSnapshot.fetched_at.desc())
                .first()
            )
            if price_snap:
                held_current_value += txn.quantity * price_snap.price
                continue
        # Fallback: grow sold amount at portfolio rate
        if start_value > 0 and actual_current > 0:
            portfolio_growth = actual_current / start_value
        else:
            portfolio_growth = 1.0
        held_current_value += txn.total_amount * portfolio_growth

    counterfactual_current = round(actual_current + (held_current_value - total_sold), 2)

    # Trajectory: counterfactual is actual path + linear increase of "held value" over time
    actual_traj = _actual_trajectory_from_snapshots(
        snapshots, fork_date, elapsed_months, start_value, actual_current
    )

    # Counterfactual: at each month, add the proportionally-held value above actual
    held_uplift_per_month = (held_current_value - total_sold) / elapsed_months if elapsed_months else 0
    traj = []
    for pt in actual_traj:
        m = pt["month"]
        cf_val = round(pt["value"] + held_uplift_per_month * m, 2)
        traj.append({"month": m, "p10": cf_val, "p50": cf_val, "p90": cf_val})

    delta = round(counterfactual_current - actual_current, 2)
    delta_pct = round(delta / actual_current * 100, 2) if actual_current else None

    panic_tickers = list({t.ticker for t in panic_sells if t.ticker})

    return {
        "trajectory": traj,
        "final_p10": counterfactual_current,
        "final_p50": counterfactual_current,
        "final_p90": counterfactual_current,
        "probability_positive": None,
        "is_monte_carlo": False,
        "iterations": 1,
        "is_counterfactual": True,
        "counterfactual_type": "hold",
        "actual_trajectory": actual_traj,
        "actual_final": actual_current,
        "actual_start": start_value,
        "delta": delta,
        "delta_pct": delta_pct,
        "reference_date": fork_date.isoformat(),
        "elapsed_months": elapsed_months,
        "panic_tickers": panic_tickers,
        "total_sold": round(total_sold, 2),
        "estimated_held_value": round(held_current_value, 2),
        "explanation": (
            f"Panic sell event detected {fork_date.strftime('%b %d, %Y')}. "
            f"Sells: {len(panic_sells)} transaction(s) totaling {total_sold:,.0f}. "
            f"Tickers: {', '.join(panic_tickers) or 'unknown'}. "
            f"Estimated held value today: {held_current_value:,.0f}. "
            "Prices from live snapshot where available; portfolio growth rate used as fallback. "
            "Illustrative estimate."
        ),
    }

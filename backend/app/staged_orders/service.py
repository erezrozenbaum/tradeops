"""Staged Orders service — core logic for order creation, pre-flight review,
tax analysis, minimum-trade rebalancing, and CRUD operations."""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.audit import service as audit_svc
from app.currency_engine.rates import convert as fx_convert
from app.models.financial_goal import FinancialGoal
from app.models.holding_transaction import HoldingTransaction
from app.models.investment_account import InvestmentAccount, InvestmentHolding
from app.models.staged_order import StagedOrder
from app.portfolio_analysis import rebalance_engine, service as portfolio_svc
from app.portfolio_analysis.rebalance_engine import HoldingInfo
from app.risk_modeling.service import get_latest as get_latest_risk_model
from app.staged_orders.schemas import (
    GenerateRebalanceResult,
    PreFlightReason,
    PreFlightReview,
    ProjectedMetrics,
    StagedOrderCreate,
    StagedOrderList,
    StagedOrderOut,
)


# ── helpers ────────────────────────────────────────────────────────────────────

def _to_out(order: StagedOrder) -> StagedOrderOut:
    return StagedOrderOut.model_validate(order)


def _goal_name(db: Session, goal_id: uuid.UUID | None) -> str | None:
    if not goal_id:
        return None
    goal = db.get(FinancialGoal, goal_id)
    return goal.name if goal else None


# ── tax analysis ───────────────────────────────────────────────────────────────

def _compute_tax_note(
    db: Session,
    investor_id: uuid.UUID,
    ticker: str | None,
    action: str,
    unit_price: float,
) -> str | None:
    if action != "sell" or not ticker:
        return None

    # Look for the most recent holding to get avg_buy_price
    holding: InvestmentHolding | None = (
        db.query(InvestmentHolding)
        .join(InvestmentAccount, InvestmentHolding.account_id == InvestmentAccount.id)
        .filter(
            InvestmentAccount.investor_id == investor_id,
            InvestmentHolding.ticker == ticker,
        )
        .first()
    )

    notes: list[str] = []

    if holding:
        avg_buy = holding.avg_buy_price or 0
        if avg_buy > 0:
            pnl_pct = (unit_price - avg_buy) / avg_buy * 100
            if pnl_pct < 0:
                notes.append(f"Tax-loss harvest: selling at a {abs(pnl_pct):.1f}% loss vs avg cost (reduces taxable gains)")
            else:
                notes.append(f"Selling at {pnl_pct:.1f}% gain — consider deferring if near long-term threshold")

    # Wash-sale proximity: any buy of same ticker within 30 days
    cutoff = date.today() - timedelta(days=30)
    recent_buy = (
        db.query(HoldingTransaction)
        .filter(
            HoldingTransaction.investor_id == investor_id,
            HoldingTransaction.ticker == ticker,
            HoldingTransaction.transaction_type == "buy",
            HoldingTransaction.transaction_date >= cutoff,
        )
        .first()
    )
    if recent_buy:
        notes.append(
            f"Wash-sale risk: you bought {ticker} within the last 30 days "
            f"({recent_buy.transaction_date}). Selling may trigger wash-sale rules."
        )

    return " | ".join(notes) if notes else None


# ── pre-flight review ──────────────────────────────────────────────────────────

def _compute_pre_flight(
    db: Session,
    investor_id: uuid.UUID,
    action: str,
    ticker: str | None,
    asset_type: str | None,
    estimated_value: float,
    currency: str,
) -> dict[str, Any]:
    reasons: list[PreFlightReason] = []
    risks: list[PreFlightReason] = []
    alternative: str | None = None

    risk_model = get_latest_risk_model(db, investor_id)
    portfolio = portfolio_svc.get_portfolio(db, investor_id)

    # Reason: aligned with risk model tier
    if risk_model and asset_type:
        tier_map = {"bond": "low_risk", "fund": "low_risk", "etf": "growth",
                    "stock": "growth", "real_estate": "growth", "crypto": "high_risk"}
        tier = tier_map.get(asset_type)
        if tier:
            target = getattr(risk_model, f"{tier}_pct", None)
            reasons.append(PreFlightReason(
                label="Risk model alignment",
                detail=f"This {asset_type} maps to your {tier.replace('_', ' ')} tier "
                       f"(target: {target:.0f}% of investable capital)" if target else
                       f"This {asset_type} maps to your {tier.replace('_', ' ')} tier.",
            ))

    # Reason: order size relative to portfolio
    if portfolio and portfolio.total_current_value and portfolio.total_current_value > 0:
        pct_of_portfolio = estimated_value / portfolio.total_current_value * 100
        if pct_of_portfolio < 5:
            reasons.append(PreFlightReason(
                label="Manageable position size",
                detail=f"This order is {pct_of_portfolio:.1f}% of your total portfolio — low concentration impact.",
            ))
        elif pct_of_portfolio > 20:
            risks.append(PreFlightReason(
                label="Large position size",
                detail=f"This order is {pct_of_portfolio:.1f}% of your total portfolio — may increase concentration risk.",
            ))

    # Reason: sell reduces overweight / buy fills underweight
    if portfolio and risk_model and asset_type:
        aa = portfolio.asset_allocation or {}
        tier_map2 = {"bond": "low_risk", "fund": "low_risk", "etf": "growth",
                     "stock": "growth", "real_estate": "growth", "crypto": "high_risk"}
        tier = tier_map2.get(asset_type)
        if tier:
            actual = sum(v for k, v in aa.items() if tier_map2.get(k) == tier)
            target = getattr(risk_model, f"{tier}_pct", 0)
            delta = actual - target
            if action == "sell" and delta > 3:
                reasons.append(PreFlightReason(
                    label="Reduces overweight tier",
                    detail=f"Your {tier.replace('_', ' ')} tier is {actual:.1f}% vs target {target:.1f}% — this sell moves you closer to target.",
                ))
            elif action == "buy" and delta < -3:
                reasons.append(PreFlightReason(
                    label="Fills underweight tier",
                    detail=f"Your {tier.replace('_', ' ')} tier is {actual:.1f}% vs target {target:.1f}% — this buy moves you closer to target.",
                ))

    # Risk: no risk model
    if not risk_model:
        risks.append(PreFlightReason(
            label="No risk model",
            detail="Generate a risk model before staging orders to ensure allocation alignment.",
        ))
        alternative = "Go to Risk Model to generate your allocation targets first."

    # Risk: sell with no existing holding found
    if action == "sell" and ticker:
        holding = (
            db.query(InvestmentHolding)
            .join(InvestmentAccount, InvestmentHolding.account_id == InvestmentAccount.id)
            .filter(
                InvestmentAccount.investor_id == investor_id,
                InvestmentHolding.ticker == ticker,
            )
            .first()
        )
        if not holding:
            risks.append(PreFlightReason(
                label="No holding found",
                detail=f"No current holding for {ticker} detected — verify you own this asset before selling.",
            ))

    verdict = "reconsider" if (len(risks) >= 2 or not risk_model) else ("caution" if risks else "proceed")

    return PreFlightReview(
        reasons_to_proceed=reasons or [PreFlightReason(label="Order staged", detail="Review complete — no specific alignment concerns detected.")],
        risks=risks,
        alternative=alternative,
        verdict=verdict,
    ).model_dump()


# ── projected metrics ──────────────────────────────────────────────────────────

def _compute_projected_metrics(
    db: Session,
    investor_id: uuid.UUID,
    action: str,
    estimated_value: float,
    asset_type: str | None,
    goal_id: uuid.UUID | None,
    currency: str,
) -> dict[str, Any]:
    portfolio = portfolio_svc.get_portfolio(db, investor_id)

    total = portfolio.total_current_value if portfolio else None
    proj_total: float | None = None
    if total:
        proj_total = total + estimated_value if action == "buy" else total - estimated_value

    tier_map = {"bond": "low_risk", "fund": "low_risk", "etf": "growth",
                "stock": "growth", "real_estate": "growth", "crypto": "high_risk"}
    tier = tier_map.get(asset_type or "", None)

    proj_tier_pct: dict[str, float | None] = {"low_risk": None, "growth": None, "high_risk": None}
    if total and proj_total and portfolio:
        aa = portfolio.asset_allocation or {}
        for t in ["low_risk", "growth", "high_risk"]:
            current_pct = sum(v for k, v in aa.items() if tier_map.get(k) == t)
            current_val = total * current_pct / 100
            delta = estimated_value if (action == "buy" and tier == t) else (-estimated_value if (action == "sell" and tier == t) else 0)
            proj_tier_pct[t] = round((current_val + delta) / proj_total * 100, 1) if proj_total > 0 else None

    # Goal impact
    goal_name: str | None = None
    goal_progress: float | None = None
    if goal_id:
        goal = db.get(FinancialGoal, goal_id)
        if goal:
            goal_name = goal.name
            added = estimated_value if action == "buy" else 0
            new_amount = goal.current_amount + added
            goal_progress = round(min(new_amount / goal.target_amount * 100, 100), 1) if goal.target_amount > 0 else None

    return ProjectedMetrics(
        portfolio_value_base=round(proj_total, 2) if proj_total else None,
        low_risk_pct=proj_tier_pct.get("low_risk"),
        growth_pct=proj_tier_pct.get("growth"),
        high_risk_pct=proj_tier_pct.get("high_risk"),
        goal_progress_pct=goal_progress,
        goal_name=goal_name,
    ).model_dump()


# ── CRUD ───────────────────────────────────────────────────────────────────────

def create_staged_order(
    db: Session,
    investor_id: uuid.UUID,
    payload: StagedOrderCreate,
) -> StagedOrderOut:
    estimated_value = round(payload.quantity * payload.unit_price, 2)
    goal_name = _goal_name(db, payload.goal_id)

    pre_flight = _compute_pre_flight(
        db, investor_id, payload.action, payload.ticker,
        payload.asset_type, estimated_value, payload.currency,
    )
    tax_note = _compute_tax_note(
        db, investor_id, payload.ticker, payload.action, payload.unit_price,
    )
    projected = _compute_projected_metrics(
        db, investor_id, payload.action, estimated_value,
        payload.asset_type, payload.goal_id, payload.currency,
    )

    order = StagedOrder(
        investor_id=investor_id,
        ticker=payload.ticker,
        name=payload.name,
        action=payload.action,
        quantity=payload.quantity,
        unit_price=payload.unit_price,
        currency=payload.currency,
        estimated_value=estimated_value,
        asset_type=payload.asset_type,
        status="pending",
        goal_id=payload.goal_id,
        goal_name=goal_name,
        tax_note=tax_note,
        pre_flight_review=pre_flight,
        projected_metrics=projected,
        notes=payload.notes,
    )
    db.add(order)
    db.flush()

    audit_svc.log_event(
        db,
        event_type="staged_order_created",
        description=f"Staged {payload.action.upper()} order for {payload.name} ({payload.ticker or 'no ticker'}) "
                    f"qty={payload.quantity} @ {payload.unit_price} {payload.currency}",
        investor_profile_id=investor_id,
        metadata={"order_id": str(order.id), "action": payload.action, "ticker": payload.ticker},
    )
    db.commit()
    db.refresh(order)
    return _to_out(order)


def list_staged_orders(
    db: Session,
    investor_id: uuid.UUID,
    status: str | None = None,
) -> StagedOrderList:
    q = db.query(StagedOrder).filter(StagedOrder.investor_id == investor_id)
    if status:
        q = q.filter(StagedOrder.status == status)
    orders = q.order_by(StagedOrder.created_at.desc()).all()

    all_orders = db.query(StagedOrder).filter(StagedOrder.investor_id == investor_id).all()
    counts = {"pending": 0, "executed": 0, "cancelled": 0}
    for o in all_orders:
        if o.status in counts:
            counts[o.status] += 1

    return StagedOrderList(
        investor_id=investor_id,
        pending_count=counts["pending"],
        executed_count=counts["executed"],
        cancelled_count=counts["cancelled"],
        orders=[_to_out(o) for o in orders],
    )


def get_order(db: Session, investor_id: uuid.UUID, order_id: uuid.UUID) -> StagedOrder | None:
    return (
        db.query(StagedOrder)
        .filter(StagedOrder.id == order_id, StagedOrder.investor_id == investor_id)
        .first()
    )


def mark_executed(db: Session, investor_id: uuid.UUID, order_id: uuid.UUID) -> StagedOrderOut:
    order = get_order(db, investor_id, order_id)
    if not order:
        raise ValueError("Order not found")
    if order.status != "pending":
        raise ValueError(f"Order is already {order.status}")

    order.status = "executed"
    order.executed_at = datetime.now(timezone.utc)
    db.flush()

    audit_svc.log_event(
        db,
        event_type="staged_order_executed",
        description=f"Marked {order.action.upper()} order for {order.name} as executed "
                    f"qty={order.quantity} @ {order.unit_price} {order.currency}",
        investor_profile_id=investor_id,
        metadata={"order_id": str(order.id), "action": order.action, "ticker": order.ticker},
    )
    db.commit()
    db.refresh(order)
    return _to_out(order)


def cancel_order(db: Session, investor_id: uuid.UUID, order_id: uuid.UUID) -> StagedOrderOut:
    order = get_order(db, investor_id, order_id)
    if not order:
        raise ValueError("Order not found")
    if order.status != "pending":
        raise ValueError(f"Order is already {order.status}")

    order.status = "cancelled"
    db.flush()

    audit_svc.log_event(
        db,
        event_type="staged_order_cancelled",
        description=f"Cancelled {order.action.upper()} order for {order.name}",
        investor_profile_id=investor_id,
        metadata={"order_id": str(order.id)},
    )
    db.commit()
    db.refresh(order)
    return _to_out(order)


# ── minimum-trade rebalancing ──────────────────────────────────────────────────

def generate_minimum_rebalance(
    db: Session,
    investor_id: uuid.UUID,
) -> GenerateRebalanceResult:
    """Generate the minimum set of staged orders to reach risk-model targets.

    Uses the existing rebalance engine to compute tier gaps, then converts
    each suggested trade into a StagedOrder with pre-flight review + tax analysis.
    """
    portfolio = portfolio_svc.get_portfolio(db, investor_id)
    if not portfolio:
        raise ValueError("Investor not found")

    risk_model = get_latest_risk_model(db, investor_id)
    if not risk_model:
        raise ValueError("No risk model found — generate a risk model first")

    base_currency = portfolio.base_currency or "ILS"

    holdings_info: list[HoldingInfo] = []
    for acc in portfolio.accounts:
        for h in acc.holdings:
            if not h.ticker:
                continue
            unit_price_base: float | None = None
            if h.live_price is not None and h.live_price_currency:
                unit_price_base = fx_convert(db, h.live_price, h.live_price_currency, base_currency)
            holdings_info.append(HoldingInfo(
                ticker=h.ticker,
                name=h.name,
                asset_type=h.asset_type,
                current_value_base=h.current_value_base,
                unit_price_base=unit_price_base,
            ))

    result = rebalance_engine.compute_rebalance(
        investor_id=investor_id,
        risk_model=risk_model,
        asset_allocation=portfolio.asset_allocation,
        total_value=portfolio.total_current_value,
        currency=base_currency,
        holdings=holdings_info or None,
    )

    created_orders: list[StagedOrderOut] = []
    notes = list(result.notes)

    # For tax-optimized sequencing: process sells before buys to free up capital
    all_trades = []
    for tier in result.tiers:
        for trade in tier.suggested_trades:
            all_trades.append((trade, tier.tier))

    # Sort: sells first (tax-efficient — losses realized before buying), then buys
    all_trades.sort(key=lambda x: (0 if x[0].action == "sell" else 1))

    for trade, tier_key in all_trades:
        tier_asset_map = {"low_risk": "bond", "growth": "etf", "high_risk": "crypto"}
        asset_type = tier_asset_map.get(tier_key)
        payload = StagedOrderCreate(
            ticker=trade.ticker,
            name=trade.name,
            action=trade.action,
            quantity=trade.suggested_units,
            unit_price=trade.unit_price,
            currency=base_currency,
            asset_type=asset_type,
        )
        order = create_staged_order(db, investor_id, payload)
        created_orders.append(order)

    total_buy = sum(o.estimated_value for o in created_orders if o.action == "buy")
    total_sell = sum(o.estimated_value for o in created_orders if o.action == "sell")

    if not created_orders:
        notes.append("No rebalancing orders needed — portfolio is within target thresholds.")

    return GenerateRebalanceResult(
        investor_id=investor_id,
        orders_generated=len(created_orders),
        total_buy_value=round(total_buy, 2),
        total_sell_value=round(total_sell, 2),
        net_value=round(total_buy - total_sell, 2),
        currency=base_currency,
        orders=created_orders,
        notes=notes,
    )

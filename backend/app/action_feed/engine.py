"""Daily Action Feed engine.

Aggregates signals from all existing engines into a prioritised morning
briefing. No DB writes — pure read aggregation.

Priority levels:
  1 — Urgent (red):   triggered price alerts, option expiry ≤7d, short option expiry
  2 — High  (orange): rebalance gap ≥10%, negative signal on large position
  3 — Medium (yellow): rebalance gap 5-10%, at-risk goal, positive accumulation signal
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.action_feed.schemas import ActionItem, DailyActionFeed


def build_action_feed(db: Session, investor_id: uuid.UUID) -> DailyActionFeed:
    from app.portfolio_analysis import service as portfolio_service
    from app.portfolio_analysis.rebalance_engine import HoldingInfo, compute_rebalance
    from app.risk_modeling.service import get_latest as get_latest_risk_model
    from app.currency_engine.rates import convert as fx_convert
    from app.proactive_insights.engine import detect_drift
    from app.goals_analysis import service as goals_service
    from app.models.price_alert import PriceAlert
    from app.models.market_signal import MarketSignal

    items: list[ActionItem] = []
    currency = "USD"

    portfolio = portfolio_service.get_portfolio(db, investor_id)
    if portfolio:
        currency = portfolio.base_currency

    # ── Source 1: Rebalancing signals ──────────────────────────────────────
    risk_model = get_latest_risk_model(db, investor_id)
    if portfolio and risk_model:
        holdings_info: list[HoldingInfo] = []
        for acc in portfolio.accounts:
            for h in acc.holdings:
                if not h.ticker:
                    continue
                unit_price_base: float | None = None
                if h.live_price is not None and h.live_price_currency:
                    unit_price_base = fx_convert(
                        db, h.live_price, h.live_price_currency, portfolio.base_currency
                    )
                holdings_info.append(HoldingInfo(
                    ticker=h.ticker,
                    name=h.name,
                    asset_type=h.asset_type,
                    current_value_base=h.current_value_base,
                    unit_price_base=unit_price_base,
                ))

        rebalance = compute_rebalance(
            investor_id=investor_id,
            risk_model=risk_model,
            asset_allocation=portfolio.asset_allocation,
            total_value=portfolio.total_current_value,
            currency=portfolio.base_currency,
            holdings=holdings_info or None,
        )

        if rebalance.rebalance_needed:
            for tier in rebalance.tiers:
                for trade in tier.suggested_trades:
                    delta = abs(tier.delta_pct)
                    priority = 2 if delta >= 10 else 3
                    direction = "below" if tier.delta_pct < 0 else "above"
                    items.append(ActionItem(
                        id=f"rebalance-{trade.ticker}",
                        priority=priority,
                        category="rebalance",
                        action_type=trade.action.upper(),
                        title=f"{trade.action.title()} {trade.name}",
                        reasoning=(
                            f"Your {tier.label} tier is {delta:.1f}% {direction} target. "
                            f"Suggested: {trade.suggested_units:.2f} units "
                            f"(~{trade.estimated_value:,.0f} {trade.currency})."
                        ),
                        ticker=trade.ticker,
                        amount=trade.estimated_value,
                        units=trade.suggested_units,
                        unit_price=trade.unit_price,
                        currency=trade.currency,
                        source="rebalancing",
                    ))

    # ── Source 2: Proactive drift events ───────────────────────────────────
    drift_report = detect_drift(db, investor_id)
    for event in drift_report.drift_events:
        priority = 1 if event.severity == "danger" else 2
        if event.event_type == "option_expiry" and event.days_to_expiry and event.days_to_expiry <= 7:
            priority = 1

        action_type_map = {
            "concentration": "REDUCE",
            "tier_drift": "REVIEW",
            "option_expiry": "REVIEW",
            "short_option_expiry": "URGENT",
        }

        if event.event_type == "concentration":
            reasoning = (
                f"{event.ticker} is {event.value_pct:.1f}% of your portfolio — "
                "above the 20% concentration limit. Consider trimming."
            )
        elif event.event_type == "tier_drift":
            reasoning = f"Risk tier is {abs(event.delta_pct or 0):.1f}% off your target allocation."
        elif event.event_type == "option_expiry":
            reasoning = (
                f"Expires in {event.days_to_expiry} day{'s' if event.days_to_expiry != 1 else ''}. "
                "Decide: roll, exercise, or let expire."
            )
        elif event.event_type == "short_option_expiry":
            reasoning = (
                f"Short option expires in {event.days_to_expiry} days — "
                "unlimited loss risk if not managed before expiry."
            )
        else:
            reasoning = "Portfolio drift detected."

        items.append(ActionItem(
            id=f"drift-{event.event_id}",
            priority=priority,
            category="insight",
            action_type=action_type_map.get(event.event_type, "REVIEW"),
            title=event.name,
            reasoning=reasoning,
            ticker=event.ticker,
            amount=None,
            units=event.suggested_action_units,
            unit_price=None,
            currency=currency,
            source="proactive_insights",
        ))

    # ── Source 3: Triggered price alerts ───────────────────────────────────
    triggered = (
        db.query(PriceAlert)
        .filter(
            PriceAlert.investor_id == investor_id,
            PriceAlert.is_active.is_(True),
            PriceAlert.triggered_at.isnot(None),
        )
        .all()
    )
    for alert in triggered:
        direction = "above" if alert.alert_type == "above" else "below"
        tp = f"{alert.triggered_price:,.2f}" if alert.triggered_price else "—"
        items.append(ActionItem(
            id=f"alert-{alert.id}",
            priority=1,
            category="alert",
            action_type="ALERT",
            title=f"Price alert triggered: {alert.ticker}",
            reasoning=(
                f"{alert.ticker} moved {direction} your target of "
                f"{alert.target_price:,.2f} {alert.currency}. Triggered at {tp}."
            ),
            ticker=alert.ticker,
            amount=None,
            units=None,
            unit_price=alert.triggered_price,
            currency=alert.currency,
            source="price_alerts",
        ))

    # ── Source 4: At-risk goals ─────────────────────────────────────────────
    goals_result = goals_service.get_analysis(db, investor_id)
    if goals_result:
        for goal in goals_result.goals:
            if goal.status in ("at_risk", "no_date"):
                needed = goal.monthly_contribution_needed or 0.0
                items.append(ActionItem(
                    id=f"goal-{goal.id}",
                    priority=3,
                    category="goal",
                    action_type="CONTRIBUTE",
                    title=f"Goal at risk: {goal.name}",
                    reasoning=(
                        f"{goal.progress_pct:.0f}% complete. "
                        f"Need {needed:,.0f} {goal.currency}/month to stay on track."
                    ),
                    ticker=None,
                    amount=needed,
                    units=None,
                    unit_price=None,
                    currency=goal.currency,
                    source="goals",
                ))

    # ── Source 5: Strong/weak market signals (last 3 days) ─────────────────
    cutoff = date.today() - timedelta(days=3)
    recent_signals = (
        db.query(MarketSignal)
        .filter(
            MarketSignal.investor_id == investor_id,
            MarketSignal.guard_status == "APPROVED",
            MarketSignal.is_dismissed.is_(False),
            MarketSignal.signal_date >= cutoff,
        )
        .order_by(MarketSignal.signal_date.desc())
        .limit(10)
        .all()
    )
    for sig in recent_signals:
        score = sig.composite_score or 50
        rationale = (sig.rationale or f"Composite score: {score}/100.")[:200]
        if score >= 70:
            items.append(ActionItem(
                id=f"signal-{sig.id}",
                priority=3,
                category="signal",
                action_type="ACCUMULATE",
                title=f"Positive signal: {sig.ticker}",
                reasoning=rationale,
                ticker=sig.ticker,
                amount=None,
                units=None,
                unit_price=None,
                currency=currency,
                source="market_signals",
            ))
        elif score <= 30:
            items.append(ActionItem(
                id=f"signal-{sig.id}",
                priority=2,
                category="signal",
                action_type="WATCH",
                title=f"Negative signal: {sig.ticker}",
                reasoning=rationale,
                ticker=sig.ticker,
                amount=None,
                units=None,
                unit_price=None,
                currency=currency,
                source="market_signals",
            ))

    # ── Sort, deduplicate, cap at 12 ───────────────────────────────────────
    seen: set[str] = set()
    unique: list[ActionItem] = []
    for item in sorted(items, key=lambda x: (x.priority, x.id)):
        if item.id not in seen:
            seen.add(item.id)
            unique.append(item)
    items = unique[:12]

    urgent = sum(1 for i in items if i.priority == 1)
    high = sum(1 for i in items if i.priority == 2)
    medium = sum(1 for i in items if i.priority == 3)

    if not items:
        summary = "Portfolio looks healthy — no actions needed today."
    elif urgent:
        summary = f"{urgent} urgent action{'s' if urgent > 1 else ''} need your attention."
    elif high:
        summary = f"{high} high-priority item{'s' if high > 1 else ''} to review."
    else:
        summary = f"{medium} suggestion{'s' if medium > 1 else ''} based on your portfolio."

    return DailyActionFeed(
        investor_id=investor_id,
        generated_at=datetime.now(timezone.utc),
        summary=summary,
        currency=currency,
        urgent_count=urgent,
        high_count=high,
        medium_count=medium,
        items=items,
    )

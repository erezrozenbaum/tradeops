"""In-app notification center — computed on-the-fly from existing data."""
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.financial_profile import FinancialProfile
from app.models.investor_profile import InvestorProfile
from pydantic import BaseModel


class AppNotification(BaseModel):
    id: str
    type: str
    severity: str  # info | warning | danger
    title: str
    message: str
    link: str | None = None


def get_notifications(db: Session, investor_id: uuid.UUID) -> list[AppNotification]:
    notifications: list[AppNotification] = []

    investor = db.get(InvestorProfile, investor_id)
    if not investor:
        return []

    # --- Critical: emergency fund < 1 month ---
    try:
        from app.financial_profiles.service import get_by_investor, compute_effective_ef_months
        fp = get_by_investor(db, investor_id)
        if fp:
            ef = compute_effective_ef_months(db, investor_id, fp)
            if ef < 1.0:
                notifications.append(AppNotification(
                    id="critical_ef_below_1m",
                    type="safety",
                    severity="danger",
                    title="Emergency fund critically low",
                    message=f"You have less than 1 month of expenses saved ({ef:.1f} months). Build your safety net before investing.",
                    link="/financial",
                ))
    except Exception:
        pass

    # --- Critical: HIGH behavioral risk active ---
    try:
        from app.models.behavioral_risk_event import BehavioralRiskEvent
        high_risks = (
            db.query(BehavioralRiskEvent)
            .filter(
                BehavioralRiskEvent.investor_id == investor_id,
                BehavioralRiskEvent.status == "active",
                BehavioralRiskEvent.severity == "high",
            )
            .order_by(BehavioralRiskEvent.detected_at.desc())
            .limit(1)
            .first()
        )
        if high_risks:
            label = high_risks.event_type.replace("_", " ").title()
            notifications.append(AppNotification(
                id=f"critical_behavioral_{high_risks.event_type}",
                type="behavioral",
                severity="danger",
                title=f"High behavioral risk: {label}",
                message=high_risks.description or "A high-severity behavioral pattern has been detected. Review your recent activity.",
                link="/behavioral-risk",
            ))
    except Exception:
        pass

    # --- Goals analysis ---
    try:
        from app.goals_analysis.service import get_analysis
        goals_result = get_analysis(db, investor_id)
        if goals_result:
            for g in goals_result.goals:
                if g.status == "at_risk":
                    notifications.append(AppNotification(
                        id=f"goal_at_risk_{g.id}",
                        type="goal",
                        severity="warning",
                        title=f"Goal at risk: {g.name}",
                        message=f"You need {_fmt(g.monthly_contribution_needed, g.currency)} / mo. Gap: {_fmt(abs(g.gap or 0), g.currency)}.",
                        link="/goals",
                    ))
                elif g.status == "complete":
                    notifications.append(AppNotification(
                        id=f"goal_complete_{g.id}",
                        type="goal",
                        severity="info",
                        title=f"Goal reached: {g.name}",
                        message=f"Congratulations — {g.name} is 100% funded.",
                        link="/goals",
                    ))
                elif g.progress_pct >= 75:
                    notifications.append(AppNotification(
                        id=f"goal_75pct_{g.id}",
                        type="goal",
                        severity="info",
                        title=f"75% milestone: {g.name}",
                        message=f"{g.name} is {g.progress_pct:.0f}% funded — you're almost there.",
                        link="/goals",
                    ))
                elif g.progress_pct >= 50:
                    notifications.append(AppNotification(
                        id=f"goal_50pct_{g.id}",
                        type="goal",
                        severity="info",
                        title=f"Halfway: {g.name}",
                        message=f"{g.name} is {g.progress_pct:.0f}% funded.",
                        link="/goals",
                    ))
    except Exception:
        pass

    # --- Portfolio rebalance ---
    try:
        from app.portfolio_analysis.service import get_portfolio
        from app.portfolio_analysis import rebalance_engine
        from app.risk_modeling.service import get_latest as get_risk_model
        portfolio = get_portfolio(db, investor_id)
        risk_model = get_risk_model(db, investor_id)
        if portfolio and portfolio.total_current_value > 0:
            rebalance = rebalance_engine.compute_rebalance(
                investor_id=investor_id,
                risk_model=risk_model,
                asset_allocation=portfolio.asset_allocation,
                total_value=portfolio.total_current_value,
                currency=portfolio.base_currency,
            )
            if rebalance.rebalance_needed:
                over = [t for t in rebalance.tiers if t.action == "Reduce"]
                under = [t for t in rebalance.tiers if t.action == "Buy more"]
                parts = []
                if over:
                    parts.append(f"overweight in {', '.join(t.label for t in over)}")
                if under:
                    parts.append(f"underweight in {', '.join(t.label for t in under)}")
                notifications.append(AppNotification(
                    id="portfolio_rebalance",
                    type="portfolio",
                    severity="warning",
                    title="Portfolio rebalancing needed",
                    message=f"Your portfolio is {'; '.join(parts)}. Review your allocation.",
                    link="/investments",
                ))
    except Exception:
        pass

    # --- Stale prices ---
    try:
        from app.models.price_snapshot import PriceSnapshot
        from app.models.investment_account import InvestmentAccount
        accounts = db.query(InvestmentAccount).filter(InvestmentAccount.investor_id == investor_id).all()
        tickers = {h.ticker for acc in accounts for h in acc.holdings if h.ticker}
        stale = []
        for ticker in tickers:
            snap = db.query(PriceSnapshot).filter(PriceSnapshot.ticker == ticker).order_by(PriceSnapshot.fetched_at.desc()).first()
            if snap:
                age_h = (datetime.now(timezone.utc) - snap.fetched_at.replace(tzinfo=timezone.utc)).total_seconds() / 3600
                if age_h > 48:
                    stale.append(ticker)
        if stale:
            notifications.append(AppNotification(
                id="stale_prices",
                type="market",
                severity="info",
                title="Price data is stale",
                message=f"{len(stale)} ticker(s) haven't been updated in over 48h: {', '.join(sorted(stale)[:5])}.",
                link="/investments",
            ))
    except Exception:
        pass

    # --- No financial profile ---
    try:
        fp = db.query(FinancialProfile).filter(FinancialProfile.investor_profile_id == investor_id).first()
        if not fp:
            notifications.append(AppNotification(
                id="no_financial_profile",
                type="setup",
                severity="info",
                title="Complete your financial profile",
                message="Add income, expenses, and assets to unlock goal tracking, stability scoring, and AI recommendations.",
                link="/financial",
            ))
    except Exception:
        pass

    # --- No risk model ---
    try:
        from app.risk_modeling.service import get_latest as get_risk_model
        rm = get_risk_model(db, investor_id)
        if not rm:
            notifications.append(AppNotification(
                id="no_risk_model",
                type="setup",
                severity="info",
                title="Generate your risk model",
                message="Your risk model hasn't been generated yet. Go to Risk Model to create one.",
                link="/risk",
            ))
    except Exception:
        pass

    # --- Proactive drift insights ---
    try:
        from app.proactive_insights.engine import detect_drift
        drift_report = detect_drift(db, investor_id)
        for event in drift_report.drift_events:
            if event.event_type == "concentration":
                notifications.append(AppNotification(
                    id=event.event_id,
                    type="insight",
                    severity=event.severity,
                    title=f"Concentration risk: {event.name}",
                    message=(
                        f"{event.ticker} represents {event.value_pct:.1f}% of your portfolio "
                        f"(threshold: {20:.0f}%). Consider trimming to reduce single-asset exposure."
                    ),
                    link="/investments",
                ))
            elif event.event_type == "tier_drift":
                direction = "overweight" if (event.delta_pct or 0) > 0 else "underweight"
                notifications.append(AppNotification(
                    id=event.event_id,
                    type="insight",
                    severity=event.severity,
                    title=f"Allocation drift: {event.name}",
                    message=(
                        f"Your {event.name} tier is {direction} by {abs(event.delta_pct or 0):.1f}% "
                        f"vs your risk model target. Review your rebalancing plan."
                    ),
                    link="/investments",
                ))
            elif event.event_type in ("option_expiry", "short_option_expiry"):
                short_note = " (short position — unlimited loss risk)" if event.data.get("is_short") else ""
                notifications.append(AppNotification(
                    id=event.event_id,
                    type="insight",
                    severity=event.severity,
                    title=f"Option expiring: {event.name}",
                    message=(
                        f"{event.name} expires in {event.days_to_expiry} day(s)"
                        f" (strike {event.data.get('strike_price', '?')}){short_note}."
                    ),
                    link="/investments",
                ))
    except Exception:
        pass

    # --- Triggered price alerts ---
    try:
        from app.models.price_alert import PriceAlert
        from datetime import timedelta
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        triggered = (
            db.query(PriceAlert)
            .filter(
                PriceAlert.investor_id == investor_id,
                PriceAlert.is_active == False,  # noqa: E712
                PriceAlert.triggered_at >= cutoff,
            )
            .order_by(PriceAlert.triggered_at.desc())
            .limit(5)
            .all()
        )
        for alert in triggered:
            direction = "hit" if alert.alert_type == "above" else "dropped to"
            notifications.append(AppNotification(
                id=f"price_alert_{alert.id}",
                type="alert",
                severity="warning",
                title=f"Price alert triggered: {alert.ticker}",
                message=(
                    f"{alert.ticker} {direction} {alert.currency} {alert.triggered_price:,.2f} "
                    f"(your target: {alert.currency} {alert.target_price:,.2f}). "
                    f"Delete this alert from the Watchlist page to dismiss."
                ),
                link="/watchlist",
            ))
    except Exception:
        pass

    return notifications


def _fmt(amount: float | None, currency: str) -> str:
    if amount is None:
        return "—"
    return f"{currency} {amount:,.0f}"

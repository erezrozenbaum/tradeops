"""Proactive Insights Engine.

Two layers:
1. detect_drift()  — deterministic, fast, no AI. Used by notification center.
2. generate_insights() — calls Claude for natural-language narratives + rebalancing actions.
   Used by GET /portfolio/insights and the weekly worker job.

Drift is flagged when:
  - A single ticker accounts for > CONCENTRATION_THRESHOLD_PCT of total portfolio value
  - A risk tier deviates from its risk model target by > TIER_DRIFT_THRESHOLD_PCT
  - An option position is expiring within EXPIRY_WARNING_DAYS days

Options positions use contract_multiplier in exposure calculation.
Short options are flagged with unlimited loss risk if expiring soon.
"""
from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass, field

log = logging.getLogger(__name__)

CONCENTRATION_THRESHOLD_PCT = 20.0  # single ticker > 20% → concentration alert
TIER_DRIFT_THRESHOLD_PCT = 5.0      # tier drift > 5% → rebalance alert
EXPIRY_WARNING_DAYS = 30            # options expiring within 30 days

_OPTION_TYPES = {"call_option", "put_option"}

_ASSET_TO_TIER = {
    "bond": "low_risk", "fund": "low_risk", "pension_fund": "low_risk", "study_fund": "low_risk",
    "etf": "growth", "stock": "growth", "real_estate": "growth",
    "crypto": "high_risk",
}

_SYSTEM_PROMPT = """\
You are a proactive financial advisor assistant for TradeOps AI.
Based on the portfolio drift events provided, generate:
1. A short natural-language insight (1-2 sentences) explaining each drift event to the investor.
2. A specific, safe rebalancing action (e.g. "Consider trimming your AAPL position by ~5 units, worth approximately $X").

Rules:
- Be specific — use the actual ticker names and percentages from the data.
- Never guarantee returns. Never recommend leverage, margin, or shorting.
- If an option is expiring soon, state the expiry date clearly.
- Keep each insight under 60 words.
- Respond with valid JSON only — an array of objects:
  [{"event_id": "...", "insight": "...", "action": "..."}, ...]
No markdown, no extra text outside the JSON array.
"""


@dataclass
class DriftEvent:
    event_id: str
    event_type: str   # "concentration" | "tier_drift" | "option_expiry" | "short_option_expiry"
    severity: str     # "warning" | "danger"
    ticker: str | None
    name: str
    value_pct: float | None      # % of portfolio (for concentration)
    delta_pct: float | None      # tier deviation (for tier_drift)
    tier: str | None             # tier key (for tier_drift)
    days_to_expiry: int | None   # (for option events)
    suggested_action_units: float | None  # rough units to trim
    data: dict = field(default_factory=dict)


@dataclass
class InsightResult:
    event_id: str
    insight: str
    action: str


@dataclass
class ProactiveInsightsReport:
    investor_id: uuid.UUID
    drift_events: list[DriftEvent]
    insights: list[InsightResult]   # empty if AI not called
    total_portfolio_value: float
    base_currency: str


def detect_drift(db, investor_id: uuid.UUID) -> ProactiveInsightsReport:
    """Fast deterministic drift detection — no AI, no external calls."""
    from app.portfolio_analysis import service as portfolio_service
    from app.risk_modeling.service import get_latest as get_risk_model
    from app.portfolio_analysis.options_engine import days_to_expiry
    from app.models.investment_account import InvestmentAccount

    portfolio = portfolio_service.get_portfolio(db, investor_id)
    risk_model = get_risk_model(db, investor_id)

    base_currency = portfolio.base_currency if portfolio else "USD"
    total_value = portfolio.total_current_value if portfolio else 0.0
    events: list[DriftEvent] = []

    if not portfolio or total_value <= 0:
        return ProactiveInsightsReport(
            investor_id=investor_id,
            drift_events=[],
            insights=[],
            total_portfolio_value=0.0,
            base_currency=base_currency,
        )

    # --- Ticker-level concentration ---
    ticker_values: dict[str, tuple[str, float]] = {}  # ticker → (name, value_base)
    accounts = db.query(InvestmentAccount).filter(InvestmentAccount.investor_id == investor_id).all()

    for acc in accounts:
        for h in acc.holdings:
            if not h.ticker:
                continue
            multiplier = 1.0
            if h.asset_type in _OPTION_TYPES:
                multiplier = h.contract_multiplier or 100.0

            # Approximate holding value in base currency
            if h.current_value is not None:
                val = h.current_value  # already in holding currency; approximate as base
            else:
                val = h.avg_buy_price * h.quantity * multiplier

            existing = ticker_values.get(h.ticker, (h.name, 0.0))
            ticker_values[h.ticker] = (existing[0], existing[1] + val)

    for ticker, (name, val) in ticker_values.items():
        pct = val / total_value * 100
        if pct >= CONCENTRATION_THRESHOLD_PCT:
            trim_pct = pct - CONCENTRATION_THRESHOLD_PCT * 0.8  # trim to ~80% of threshold
            events.append(DriftEvent(
                event_id=f"concentration_{ticker}",
                event_type="concentration",
                severity="warning" if pct < 35 else "danger",
                ticker=ticker,
                name=name,
                value_pct=round(pct, 1),
                delta_pct=None,
                tier=None,
                days_to_expiry=None,
                suggested_action_units=None,
                data={"value_base": round(val, 2), "total_value": round(total_value, 2)},
            ))

    # --- Tier-level drift vs risk model ---
    if risk_model and portfolio.asset_allocation:
        tier_actual: dict[str, float] = {"low_risk": 0.0, "growth": 0.0, "high_risk": 0.0}
        for asset_type, pct in portfolio.asset_allocation.items():
            tier = _ASSET_TO_TIER.get(asset_type)
            if tier:
                tier_actual[tier] += pct

        tier_targets = {
            "low_risk": risk_model.low_risk_pct,
            "growth": risk_model.growth_pct,
            "high_risk": risk_model.high_risk_pct,
        }
        tier_labels = {"low_risk": "Low Risk", "growth": "Growth", "high_risk": "High Risk"}

        for tier_key, actual_pct in tier_actual.items():
            target_pct = tier_targets[tier_key]
            delta = actual_pct - target_pct
            if abs(delta) >= TIER_DRIFT_THRESHOLD_PCT:
                events.append(DriftEvent(
                    event_id=f"tier_drift_{tier_key}",
                    event_type="tier_drift",
                    severity="warning",
                    ticker=None,
                    name=tier_labels[tier_key],
                    value_pct=round(actual_pct, 1),
                    delta_pct=round(delta, 1),
                    tier=tier_key,
                    days_to_expiry=None,
                    suggested_action_units=None,
                    data={"target_pct": round(target_pct, 1), "actual_pct": round(actual_pct, 1)},
                ))

    # --- Expiring options ---
    for acc in accounts:
        for h in acc.holdings:
            if h.asset_type not in _OPTION_TYPES:
                continue
            days = days_to_expiry(h.expiry_date)
            if days is not None and days <= EXPIRY_WARNING_DAYS:
                is_short = (h.position_type or "long") == "short"
                events.append(DriftEvent(
                    event_id=f"option_expiry_{h.id}",
                    event_type="short_option_expiry" if is_short else "option_expiry",
                    severity="danger" if days <= 7 or is_short else "warning",
                    ticker=h.underlying_ticker or h.ticker,
                    name=h.name,
                    value_pct=None,
                    delta_pct=None,
                    tier=None,
                    days_to_expiry=days,
                    suggested_action_units=h.quantity,
                    data={
                        "expiry_date": str(h.expiry_date) if h.expiry_date else None,
                        "strike_price": h.strike_price,
                        "position_type": h.position_type or "long",
                        "option_type": h.option_type,
                        "is_short": is_short,
                    },
                ))

    return ProactiveInsightsReport(
        investor_id=investor_id,
        drift_events=events,
        insights=[],
        total_portfolio_value=round(total_value, 2),
        base_currency=base_currency,
    )


def generate_insights(db, investor_id: uuid.UUID, api_key: str) -> ProactiveInsightsReport:
    """Run drift detection + call Claude to narrate each event."""
    import anthropic

    report = detect_drift(db, investor_id)
    if not report.drift_events:
        return report

    context = {
        "base_currency": report.base_currency,
        "total_portfolio_value": report.total_portfolio_value,
        "drift_events": [
            {
                "event_id": e.event_id,
                "type": e.event_type,
                "name": e.name,
                "ticker": e.ticker,
                "value_pct": e.value_pct,
                "delta_pct": e.delta_pct,
                "tier": e.tier,
                "days_to_expiry": e.days_to_expiry,
                **e.data,
            }
            for e in report.drift_events
        ],
    }

    try:
        client = anthropic.Anthropic(api_key=api_key)
        msg = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            system=_SYSTEM_PROMPT,
            messages=[{
                "role": "user",
                "content": f"Generate insights for these drift events:\n\n{json.dumps(context, indent=2, default=str)}",
            }],
        )
        raw = msg.content[0].text.strip()
        items = json.loads(raw)
        insights = [
            InsightResult(event_id=i["event_id"], insight=i.get("insight", ""), action=i.get("action", ""))
            for i in items
        ]
    except Exception as exc:
        log.error("proactive_insights: AI call failed: %s", exc)
        insights = []

    report.insights = insights
    return report

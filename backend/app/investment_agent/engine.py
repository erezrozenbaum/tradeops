"""AI Investment Agent — gathers full context and calls Claude for a personalised action plan."""
import json
import logging
import uuid
from datetime import datetime, timezone

import anthropic
from sqlalchemy.orm import Session

from app.investment_agent.schemas import (
    ActionItem, AgentReport, CapitalThresholdPlan, Opportunity,
)
from app.models.investor_profile import InvestorProfile

log = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You are a senior financial advisor AI for TradeOps, a personal financial intelligence platform.

Your role is to analyse an investor's complete financial situation and generate a concrete, actionable investment plan.

RULES — you must follow these without exception:
- Never guarantee returns or specific profits
- Only recommend instruments from the provided catalog (never invent tickers)
- If stability_score < 40: focus on emergency fund building and debt reduction FIRST
- If is_minor is true: only education/preservation instruments
- Always account for the investor's base currency and local market
- Be specific: suggest real amounts in the investor's base currency, not percentages alone
- The capital_thresholds section is critical — this helps investors who are building capital know EXACTLY what to buy at each stage

RESPONSE FORMAT — respond with valid JSON only, no markdown:
{
  "portfolio_health_score": <int 0-100>,
  "market_pulse": "<2-3 sentences about current market context based on the price data provided>",
  "portfolio_assessment": "<honest 2-3 sentence assessment of the current portfolio state, gaps, and strengths>",
  "action_plan": [
    {
      "action": "<buy|sell|hold|save|reduce_debt>",
      "instrument_name": "<name>",
      "ticker": "<ticker or null>",
      "urgency": "<immediate|soon|when_convenient>",
      "suggested_amount": <number or null>,
      "currency": "<ISO currency code or null>",
      "reasoning": "<1-2 sentence explanation>"
    }
  ],
  "top_opportunities": [
    {
      "ticker": "<ticker>",
      "name": "<name>",
      "asset_type": "<type>",
      "current_price": <number or null>,
      "price_currency": "<currency or null>",
      "why_now": "<why this fits this investor right now>",
      "fit_score": <1-10>,
      "risk_level": "<low|moderate|high|very_high>",
      "is_in_portfolio": <true|false>,
      "suggested_allocation_pct": <float>
    }
  ],
  "capital_thresholds": [
    {
      "threshold_amount": <number>,
      "currency": "<base currency>",
      "label": "<e.g. 'First 500 ILS'>",
      "primary_action": "<1 sentence — the single most important thing to do with this amount>",
      "instruments": ["<ticker or action>"],
      "rationale": "<why this is the right first step at this capital level>"
    }
  ],
  "risk_warnings": ["<warning string>"]
}

Generate 2-4 action plan items, 3-5 top opportunities, 4-5 capital threshold tiers, and 1-3 risk warnings.
Capital thresholds should cover the range from first available capital to a well-diversified portfolio for this investor.
"""


def _get_market_prices(db: Session) -> dict:
    """Fetch cached prices for all catalog instruments."""
    from app.market_scanner.catalog import CATALOG
    from app.market_data.service import get_cached_price
    prices = {}
    for instrument in CATALOG:
        snap = get_cached_price(db, instrument.ticker)
        if snap:
            prices[instrument.ticker] = {
                "price": snap.price,
                "currency": snap.currency,
            }
    return prices


def _build_context(db: Session, investor_id: uuid.UUID) -> dict | None:
    from app.models.financial_profile import FinancialProfile
    from app.risk_modeling.service import get_latest as get_risk_model
    from app.portfolio_analysis.service import get_portfolio
    from app.goals_analysis.service import get_analysis as get_goals
    from app.financial_scoring.engine import calculate_stability_score
    from app.financial_scoring.schemas import FinancialScoringInput
    from app.market_scanner.catalog import CATALOG

    investor = db.get(InvestorProfile, investor_id)
    if not investor:
        return None

    fp = db.query(FinancialProfile).filter(
        FinancialProfile.investor_profile_id == investor_id
    ).first()

    risk_model = get_risk_model(db, investor_id)
    portfolio = get_portfolio(db, investor_id)
    goals_result = None
    try:
        goals_result = get_goals(db, investor_id)
    except Exception:
        pass

    stability = None
    if fp:
        try:
            stability = calculate_stability_score(FinancialScoringInput(
                monthly_income=fp.monthly_income,
                monthly_expenses=fp.monthly_expenses,
                emergency_fund_months=fp.emergency_fund_months,
                job_stability=fp.job_stability,
                income_trend=fp.income_trend,
                dependents_count=fp.dependents_count,
            ))
        except Exception:
            pass

    market_prices = _get_market_prices(db)

    # Holdings tickers the investor already owns
    owned_tickers: set[str] = set()
    if portfolio:
        for acc in portfolio.accounts:
            for h in acc.holdings:
                if h.ticker:
                    owned_tickers.add(h.ticker)

    monthly_surplus = 0.0
    if fp:
        monthly_surplus = max(0.0, fp.monthly_income - fp.monthly_expenses)

    ctx: dict = {
        "investor": {
            "base_currency": investor.base_currency,
            "country": investor.country,
            "experience_level": investor.experience_level,
            "is_minor": investor.is_minor,
            "risk_tolerance": investor.risk_tolerance,
            "time_horizon": investor.time_horizon,
            "investment_goal": investor.investment_goal,
            "preferred_assets": investor.preferred_assets or [],
        },
        "financial_profile": {
            "monthly_income": fp.monthly_income if fp else None,
            "monthly_expenses": fp.monthly_expenses if fp else None,
            "monthly_surplus": monthly_surplus,
            "liquid_savings": fp.liquid_savings if fp else None,
            "emergency_fund_months": fp.emergency_fund_months if fp else None,
            "investable_capital_pct": fp.investable_capital_pct if fp else None,
            "has_liabilities": bool(fp and fp.liabilities),
            "total_liabilities": sum(float(l.outstanding_balance) for l in fp.liabilities) if fp else 0,
        },
        "stability": {
            "score": stability.score if stability else None,
            "classification": stability.classification if stability else None,
            "risk_modifier": stability.risk_modifier if stability else None,
        },
        "risk_model": {
            "low_risk_pct": risk_model.low_risk_pct if risk_model else None,
            "growth_pct": risk_model.growth_pct if risk_model else None,
            "high_risk_pct": risk_model.high_risk_pct if risk_model else None,
            "investable_capital": risk_model.investable_capital if risk_model else None,
        } if risk_model else None,
        "portfolio": {
            "total_value": portfolio.total_current_value if portfolio else 0,
            "total_cost": portfolio.total_cost_basis if portfolio else 0,
            "unrealized_pnl_pct": portfolio.unrealized_pnl_pct if portfolio else 0,
            "asset_allocation": portfolio.asset_allocation if portfolio else {},
            "currency_exposure": portfolio.currency_exposure if portfolio else {},
            "owned_tickers": sorted(owned_tickers),
        },
        "goals": [
            {
                "name": g.name,
                "status": g.status,
                "progress_pct": g.progress_pct,
                "monthly_contribution_needed": g.monthly_contribution_needed,
                "months_to_target": g.months_to_target,
            }
            for g in (goals_result.goals if goals_result else [])
        ],
        "market_catalog": [
            {
                "ticker": i.ticker,
                "name": i.name,
                "asset_type": i.asset_type,
                "market": i.market,
                "risk_level": i.risk_level,
                "asset_family": i.asset_family,
                "typical_horizon": i.typical_horizon,
                "suitable_for_beginners": i.suitable_for_beginners,
                "current_price": market_prices.get(i.ticker, {}).get("price"),
                "price_currency": market_prices.get(i.ticker, {}).get("currency"),
                "in_portfolio": i.ticker in owned_tickers,
                "brief_rationale": i.brief_rationale,
            }
            for i in CATALOG
        ],
    }
    return ctx


def run_agent(db: Session, investor_id: uuid.UUID) -> AgentReport:
    ctx = _build_context(db, investor_id)
    if not ctx:
        return AgentReport(
            generated_at=datetime.now(timezone.utc),
            portfolio_health_score=0,
            market_pulse="Unable to load investor data.",
            portfolio_assessment="",
            action_plan=[],
            top_opportunities=[],
            capital_thresholds=[],
            risk_warnings=[],
            no_data=True,
        )

    client = anthropic.Anthropic()
    user_msg = (
        "Analyse this investor's complete financial situation and generate a personalised investment action plan.\n\n"
        f"INVESTOR CONTEXT:\n{json.dumps(ctx, indent=2, default=str)}"
    )

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=3000,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    )

    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        log.error("[agent] JSON parse failed: %s\n%s", e, raw[:500])
        return AgentReport(
            generated_at=datetime.now(timezone.utc),
            portfolio_health_score=0,
            market_pulse="Agent response could not be parsed.",
            portfolio_assessment="",
            action_plan=[],
            top_opportunities=[],
            capital_thresholds=[],
            risk_warnings=["Internal error — please try again."],
            no_data=True,
        )

    return AgentReport(
        generated_at=datetime.now(timezone.utc),
        portfolio_health_score=data.get("portfolio_health_score", 50),
        market_pulse=data.get("market_pulse", ""),
        portfolio_assessment=data.get("portfolio_assessment", ""),
        action_plan=[ActionItem(**a) for a in data.get("action_plan", [])],
        top_opportunities=[Opportunity(**o) for o in data.get("top_opportunities", [])],
        capital_thresholds=[CapitalThresholdPlan(**t) for t in data.get("capital_thresholds", [])],
        risk_warnings=data.get("risk_warnings", []),
        no_data=False,
    )

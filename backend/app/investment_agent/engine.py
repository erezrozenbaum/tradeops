"""AI Investment Agent — gathers full context and calls Claude for a personalised action plan."""
import json
import logging
import uuid
from datetime import datetime, timezone

import anthropic
from sqlalchemy.orm import Session

from app.ai_usage.logger import log_ai_call
from app.investment_agent.schemas import (
    ActionItem, AgentReport, CapitalThresholdPlan, Opportunity,
)
from app.models.investor_profile import InvestorProfile

log = logging.getLogger(__name__)

_SYSTEM_PROMPT_BASE = """You are a senior financial advisor AI for TradeOps, a personal financial intelligence platform.

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

# ── Stage-specific prompt extensions ─────────────────────────────────────────

_STAGE_EXTENSIONS: dict[str, str] = {
    "foundation": """
COMMUNICATION STYLE — FOUNDATION STAGE:
This investor is in the Foundation stage of their financial journey. Adapt your response accordingly:
- Use plain, friendly language. Avoid financial jargon. When you must use a term, briefly define it.
- Lead with safety: emergency fund and debt elimination come before any investment discussion.
- Be encouraging and patient. Small, consistent steps matter more than optimisation at this stage.
- Limit opportunities to the simplest, lowest-risk instruments suitable for beginners.
- Explain the "why" behind every recommendation in simple terms a non-investor would understand.
- Capital thresholds should start very small and focus on habit-building before portfolio construction.
""",
    "discipline": """
COMMUNICATION STYLE — DISCIPLINE STAGE:
This investor is in the Discipline stage — they have basic financial habits but are building consistency.
- Use clear, structured language. Light use of financial terms is fine; explain anything non-obvious.
- Draw comparisons: relate their situation to common patterns ("investors who save X% typically see Y").
- Acknowledge what they are already doing well before suggesting improvements.
- Focus on optimising their savings rate, reducing behavioural drag, and building allocation discipline.
- Capital thresholds should reflect a moderate progression from ETFs to a diversified core portfolio.
- Flag any detected behavioural risk events directly and explain the pattern behind them.
""",
    "optimization": """
COMMUNICATION STYLE — OPTIMIZATION STAGE:
This investor is in the Optimization stage — they have strong financial discipline and understand investing.
- Use quantitative language: specific return ranges, allocation percentages, time horizons.
- Provide confidence-ranged estimates where relevant ("historically, this strategy returns X–Y% annually").
- Frame advice around refining an already-working system, not building from scratch.
- Highlight inefficiencies: tax drag, concentration risk, currency exposure, fee structures.
- Capital thresholds should cover advanced diversification: factor tilts, international exposure, alternatives.
- Reference the twin snapshot dimensions to identify specific areas of underperformance.
""",
    "advanced": """
COMMUNICATION STYLE — ADVANCED COGNITION STAGE:
This investor is in the Advanced Cognition stage — institutional-grade thinking applies.
- Use professional financial language: regime, correlation, Sharpe ratio, drawdown, rebalancing bands.
- Frame opportunities in terms of risk-adjusted return, not just expected upside.
- Discuss portfolio construction principles: diversification across factors, geographies, and asset classes.
- Reference behavioural twin scores to identify psychological biases that may be limiting performance.
- Capital thresholds should cover sophisticated allocation: multi-asset, currency hedging considerations, alternatives.
- Be direct about risks including concentration, sequence risk, and tail scenarios.
""",
}

# Maps verbosity override → effective stage key
_VERBOSITY_TO_STAGE: dict[str, str] = {
    "beginner": "foundation",
    "advanced": "advanced",
}


def _effective_stage(maturity_stage: str | None, verbosity: str) -> str:
    if verbosity in _VERBOSITY_TO_STAGE:
        return _VERBOSITY_TO_STAGE[verbosity]
    return maturity_stage or "foundation"


def _build_system_prompt(maturity_stage: str | None, verbosity: str) -> str:
    stage = _effective_stage(maturity_stage, verbosity)
    extension = _STAGE_EXTENSIONS.get(stage, _STAGE_EXTENSIONS["foundation"])
    return _SYSTEM_PROMPT_BASE + extension


# ── Market prices ─────────────────────────────────────────────────────────────

def _get_market_prices(db: Session) -> dict:
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


# ── Context builder ───────────────────────────────────────────────────────────

def _build_context(db: Session, investor_id: uuid.UUID) -> dict | None:
    from app.models.financial_profile import FinancialProfile
    from app.models.investor_maturity_snapshot import InvestorMaturitySnapshot
    from app.models.financial_twin_snapshot import FinancialTwinSnapshot
    from app.models.behavioral_risk_event import BehavioralRiskEvent
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

    # Maturity snapshot — latest
    maturity = (
        db.query(InvestorMaturitySnapshot)
        .filter(InvestorMaturitySnapshot.investor_id == investor_id)
        .order_by(InvestorMaturitySnapshot.computed_at.desc())
        .first()
    )

    # Financial Twin — latest
    twin = (
        db.query(FinancialTwinSnapshot)
        .filter(FinancialTwinSnapshot.investor_id == investor_id)
        .order_by(FinancialTwinSnapshot.computed_at.desc())
        .first()
    )

    # Active behavioral risk events
    active_risks = (
        db.query(BehavioralRiskEvent)
        .filter(
            BehavioralRiskEvent.investor_id == investor_id,
            BehavioralRiskEvent.status == "active",
        )
        .order_by(BehavioralRiskEvent.detected_at.desc())
        .limit(5)
        .all()
    )

    market_prices = _get_market_prices(db)

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
        "maturity": {
            "stage": maturity.stage,
            "composite_score": maturity.composite_score,
            "features_unlocked": maturity.features_unlocked,
            "next_steps": maturity.notes,
        } if maturity else None,
        "financial_twin": {
            "overall_score": twin.overall_score,
            "financial_stability": twin.financial_stability,
            "behavioral_discipline": twin.behavioral_discipline,
            "emotional_risk": twin.emotional_risk,
            "portfolio_consistency": twin.portfolio_consistency,
            "financial_resilience": twin.financial_resilience,
            "risk_alignment": twin.risk_alignment,
            "long_term_discipline": twin.long_term_discipline,
            "contribution_momentum": twin.contribution_momentum,
        } if twin else None,
        "active_behavioral_risks": [
            {
                "event_type": e.event_type,
                "severity": e.severity,
                "description": e.description,
                "recommendation": e.recommendation,
            }
            for e in active_risks
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


# ── Public entry point ────────────────────────────────────────────────────────

def run_agent(db: Session, investor_id: uuid.UUID, verbosity: str = "standard") -> AgentReport:
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
            maturity_stage=None,
            verbosity_used=verbosity,
            no_data=True,
        )

    maturity_stage = ctx.get("maturity", {}).get("stage") if ctx.get("maturity") else None
    system_prompt = _build_system_prompt(maturity_stage, verbosity)

    from app.core.tracing import trace_ai_call

    client = anthropic.Anthropic()
    user_msg = (
        "Analyse this investor's complete financial situation and generate a personalised investment action plan.\n\n"
        f"INVESTOR CONTEXT:\n{json.dumps(ctx, indent=2, default=str)}"
    )

    with trace_ai_call(
        "ai_agent",
        model="claude-sonnet-4-6",
        input_data=ctx,
        investor_id=str(investor_id),
    ) as span:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=3000,
            system=system_prompt,
            messages=[{"role": "user", "content": user_msg}],
        )
        span.set_output(response.content[0].text[:4000])
        span.set_tokens(response.usage.input_tokens, response.usage.output_tokens)

    log_ai_call(
        db=db,
        feature_name="ai_agent",
        model="claude-sonnet-4-6",
        input_tokens=response.usage.input_tokens,
        output_tokens=response.usage.output_tokens,
        investor_id=investor_id,
    )
    db.commit()

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
            maturity_stage=maturity_stage,
            verbosity_used=verbosity,
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
        maturity_stage=maturity_stage,
        verbosity_used=verbosity,
        no_data=False,
    )

"""Smart Allocation Assistant — AI-powered order suggestions.

Gathers investor context (risk model, portfolio state, goals, behavioral risk)
and asks Claude Haiku to generate 3-5 actionable allocation suggestions.
Falls back to deterministic rule-based suggestions when AI is unavailable.
"""
import json
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

log = logging.getLogger(__name__)

_TIER_MAP = {
    "bond": "low_risk", "fund": "low_risk",
    "etf": "growth", "stock": "growth", "real_estate": "growth",
    "crypto": "high_risk",
}


def _build_context(db: Session, investor_id: uuid.UUID) -> dict:
    from app.models.financial_profile import FinancialProfile
    from app.models.portfolio_snapshot import PortfolioSnapshot
    from app.models.behavioral_risk_event import BehavioralRiskEvent
    from app.models.investor_maturity_snapshot import InvestorMaturitySnapshot

    ctx: dict = {}

    fp = db.query(FinancialProfile).filter(
        FinancialProfile.investor_profile_id == investor_id
    ).first()
    if fp:
        ctx["financial_profile"] = {
            "monthly_income": fp.monthly_income,
            "monthly_expenses": fp.monthly_expenses,
            "emergency_fund_months": fp.emergency_fund_months,
            "base_currency": fp.base_currency,
        }

    from app.models.risk_model import RiskModel
    rm = db.query(RiskModel).filter(
        RiskModel.investor_profile_id == investor_id
    ).first()
    if rm:
        ctx["risk_model"] = {
            "investable_capital_pct": rm.investable_capital_pct,
            "low_risk_pct": rm.low_risk_pct,
            "growth_pct": rm.growth_pct,
            "high_risk_pct": rm.high_risk_pct,
        }

    snap = (
        db.query(PortfolioSnapshot)
        .filter(PortfolioSnapshot.investor_id == investor_id)
        .order_by(PortfolioSnapshot.snapshot_at.desc())
        .first()
    )
    if snap:
        ctx["portfolio"] = {
            "total_value": float(snap.total_value),
            "currency": snap.currency,
            "asset_allocation": snap.asset_allocation or {},
        }

    try:
        from app.goals_analysis.service import get_analysis
        goals_result = get_analysis(db, investor_id)
        if goals_result and goals_result.goals:
            ctx["goals"] = [
                {
                    "name": g.name,
                    "goal_type": g.goal_type,
                    "status": g.status,
                    "progress_pct": round(g.progress_pct, 1),
                    "monthly_contribution_needed": round(g.monthly_contribution_needed, 0) if g.monthly_contribution_needed else None,
                }
                for g in goals_result.goals[:5]
            ]
    except Exception:
        pass

    active_risks = (
        db.query(BehavioralRiskEvent)
        .filter(
            BehavioralRiskEvent.investor_id == investor_id,
            BehavioralRiskEvent.status == "active",
        )
        .all()
    )
    if active_risks:
        ctx["behavioral_risks"] = [r.event_type for r in active_risks]

    maturity = (
        db.query(InvestorMaturitySnapshot)
        .filter(InvestorMaturitySnapshot.investor_id == investor_id)
        .order_by(InvestorMaturitySnapshot.computed_at.desc())
        .first()
    )
    if maturity:
        ctx["maturity_stage"] = maturity.stage

    return ctx


def _deterministic_suggestions(ctx: dict) -> list[dict]:
    suggestions: list[dict] = []
    rm = ctx.get("risk_model", {})
    portfolio = ctx.get("portfolio", {})
    currency = ctx.get("financial_profile", {}).get("base_currency", "USD")
    aa = portfolio.get("asset_allocation", {})
    total = portfolio.get("total_value", 0)

    current_low = sum(v for k, v in aa.items() if _TIER_MAP.get(k) == "low_risk")
    current_growth = sum(v for k, v in aa.items() if _TIER_MAP.get(k) == "growth")
    current_high = sum(v for k, v in aa.items() if _TIER_MAP.get(k) == "high_risk")

    target_low = rm.get("low_risk_pct", 0) or 0
    target_growth = rm.get("growth_pct", 0) or 0

    ef_months = (ctx.get("financial_profile") or {}).get("emergency_fund_months") or 0
    if ef_months < 3 and total > 0:
        suggestions.append({
            "action": "buy", "asset_type": "fund", "ticker": None,
            "name": "Build Emergency Fund",
            "rationale": f"Emergency fund is only {ef_months:.1f} months — target at least 3 months before allocating further.",
            "estimated_value": round(total * 0.05, 0),
            "currency": currency, "priority": "high",
            "goal_name": None, "tax_note": None,
        })

    if target_growth > 0 and current_growth < target_growth - 5 and total > 0:
        gap = round((target_growth - current_growth) / 100 * total, 0)
        suggestions.append({
            "action": "buy", "asset_type": "etf", "ticker": "VWRA.L",
            "name": "Vanguard FTSE All-World ETF",
            "rationale": f"Growth tier at {current_growth:.1f}% vs target {target_growth:.1f}% — broad global ETF fills the gap.",
            "estimated_value": min(gap, total * 0.15),
            "currency": currency, "priority": "high",
            "goal_name": None, "tax_note": None,
        })

    if target_low > 0 and current_low < target_low - 5 and total > 0:
        gap = round((target_low - current_low) / 100 * total, 0)
        suggestions.append({
            "action": "buy", "asset_type": "bond", "ticker": "AGG",
            "name": "iShares Core US Aggregate Bond ETF",
            "rationale": f"Low-risk tier at {current_low:.1f}% vs target {target_low:.1f}% — adding bond allocation for stability.",
            "estimated_value": min(gap, total * 0.10),
            "currency": currency, "priority": "medium",
            "goal_name": None, "tax_note": None,
        })

    for goal in ctx.get("goals", []):
        if goal.get("status") == "at_risk" and goal.get("monthly_contribution_needed"):
            suggestions.append({
                "action": "buy", "asset_type": "fund", "ticker": None,
                "name": f"Contribution: {goal['name']}",
                "rationale": f"Goal '{goal['name']}' is at risk — requires {goal['monthly_contribution_needed']:.0f} {currency}/month.",
                "estimated_value": float(goal["monthly_contribution_needed"]),
                "currency": currency, "priority": "high",
                "goal_name": goal["name"], "tax_note": None,
            })
            break

    if not suggestions:
        suggestions.append({
            "action": "buy", "asset_type": "etf", "ticker": "VWRA.L",
            "name": "Vanguard FTSE All-World ETF",
            "rationale": "Portfolio appears balanced. Consider a regular monthly contribution to maintain allocation targets.",
            "estimated_value": round(total * 0.02, 0) if total > 0 else 1000.0,
            "currency": currency, "priority": "low",
            "goal_name": None, "tax_note": None,
        })

    return suggestions[:5]


def smart_suggest(db: Session, investor_id: uuid.UUID) -> dict:
    import os
    ctx = _build_context(db, investor_id)
    now = datetime.now(timezone.utc)

    if not ctx.get("risk_model") or not ctx.get("portfolio"):
        return {
            "suggestions": [],
            "narrative": "Complete your Risk Model and add portfolio holdings before using Smart Assist.",
            "generated_at": now.isoformat(),
            "has_data": False,
        }

    if not os.getenv("ANTHROPIC_API_KEY"):
        return {
            "suggestions": _deterministic_suggestions(ctx),
            "narrative": "Configure ANTHROPIC_API_KEY to enable AI-powered suggestions. Showing rule-based suggestions.",
            "generated_at": now.isoformat(),
            "has_data": True,
        }

    try:
        import anthropic
        currency = (ctx.get("financial_profile") or {}).get("base_currency", "USD")
        client = anthropic.Anthropic()

        system = (
            "You are a financial allocation assistant. Generate structured, actionable allocation suggestions "
            "based on the investor's portfolio and risk model. Never guarantee returns. "
            "Respond with valid JSON only — no markdown fences, no explanation outside the JSON."
        )
        user = (
            "Analyse this investor's portfolio and suggest 3-5 specific allocation actions.\n\n"
            f"INVESTOR CONTEXT:\n{json.dumps(ctx, indent=2, default=str)}\n\n"
            "Rules:\n"
            "- Respect the risk model tier targets (low_risk_pct, growth_pct, high_risk_pct)\n"
            "- Prioritise at_risk goals\n"
            "- If behavioral_risks contains panic_selling or overtrading, be conservative\n"
            "- If emergency_fund_months < 3, first suggestion must be to build emergency fund\n"
            "- Suggest realistic tickers when appropriate (ETFs: VWRA.L, QQQ, SPY; bonds: AGG, BND)\n\n"
            f'Respond with this JSON:\n{{"narrative":"2-3 sentence strategy overview","suggestions":[{{"action":"buy|sell","asset_type":"etf|stock|bond|fund|crypto","ticker":"TICKER or null","name":"Human name","rationale":"1 sentence","estimated_value":5000.0,"currency":"{currency}","priority":"high|medium|low","goal_name":null,"tax_note":null}}]}}'
        )

        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1500,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        raw = response.content[0].text.strip()
        data = json.loads(raw)

        try:
            from app.ai_usage.logger import log_ai_call
            log_ai_call(
                db=db,
                feature_name="smart_allocation_assist",
                model="claude-haiku-4-5-20251001",
                input_tokens=response.usage.input_tokens,
                output_tokens=response.usage.output_tokens,
                investor_id=investor_id,
            )
        except Exception:
            pass

        return {
            "suggestions": data.get("suggestions", []),
            "narrative": data.get("narrative", ""),
            "generated_at": now.isoformat(),
            "has_data": True,
        }

    except Exception as exc:
        log.warning("[smart_suggest] AI failed (%s) — falling back to deterministic", exc)
        return {
            "suggestions": _deterministic_suggestions(ctx),
            "narrative": "AI suggestions temporarily unavailable. Showing rule-based allocation suggestions.",
            "generated_at": now.isoformat(),
            "has_data": True,
        }

"""Natural language portfolio chat engine.

Gathers real investor data, passes it as context to Claude, and returns
a grounded answer. Never invents data — all claims trace to actual DB values.
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import date

import anthropic
from sqlalchemy.orm import Session

log = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
You are TradeOps AI, a personal financial assistant embedded in a portfolio management platform.
The user is asking questions about their real financial data, which is provided below.

Rules:
- Ground every answer in the data provided. Never invent figures.
- If data is missing, say so explicitly ("I don't have that data yet").
- Do not guarantee returns or imply profit.
- Do not recommend leveraged products, margin, or live trading execution.
- Be concise and direct. 2–4 sentences unless a longer explanation is genuinely needed.
- Use the investor's base currency when quoting amounts.
- If asked about retirement or projections, use the pension projection data if available.
- If asked what action to take, give one clear, safe suggestion grounded in the data.
"""


def _gather_context(db: Session, investor_id: uuid.UUID) -> dict:
    from app.models.investor_profile import InvestorProfile
    from app.portfolio_analysis import service as portfolio_service
    from app.risk_modeling.service import get_latest as get_latest_risk_model
    from app.goals_analysis.service import compute_goals_analysis

    investor = db.get(InvestorProfile, investor_id)
    if not investor:
        return {}

    ctx: dict = {
        "investor": {
            "name": investor.full_name,
            "age": (date.today() - investor.date_of_birth).days // 365,
            "country": investor.country,
            "base_currency": investor.base_currency,
            "experience_level": investor.experience_level.value,
            "is_minor": investor.is_minor,
        }
    }

    portfolio = portfolio_service.get_portfolio(db, investor_id)
    if portfolio and portfolio.total_current_value > 0:
        ctx["portfolio"] = {
            "total_cost_basis": portfolio.total_cost_basis,
            "total_current_value": portfolio.total_current_value,
            "unrealized_pnl": portfolio.unrealized_pnl,
            "unrealized_pnl_pct": portfolio.unrealized_pnl_pct,
            "base_currency": portfolio.base_currency,
            "asset_allocation": portfolio.asset_allocation,
            "currency_exposure": portfolio.currency_exposure,
            "account_count": len(portfolio.accounts),
        }

    risk_model = get_latest_risk_model(db, investor_id)
    if risk_model:
        ctx["risk_model"] = {
            "stability_score": risk_model.stability_score,
            "stability_classification": risk_model.stability_classification,
            "total_net_worth": risk_model.total_net_worth,
            "investable_capital": risk_model.investable_capital,
            "allocation": {
                "low_risk_pct": risk_model.low_risk_pct,
                "growth_pct": risk_model.growth_pct,
                "high_risk_pct": risk_model.high_risk_pct,
            },
        }

    try:
        goals_analysis = compute_goals_analysis(db, investor_id)
        if goals_analysis and goals_analysis.goals:
            ctx["goals"] = [
                {
                    "name": g.name,
                    "progress_pct": g.progress_pct,
                    "on_track": g.on_track,
                    "status": g.status,
                    "months_to_target": g.months_to_target,
                    "monthly_contribution_needed": g.monthly_contribution_needed,
                    "gap": g.gap,
                    "currency": g.currency,
                }
                for g in goals_analysis.goals
            ]
            ctx["goals_summary"] = {
                "total_monthly_needed": goals_analysis.total_monthly_contribution_needed,
                "monthly_surplus": goals_analysis.monthly_surplus,
            }
    except Exception:
        pass

    return ctx


def chat(
    db: Session,
    investor_id: uuid.UUID,
    message: str,
    history: list[dict],
    api_key: str,
) -> tuple[str, dict | None]:
    """Return (reply_text, optional_data_dict)."""
    context = _gather_context(db, investor_id)

    system = _SYSTEM_PROMPT + f"\n\nInvestor data (JSON):\n{json.dumps(context, indent=2, default=str)}"

    messages = list(history) + [{"role": "user", "content": message}]

    try:
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            system=system,
            messages=messages,
        )
        reply = response.content[0].text.strip()
    except Exception as exc:
        log.error("portfolio_chat: AI call failed: %s", exc)
        reply = "I'm unable to process your question right now. Please try again in a moment."

    return reply, None

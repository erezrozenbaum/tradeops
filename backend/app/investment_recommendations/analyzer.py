"""AI-powered investment recommendation engine.

Sends investor context + curated catalog to Claude and returns
personalised instrument recommendations with educational rationale.
"""
import json

import anthropic

from app.market_scanner.catalog import CATALOG

_SYSTEM_PROMPT = """\
You are an investment guidance assistant for TradeOps AI, a personal financial intelligence platform.
Your role is to analyse an investor's full financial context and portfolio, then provide personalised,
specific, and educational investment guidance drawn from a curated instrument catalog.

Strict rules:
- NEVER guarantee returns or imply profit promises.
- NEVER recommend leveraged products, margin, options, futures, or shorting.
- ONLY recommend instruments from the provided catalog — do not invent tickers or names.
- If financial stability score is below 40, focus portfolio_actions on emergency fund and debt reduction.
- If the investor is a minor, only suggest preservation/education instruments.
- Be honest about risks. Every recommendation must acknowledge its downside.
- Recommendations must reflect the investor's current holdings, risk model, and portfolio gaps.
- Do NOT reference the words "JSON", "context", or "catalog" in your output text.
- Do NOT recommend more high_risk instruments than the risk model allows.

Respond ONLY with a valid JSON object with exactly these keys:
{
  "overall_guidance": "<2-3 paragraph honest, human assessment — where this investor stands, what they should prioritise, and what opportunities exist given their specific situation>",
  "portfolio_actions": [
    {
      "action": "<short imperative action, e.g. Reduce crypto exposure>",
      "rationale": "<why this action matters specifically for this investor>",
      "urgency": "<immediate|soon|when_convenient>"
    }
  ],
  "recommendations": [
    {
      "ticker": "<ticker exactly as in catalog>",
      "name": "<instrument full name>",
      "asset_type": "<etf|stock|crypto|bond|fund>",
      "risk_level": "<low|moderate|high|very_high>",
      "why_fits": "<1-2 sentences explaining why this instrument fits THIS investor's profile, gaps, and goals — be specific>",
      "suggested_allocation_pct": <float: suggested % of investable capital, or null if not applicable>,
      "educational_note": "<1-2 plain-language sentences explaining what this instrument is for someone who may not know it>",
      "action": "<consider|increase|start_position>",
      "is_new_to_you": <true if ticker is NOT in current_holdings, false if they already hold it>
    }
  ],
  "disclaimer": "This is educational guidance only. Always conduct your own research and consider consulting a licensed financial adviser before making investment decisions."
}

Rules for the recommendations array:
- Include 3 to 6 instruments total.
- Prioritise instruments that address portfolio tier gaps.
- At least 1 recommendation should be a discovery instrument (is_new_to_you: true) when appropriate for the profile.
- Use action = "increase" only for instruments the investor already holds.
- Use action = "start_position" for new high-conviction fits; "consider" for secondary suggestions.
- Do not recommend very_high risk instruments to conservative or beginner investors.
- The portfolio_actions array should have 2 to 4 items.

Do not include markdown, code fences, or any text outside the JSON object.
"""


def _build_catalog_summary() -> list[dict]:
    return [
        {
            "ticker": i.ticker,
            "name": i.name,
            "asset_type": i.asset_type,
            "risk_level": i.risk_level,
            "asset_family": i.asset_family,
            "market": i.market,
            "currency": i.currency,
            "typical_horizon": i.typical_horizon,
            "suitable_for_beginners": i.suitable_for_beginners,
            "brief_rationale": i.brief_rationale,
        }
        for i in CATALOG
    ]


def generate_recommendations(context: dict, api_key: str) -> dict:
    client = anthropic.Anthropic(api_key=api_key)
    context_json = json.dumps(context, indent=2, default=str)

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2048,
        system=_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": (
                    "Generate personalised investment recommendations for the following investor.\n\n"
                    f"```json\n{context_json}\n```"
                ),
            }
        ],
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        parts = raw.split("```", 2)
        raw = parts[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
        if raw.endswith("```"):
            raw = raw[:-3].strip()

    return json.loads(raw)


def build_recommendation_context(
    investor,
    financial_profile,
    risk_model,
    portfolio_summary,
    rebalance_result,
    goals_analysis,
    current_tickers: set[str],
) -> dict:
    ctx: dict = {
        "investor": {
            "experience_level": investor.experience_level.value,
            "is_minor": investor.is_minor,
            "base_currency": investor.base_currency,
            "country": investor.country,
        },
        "current_holdings": sorted(current_tickers),
        "available_catalog": _build_catalog_summary(),
    }

    if financial_profile:
        surplus = financial_profile.monthly_income - financial_profile.monthly_expenses
        ctx["financial_profile"] = {
            "monthly_surplus": round(surplus, 2),
            "emergency_fund_months": financial_profile.emergency_fund_months,
            "investable_capital_pct": financial_profile.investable_capital_pct,
            "currency": financial_profile.currency,
        }

    if risk_model:
        ctx["risk_model"] = {
            "stability_score": risk_model.stability_score,
            "classification": risk_model.stability_classification,
            "investable_capital": risk_model.investable_capital,
            "currency": risk_model.currency,
            "allocation": {
                "low_risk_pct": risk_model.low_risk_pct,
                "growth_pct": risk_model.growth_pct,
                "high_risk_pct": risk_model.high_risk_pct,
            },
            "live_trading_allowed": risk_model.live_trading_allowed,
        }

    if portfolio_summary and portfolio_summary.total_current_value > 0:
        ctx["portfolio"] = {
            "total_current_value": portfolio_summary.total_current_value,
            "unrealized_pnl_pct": portfolio_summary.unrealized_pnl_pct,
            "asset_allocation": portfolio_summary.asset_allocation,
            "currency_exposure": portfolio_summary.currency_exposure,
        }

    if rebalance_result and rebalance_result.tiers:
        ctx["portfolio_gaps"] = [
            {
                "tier": t.tier,
                "target_pct": t.target_pct,
                "actual_pct": t.actual_pct,
                "delta_pct": t.delta_pct,
                "action": t.action,
            }
            for t in rebalance_result.tiers
        ]

    if goals_analysis and goals_analysis.goals:
        ctx["goals"] = [
            {
                "name": g.name,
                "status": g.status,
                "progress_pct": g.progress_pct,
                "monthly_contribution_needed": g.monthly_contribution_needed,
                "gap": g.gap,
            }
            for g in goals_analysis.goals
        ]

    return ctx

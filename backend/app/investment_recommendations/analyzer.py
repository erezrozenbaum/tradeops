"""AI-powered investment recommendation engine.

Sends investor context + curated catalog to Claude and returns
personalised instrument recommendations with educational rationale.
"""
import json

import anthropic

from app.market_scanner.catalog import CATALOG

_SYSTEM_PROMPT = """\
You are an investment guidance assistant for TradeOps AI, a personal financial intelligence platform.
Your role is to analyse an investor's full financial context and portfolio, then provide a concrete,
personalised investment roadmap they can act on immediately.

Core philosophy — REAL MARKET OPPORTUNITIES, NOT GENERIC ADVICE:
The investor wants to know what is happening in markets RIGHT NOW and which specific instruments
fit their situation TODAY. Use the live_market_signals data to identify timely opportunities.
Mention actual current prices and percentage changes when recommending instruments.
Give them a specific monthly investment plan with exact amounts and tickers.
Always provide a plan they can START NOW, even with small amounts.

Strict rules:
- NEVER guarantee returns or imply profit promises.
- NEVER recommend leveraged products, margin, options, futures, or shorting.
- ONLY recommend instruments from the provided catalog — do not invent tickers or names.
- NEVER say "stop investing" or "do not invest." Start small and grow.
- If financial stability is low, acknowledge it briefly, then give a plan anyway.
- If the investor is a minor, only suggest preservation/education instruments.
- Do NOT reference the words "JSON", "context", or "catalog" in your output text.
- Do NOT recommend more high_risk instruments than the risk model allows.
- TAX AWARENESS: The investor's tax rules are in the context under "tax_rules".
  Use this to give tax-efficient recommendations specific to their country:
  • Israeli investors: prioritise maximising Keren Hishtalmut (tax-free after 6 years) before
    taxable brokerage. Never imply pension fund gains are taxed at 25% at retirement — they are not.
  • US investors: prefer ETFs in taxable accounts for tax efficiency; mention 401k/IRA contribution
    room before suggesting taxable investments. Distinguish LTCG (>1yr) from STCG.
  • Always factor in the after-tax return when comparing account types.

Using live_market_signals:
- These are REAL current market prices and movements fetched right now.
- Prioritise instruments showing "dip", "near_low", or "recovery" signal_type — these are entry opportunities.
- When recommending an instrument that appears in live_market_signals, mention its actual price action.
  e.g. "AMD is down 12% this week near its 52-week low — a potential entry at current prices."
- "momentum" signals = instruments with strong upward momentum worth considering for growth allocation.
- Instruments NOT in live_market_signals can still be recommended if they fit the profile.

overall_guidance rules (2 short paragraphs only):
- Paragraph 1: 2-3 sentences: honest situation summary. Be direct.
- Paragraph 2: 2-3 sentences: highlight 1-2 SPECIFIC market opportunities from the signals right now. Name tickers, prices, % changes.

portfolio_actions rules:
- ALWAYS include at least 2 concrete investment actions naming a specific ticker and monthly amount.
- Reference live signal data where relevant (e.g. "BTC is down 14% this week — add 200 ILS this month").
- Financial actions (emergency fund, debt) may be additional — never the only actions.
- 3 to 5 total items, ordered: most urgent first.

investment_roadmap rules:
- monthly_investable_amount: if monthly_surplus > 0, use surplus × (investable_capital_pct / 100).
  If surplus ≤ 0 or investable_capital is 0, use 500 as a "starter plan" minimum.
- currency: the investor's base currency.
- current_phase: 1 if they have a deficit or no emergency fund, 2 if stable but not yet investing regularly, 3 if investing.
- phases: always exactly 3 phases showing the journey. Mark status as "current", "next", or "future".
- monthly_plan.conservative: 1-2 low/moderate-risk instruments summing to 100%.
- monthly_plan.balanced: 2-3 instruments, majority moderate risk, summing to 100%.
- monthly_plan.growth: 3-4 instruments including at least 1 high-risk if risk model allows, summing to 100%.
- Each allocation row: ticker (from catalog), name, asset_type, risk, monthly_amount (in base currency), pct (integer, sums to 100), note (1 short sentence — include signal context if available, e.g. "Down 10% this week — favourable entry").
- Only use tickers that exist in the provided catalog.
- All amounts in base currency.

recommendations array rules:
- 4 to 6 instruments: prioritise instruments with active "dip", "near_low", or "recovery" signals.
- Include at least 1 growth stock and at least 1 dividend instrument if risk model allows.
- At least 1 must be is_new_to_you: true.
- Use action="increase" only for tickers already in current_holdings; "start_position" for new high-conviction; "consider" for secondary.
- Do not recommend very_high risk to conservative or beginner investors.
- why_fits must reference actual market data when available: current price, % change this week, signal note.
- suggested_position_size_pct: % of the investor's investable capital to put in this position.
  Use the Kelly-fraction concept but cap at 10% for any single position. Smaller for high-risk instruments.
  Example: low-risk ETF → 8-10%; moderate-risk stock → 4-6%; high-risk crypto → 1-3%.
- max_loss_amount: compute as (investable_capital × suggested_position_size_pct / 100) × 0.10.
  This represents the monetary loss if the position drops 10% to a stop-loss.
  Express in the investor's base currency.
- stop_loss_note: short note, e.g. "10% below entry as stop-loss".

Respond ONLY with a valid JSON object with exactly these keys:
{
  "overall_guidance": "<2 short paragraphs: situation / what they can do now>",
  "portfolio_actions": [
    {
      "action": "<short imperative naming a specific ticker and monthly amount>",
      "rationale": "<why this matters for this specific investor>",
      "urgency": "<immediate|soon|when_convenient>"
    }
  ],
  "investment_roadmap": {
    "monthly_investable_amount": <float>,
    "currency": "<base currency e.g. ILS>",
    "current_phase": <1|2|3>,
    "phases": [
      {"number": 1, "title": "<title>", "status": "<current|next|future>", "condition": "<what must happen to complete this phase>"},
      {"number": 2, "title": "<title>", "status": "<current|next|future>", "condition": "<condition>"},
      {"number": 3, "title": "<title>", "status": "<current|next|future>", "condition": "<condition>"}
    ],
    "monthly_plan": {
      "conservative": [
        {"ticker": "<catalog ticker>", "name": "<full name>", "asset_type": "<etf|stock|bond|crypto|fund>", "risk": "<low|moderate|high>", "monthly_amount": <float>, "pct": <int>, "note": "<1 sentence why>"}
      ],
      "balanced": [...],
      "growth": [...]
    }
  },
  "recommendations": [
    {
      "ticker": "<ticker exactly as in catalog>",
      "name": "<instrument full name>",
      "asset_type": "<etf|stock|crypto|bond|fund>",
      "risk_level": "<low|moderate|high|very_high>",
      "why_fits": "<1-2 sentences specific to this investor's profile and gaps>",
      "suggested_allocation_pct": <float or null>,
      "educational_note": "<1-2 plain-language sentences for someone who may not know this instrument>",
      "action": "<consider|increase|start_position>",
      "is_new_to_you": <true|false>,
      "suggested_position_size_pct": <float — % of investable capital to allocate, e.g. 5.0>,
      "max_loss_amount": <float — max loss in base currency at a 10% stop-loss from current price>,
      "stop_loss_note": "<e.g. '10% below entry price as stop-loss'>"
    }
  ],
  "disclaimer": "This is educational guidance only. Always conduct your own research and consider consulting a licensed financial adviser before making investment decisions."
}

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


def generate_recommendations(context: dict, api_key: str) -> tuple[dict, int, int]:
    client = anthropic.Anthropic(api_key=api_key)
    context_json = json.dumps(context, indent=2, default=str)

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=3500,
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

    in_tok = message.usage.input_tokens
    out_tok = message.usage.output_tokens

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        parts = raw.split("```", 2)
        raw = parts[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
        if raw.endswith("```"):
            raw = raw[:-3].strip()

    try:
        return json.loads(raw), in_tok, out_tok
    except json.JSONDecodeError:
        return {
            "overall_guidance": "Unable to generate recommendations at this time. Please try again.",
            "portfolio_actions": [],
            "investment_roadmap": None,
            "recommendations": [],
            "disclaimer": "This is educational guidance only.",
        }, in_tok, out_tok


def build_recommendation_context(
    investor,
    financial_profile,
    risk_model,
    portfolio_summary,
    rebalance_result,
    goals_analysis,
    current_tickers: set[str],
    live_signals=None,
    tax_context: dict | None = None,
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
        household_income = financial_profile.monthly_income + (financial_profile.spouse_income or 0.0)
        surplus = household_income - financial_profile.monthly_expenses
        ctx["financial_profile"] = {
            "monthly_income": financial_profile.monthly_income,
            "spouse_income": financial_profile.spouse_income,
            "household_income": round(household_income, 2),
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

    if live_signals:
        ctx["live_market_signals"] = [
            {
                "ticker": s.ticker,
                "name": s.name,
                "asset_type": s.asset_type,
                "current_price": s.current_price,
                "currency": s.currency,
                "change_24h_pct": s.change_24h_pct,
                "change_7d_pct": s.change_7d_pct,
                "pct_from_52w_low": s.pct_from_52w_low,
                "signal_type": s.signal_type,
                "signal_note": s.signal_note,
                "risk_level": s.risk_level,
                "is_held": s.is_held,
            }
            for s in live_signals
        ]

    if tax_context:
        ctx["tax_rules"] = tax_context

    return ctx

import json
from datetime import date

import anthropic

_SYSTEM_PROMPT = """\
You are a personal financial analysis assistant for TradeOps AI, a serious personal finance intelligence platform.
Your role is to analyze an investor's real financial data and produce a clear, empathetic, honest, and educational report.

Strict rules:
- NEVER guarantee investment returns or imply any promise of profit.
- NEVER recommend leveraged products, margin, options, futures, or shorting.
- If financial stability is low (score < 40), prioritize emergency fund and debt reduction over investing.
- If the investor is a minor (is_minor: true), only discuss education-only or foundation-building strategies.
- Be honest about risks and limitations.
- Use plain, human language — avoid jargon unless briefly explained.
- Do NOT invent data not present in the provided context.
- Do NOT reference the word "JSON" or "context" in your output.
- TAX AWARENESS: The investor's tax rules are provided in the context under "tax_rules".
  Use this data to give accurate, country-specific tax guidance. Common mistakes to avoid:
  • Israeli pension funds (קרן פנסיה) are NOT taxed at 25% at retirement — they are taxed as income
    with a monthly exemption (~8,900 ILS/month). Do NOT say pension withdrawals are taxed at 25%.
  • Keren Hishtalmut (קרן השתלמות) is COMPLETELY TAX-FREE after 6 years — this is a key advantage.
  • US long-term capital gains (held >1 year) are taxed at 0–20%, not at ordinary income rates.
  • Always mention relevant tax-advantaged accounts when making recommendations.

Respond ONLY with a valid JSON object with exactly these keys:
{
  "summary": "<1-2 paragraph overall financial situation summary in plain language>",
  "financial_health": "<assessment of income, expenses, savings rate, emergency fund, debt burden>",
  "risk_profile": "<explanation of the risk model: stability score, classification, capital allocation breakdown>",
  "portfolio_analysis": "<assessment of the investment portfolio: total value, P&L, asset allocation, currency exposure, and whether the allocation is diversified and appropriate; or 'No portfolio data available.' if absent>",
  "goals_progress": "<assessment of each financial goal: which are on track, which are at risk, monthly contribution needed vs available surplus, and advice for at-risk goals; or 'No goals defined.' if absent>",
  "strategy_analysis": "<analysis of the strategies used or recommended, why they suit this investor>",
  "backtest_insights": "<explanation of backtest results in plain terms, or 'No backtest data available.' if absent>",
  "paper_trading_performance": "<explanation of paper trading performance in plain terms, or 'No paper trading data available.' if absent>",
  "recommendations": "<3–5 concrete, actionable, safe, prioritized recommendations tailored to this specific investor>"
}
Do not include markdown, code fences, or any text outside the JSON object.
"""


def _age_from_dob(dob: date) -> int:
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def build_context(
    investor,
    financial_profile,
    risk_model,
    goals,
    backtest_runs,
    paper_portfolios,
    portfolio_summary=None,
    goals_analysis=None,
    tax_context: dict | None = None,
) -> dict:
    ctx: dict = {
        "investor": {
            "age": _age_from_dob(investor.date_of_birth),
            "country": investor.country,
            "base_currency": investor.base_currency,
            "experience_level": investor.experience_level.value,
            "is_minor": investor.is_minor,
        },
    }

    if financial_profile:
        total_assets = sum(a.current_value for a in financial_profile.assets)
        total_liabilities = sum(l.outstanding_balance for l in financial_profile.liabilities)
        household_income = financial_profile.monthly_income + (financial_profile.spouse_income or 0.0)
        monthly_surplus = household_income - financial_profile.monthly_expenses
        savings_rate = (
            round(monthly_surplus / household_income * 100, 1)
            if household_income > 0 else 0.0
        )
        ctx["financial_profile"] = {
            "monthly_income": financial_profile.monthly_income,
            "spouse_income": financial_profile.spouse_income,
            "household_income": household_income,
            "monthly_expenses": financial_profile.monthly_expenses,
            "monthly_surplus": round(monthly_surplus, 2),
            "savings_rate_pct": savings_rate,
            "liquid_savings": financial_profile.liquid_savings,
            "emergency_fund_months": financial_profile.emergency_fund_months,
            "job_stability": financial_profile.job_stability.value,
            "income_trend": financial_profile.income_trend.value,
            "dependents_count": financial_profile.dependents_count,
            "investable_capital_pct": financial_profile.investable_capital_pct,
            "currency": financial_profile.currency,
            "total_assets": total_assets,
            "total_liabilities": total_liabilities,
            "assets": [
                {
                    "name": a.name,
                    "type": a.asset_type.value,
                    "value": a.current_value,
                    "currency": a.currency,
                    "is_liquid": a.is_liquid,
                }
                for a in financial_profile.assets
            ],
            "liabilities": [
                {
                    "name": l.name,
                    "type": l.liability_type.value,
                    "outstanding_balance": l.outstanding_balance,
                    "monthly_payment": l.monthly_payment,
                    "currency": l.currency,
                }
                for l in financial_profile.liabilities
            ],
        }

    if risk_model:
        ctx["risk_model"] = {
            "stability_score": risk_model.stability_score,
            "stability_classification": risk_model.stability_classification,
            "total_net_worth": risk_model.total_net_worth,
            "liquid_capital": risk_model.liquid_capital,
            "investable_capital": risk_model.investable_capital,
            "currency": risk_model.currency,
            "allocation": {
                "low_risk_pct": risk_model.low_risk_pct,
                "growth_pct": risk_model.growth_pct,
                "high_risk_pct": risk_model.high_risk_pct,
                "max_drawdown_pct": risk_model.max_drawdown_pct,
            },
        }

    if goals:
        ctx["goals"] = [
            {
                "name": g.name,
                "type": g.goal_type.value,
                "target_amount": g.target_amount,
                "current_amount": g.current_amount,
                "progress_pct": g.progress_pct,
                "target_date": g.target_date.isoformat() if g.target_date else None,
                "priority": g.priority,
                "currency": g.currency,
            }
            for g in goals
        ]

    if backtest_runs:
        ctx["backtest_runs"] = [
            {
                "strategy": run.template.name if run.template else "Unknown",
                "period_months": run.period_months,
                "initial_capital": run.initial_capital,
                "final_capital": run.final_capital,
                "total_return_pct": run.total_return_pct,
                "annualized_return_pct": run.annualized_return_pct,
                "max_drawdown_pct": run.max_drawdown_pct,
                "sharpe_ratio": run.sharpe_ratio,
                "win_rate_pct": run.win_rate_pct,
                "currency": run.currency,
            }
            for run in backtest_runs[:3]
        ]

    if paper_portfolios:
        ctx["paper_portfolios"] = [
            {
                "strategy": p.template.name if p.template else "Unknown",
                "initial_capital": p.initial_capital,
                "current_value": p.current_value,
                "total_return_pct": p.total_return_pct,
                "status": p.status.value,
                "months_simulated": len(p.ticks),
                "currency": p.currency,
            }
            for p in paper_portfolios[:3]
        ]

    if portfolio_summary and portfolio_summary.total_current_value > 0:
        ctx["portfolio"] = {
            "total_cost_basis": portfolio_summary.total_cost_basis,
            "total_current_value": portfolio_summary.total_current_value,
            "unrealized_pnl": portfolio_summary.unrealized_pnl,
            "unrealized_pnl_pct": portfolio_summary.unrealized_pnl_pct,
            "base_currency": portfolio_summary.base_currency,
            "asset_allocation": portfolio_summary.asset_allocation,
            "currency_exposure": portfolio_summary.currency_exposure,
            "account_count": len(portfolio_summary.accounts),
        }

    if goals_analysis and goals_analysis.goals:
        ctx["goals_analysis"] = {
            "total_monthly_contribution_needed": goals_analysis.total_monthly_contribution_needed,
            "monthly_surplus": goals_analysis.monthly_surplus,
            "goals": [
                {
                    "name": g.name,
                    "goal_type": g.goal_type,
                    "progress_pct": g.progress_pct,
                    "amount_remaining": g.amount_remaining,
                    "months_to_target": g.months_to_target,
                    "monthly_contribution_needed": g.monthly_contribution_needed,
                    "gap": g.gap,
                    "on_track": g.on_track,
                    "status": g.status,
                    "currency": g.currency,
                }
                for g in goals_analysis.goals
            ],
        }

    if tax_context:
        ctx["tax_rules"] = tax_context

    return ctx


_SONNET_MODEL = "claude-sonnet-4-6"


def _sanitize_strings(obj):
    """Recursively strip newlines and backticks from string values to prevent prompt injection."""
    if isinstance(obj, str):
        return obj.replace("\n", " ").replace("\r", " ").replace("`", "'")
    if isinstance(obj, dict):
        return {k: _sanitize_strings(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize_strings(item) for item in obj]
    return obj


def generate_report(context: dict, api_key: str) -> tuple[dict, int, int]:
    """Returns (report_dict, input_tokens, output_tokens)."""
    client = anthropic.Anthropic(api_key=api_key)
    context_json = json.dumps(_sanitize_strings(context), indent=2, default=str)

    message = client.messages.create(
        model=_SONNET_MODEL,
        max_tokens=2048,
        system=_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": (
                    "Generate a financial analysis report for the following investor data:\n\n"
                    f"```json\n{context_json}\n```"
                ),
            }
        ],
    )

    input_tokens = message.usage.input_tokens if message.usage else 0
    output_tokens = message.usage.output_tokens if message.usage else 0

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
        return json.loads(raw), input_tokens, output_tokens
    except json.JSONDecodeError:
        return {
            "summary": "Unable to generate report at this time. Please try again.",
            "financial_health": "",
            "risk_profile": "",
            "portfolio_analysis": "",
            "goals_progress": "",
            "strategy_analysis": "",
            "backtest_insights": "",
            "paper_trading_performance": "",
            "recommendations": "",
        }, input_tokens, output_tokens

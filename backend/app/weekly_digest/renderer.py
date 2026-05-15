"""Build AI-powered HTML weekly digest email for a single investor."""
from __future__ import annotations

import json
import logging
from datetime import date

import anthropic

log = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
You are a personal financial assistant for TradeOps AI. Generate a concise weekly digest
for an investor. Be warm, honest, and grounded in the data provided.

Rules:
- Never guarantee returns or imply profit.
- Do not invent data not in the context.
- Keep it brief: 3–5 key points max.
- Language should be plain and human, not jargon-heavy.

Respond with valid JSON only:
{
  "headline": "<one-line week summary, e.g. 'Portfolio up 1.2% — goals on track'>",
  "performance": "<1–2 sentences on portfolio performance vs last week or benchmark>",
  "goals": "<1–2 sentences on goal progress>",
  "action": "<1–2 actionable suggestions based on the data, or 'No actions needed this week.' if all is well>",
  "risk_note": "<optional brief risk flag, or null if nothing noteworthy>"
}
No markdown, no code fences, no text outside the JSON.
"""


def _build_context(investor, portfolio_summary, goals_analysis) -> dict:
    ctx: dict = {
        "investor": {
            "name": investor.full_name,
            "age": (date.today() - investor.date_of_birth).days // 365,
            "base_currency": investor.base_currency,
        },
        "week_of": date.today().isoformat(),
    }
    if portfolio_summary and portfolio_summary.total_current_value > 0:
        ctx["portfolio"] = {
            "total_current_value": portfolio_summary.total_current_value,
            "total_cost_basis": portfolio_summary.total_cost_basis,
            "unrealized_pnl": portfolio_summary.unrealized_pnl,
            "unrealized_pnl_pct": portfolio_summary.unrealized_pnl_pct,
            "asset_allocation": portfolio_summary.asset_allocation,
        }
    if goals_analysis and goals_analysis.goals:
        ctx["goals"] = [
            {
                "name": g.name,
                "progress_pct": g.progress_pct,
                "on_track": g.on_track,
                "status": g.status,
            }
            for g in goals_analysis.goals
        ]
    return ctx


def _call_ai(context: dict, api_key: str) -> dict:
    client = anthropic.Anthropic(api_key=api_key)
    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        system=_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": f"Generate a weekly digest for:\n\n{json.dumps(context, indent=2, default=str)}",
            }
        ],
    )
    raw = msg.content[0].text.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {
            "headline": "Your weekly portfolio digest",
            "performance": "Unable to generate analysis. Log in to view your dashboard.",
            "goals": "",
            "action": "",
            "risk_note": None,
        }


def render_html(investor, portfolio_summary, goals_analysis, api_key: str) -> tuple[str, str]:
    """Return (subject, html_body) for the weekly digest email."""
    context = _build_context(investor, portfolio_summary, goals_analysis)
    digest = _call_ai(context, api_key)

    subject = f"TradeOps Weekly — {digest.get('headline', 'Your portfolio digest')}"
    currency = investor.base_currency

    pv = portfolio_summary.total_current_value if portfolio_summary else 0
    pnl = portfolio_summary.unrealized_pnl if portfolio_summary else 0
    pnl_pct = portfolio_summary.unrealized_pnl_pct if portfolio_summary else 0
    pnl_color = "#22c55e" if pnl >= 0 else "#ef4444"
    pnl_sign = "+" if pnl >= 0 else ""

    rows = ""
    if portfolio_summary and portfolio_summary.asset_allocation:
        for asset, pct in sorted(portfolio_summary.asset_allocation.items(), key=lambda x: -x[1]):
            rows += f"<tr><td style='padding:4px 8px;text-transform:capitalize'>{asset.replace('_',' ')}</td><td style='padding:4px 8px;text-align:right'>{pct:.1f}%</td></tr>"

    goals_html = ""
    if goals_analysis and goals_analysis.goals:
        for g in goals_analysis.goals:
            bar_color = "#22c55e" if g.on_track else "#f59e0b"
            pct = min(100, g.progress_pct)
            goals_html += f"""
            <div style='margin-bottom:12px'>
              <div style='display:flex;justify-content:space-between;margin-bottom:4px;font-size:13px'>
                <span>{g.name}</span>
                <span style='color:{bar_color}'>{pct:.0f}%</span>
              </div>
              <div style='background:#e2e8f0;border-radius:4px;height:6px'>
                <div style='background:{bar_color};width:{pct}%;height:6px;border-radius:4px'></div>
              </div>
            </div>"""

    action_html = ""
    if digest.get("action"):
        action_html = f"""
        <div style='background:#eff6ff;border-left:3px solid #3b82f6;padding:12px 16px;border-radius:4px;margin-top:16px'>
          <p style='margin:0;font-size:13px;color:#1e40af'><strong>This week's action:</strong> {digest['action']}</p>
        </div>"""

    risk_html = ""
    if digest.get("risk_note"):
        risk_html = f"""
        <div style='background:#fefce8;border-left:3px solid #eab308;padding:12px 16px;border-radius:4px;margin-top:12px'>
          <p style='margin:0;font-size:13px;color:#854d0e'><strong>Risk note:</strong> {digest['risk_note']}</p>
        </div>"""

    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style='font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#f8fafc;margin:0;padding:24px'>
  <div style='max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)'>

    <!-- Header -->
    <div style='background:#0f172a;padding:24px 32px'>
      <p style='color:#94a3b8;font-size:12px;margin:0 0 4px'>TradeOps AI · Weekly Digest</p>
      <h1 style='color:#f1f5f9;font-size:20px;font-weight:600;margin:0'>{digest.get("headline","Your portfolio digest")}</h1>
    </div>

    <!-- Body -->
    <div style='padding:28px 32px'>

      <!-- Portfolio snapshot -->
      <div style='background:#f8fafc;border-radius:8px;padding:16px 20px;margin-bottom:20px'>
        <p style='font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin:0 0 8px'>Portfolio Value</p>
        <p style='font-size:28px;font-weight:700;margin:0;color:#0f172a'>{currency} {pv:,.2f}</p>
        <p style='font-size:14px;margin:4px 0 0;color:{pnl_color}'>{pnl_sign}{currency} {abs(pnl):,.2f} ({pnl_sign}{abs(pnl_pct):.2f}%)</p>
      </div>

      <!-- Performance -->
      <p style='font-size:14px;color:#334155;line-height:1.6;margin:0 0 16px'>{digest.get("performance","")}</p>

      <!-- Allocation table -->
      {"<p style='font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin:0 0 8px'>Allocation</p><table style='width:100%;font-size:13px;border-collapse:collapse'>"+rows+"</table>" if rows else ""}

      <!-- Goals -->
      {"<p style='font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin:20px 0 8px'>Goal Progress</p>" + goals_html if goals_html else ""}
      {"<p style='font-size:14px;color:#334155;line-height:1.6;margin:4px 0 0'>" + digest.get("goals","") + "</p>" if digest.get("goals") else ""}

      {action_html}
      {risk_html}
    </div>

    <!-- Footer -->
    <div style='border-top:1px solid #e2e8f0;padding:16px 32px;background:#f8fafc'>
      <p style='font-size:11px;color:#94a3b8;margin:0'>
        You're receiving this because Weekly Digest is enabled in your TradeOps settings.
        Log in to your dashboard to act on these insights.
      </p>
    </div>
  </div>
</body>
</html>"""

    return subject, html

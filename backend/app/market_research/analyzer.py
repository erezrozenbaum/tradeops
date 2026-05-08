"""Deep market research AI engine.

Sends screened fundamental data + investor context to Claude and returns
specific, data-backed investment theses across three risk tiers.
"""
import json
import logging

import anthropic

from app.market_research.schemas import (
    OpportunityPick,
    SectorPerformance,
    StockFundamentals,
)

log = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
You are a senior buy-side equity analyst and portfolio strategist for TradeOps AI.

Your task: review a batch of fundamentally screened stocks and construct a concrete,
data-driven investment brief for a specific investor. This is NOT generic ETF advice.
Every recommendation must be grounded in the actual numbers provided.

─── OUTPUT REQUIREMENTS ────────────────────────────────────────────────────────

You must select 12–15 specific instruments distributed across THREE tiers:

TIER 1 — stable (3–4 picks):
  Income + capital preservation. These are dividend payers, deep value stocks trading
  below historical fair value, or index ETFs during drawdowns.
  Target hold period: 18–36 months.

TIER 2 — moderate (5–6 picks):
  Quality growth at a reasonable price. Strong fundamentals, positive revenue growth,
  P/E below 30, clear near-term catalyst (product cycle, sector rotation, earnings recovery).
  Target hold period: 12–24 months.

TIER 3 — high_opportunity (3–4 picks):
  Undervalued or deep-discount positions with a specific re-rating catalyst or high-growth
  potential. These carry more volatility. Analyst upside should be >20%.
  Crypto from `crypto_universe` belongs here — score based on 52-week entry signal and
  market cycle context. Include 1–2 crypto picks if they show a strong entry opportunity.
  Target hold period: 6–18 months (shorter if the thesis plays out faster).

─── THESIS QUALITY REQUIREMENTS ────────────────────────────────────────────────

For every pick, the thesis MUST:
1. State the current valuation metric (e.g., "trades at 11× forward earnings")
2. Compare it to a reference (e.g., "vs. its 5-year average of 16×" or "vs. sector median of 22×")
3. Identify the specific catalyst (e.g., "AI networking upgrade cycle", "biosimilar launch", "margin recovery")
4. State the analyst consensus target and implied upside explicitly
5. Explain the time horizon with a reason (e.g., "18 months — the market cycle for enterprise IT refresh")

why_now MUST reference the current entry signal (e.g., near 52-week low, post-earnings dip,
sector rotation creating undervaluation, recovering from macro-driven sell-off).

key_risk MUST be specific — name the actual risk (competition, patent cliff, rate sensitivity),
not generic phrases like "markets can go down."

─── CONSTRAINTS ────────────────────────────────────────────────────────────────

- For stocks/ETFs: only use tickers from the provided screened_candidates list.
- For crypto: only use tickers from the provided crypto_universe list (if present).
- Do not recommend tickers the investor already holds (current_holdings) unless
  there is a strong "increase position" case — if so, flag it explicitly.
- If the investor's base currency is ILS, include at least 1 TASE-listed stock
  (identified by .TA suffix) if one appears in the top candidates.
- Respect the investor's risk allocation: do not put more picks in high_opportunity
  than the investor's high_risk_pct allows proportionally.
- Never guarantee returns. Never mention leverage, margin, or shorting.
- Do not repeat the word "JSON", "context", or "catalog" in your output.

─── OUTPUT FORMAT ──────────────────────────────────────────────────────────────

Respond ONLY with a valid JSON object with exactly these keys:

{
  "market_overview": "<3–4 sentence macro + sector context. Name specific sectors that are cheap/expensive, macro tailwinds/headwinds. Be specific — mention actual sector performance data if provided.>",
  "stable_picks": [
    {
      "ticker": "<ticker>",
      "name": "<company full name>",
      "sector": "<sector>",
      "asset_type": "<stock|etf>",
      "thesis": "<3–5 sentences referencing actual P/E, growth rates, analyst target, sector context>",
      "why_now": "<1–2 sentences: the specific current entry signal — near 52w low, sector rotation, post-dip, etc.>",
      "time_horizon_months": <integer>,
      "time_horizon_label": "<e.g. '18–24 months'>",
      "key_risk": "<specific risk — not generic>",
      "suggested_allocation_pct": <float, e.g. 8.0>
    }
  ],
  "moderate_picks": [ <same structure> ],
  "opportunity_picks": [ <same structure> ],
  "sector_outlooks": [
    {
      "sector": "<sector name>",
      "outlook": "<bullish|neutral|bearish>",
      "key_theme": "<1 sentence: the specific driver — AI capex, rate cuts, margin recovery, etc.>"
    }
  ],
  "disclaimer": "This is for educational purposes only. Not financial advice. Always conduct your own research and consider consulting a licensed financial adviser."
}

Do not include markdown, code fences, or any text outside the JSON object.
"""


def _build_context(
    candidates: list[StockFundamentals],
    sector_performance: list[SectorPerformance],
    investor_context: dict,
    crypto_candidates: list[StockFundamentals] | None = None,
) -> dict:
    ctx: dict = {
        "investor": investor_context,
        "screened_candidates": [
            {
                "ticker": c.ticker,
                "name": c.name,
                "sector": c.sector,
                "market": c.market,
                "asset_type": c.asset_type,
                "current_price": c.current_price,
                "currency": c.currency,
                "analyst_target": c.analyst_target,
                "analyst_upside_pct": c.analyst_upside_pct,
                "analyst_rating": c.analyst_rating,
                "analyst_count": c.analyst_count,
                "trailing_pe": c.trailing_pe,
                "forward_pe": c.forward_pe,
                "peg_ratio": c.peg_ratio,
                "price_to_book": c.price_to_book,
                "revenue_growth_pct": c.revenue_growth_pct,
                "earnings_growth_pct": c.earnings_growth_pct,
                "profit_margin_pct": c.profit_margin_pct,
                "return_on_equity_pct": c.return_on_equity_pct,
                "dividend_yield_pct": c.dividend_yield_pct,
                "pct_from_52w_low": c.pct_from_52w_low,
                "opportunity_score": c.opportunity_score,
            }
            for c in candidates
        ],
        "sector_performance": [
            {
                "sector": s.sector,
                "etf": s.etf_ticker,
                "perf_1m_pct": s.performance_1m_pct,
                "perf_3m_pct": s.performance_3m_pct,
                "perf_1y_pct": s.performance_1y_pct,
                "current_outlook": s.outlook,
            }
            for s in sector_performance
        ],
    }
    if crypto_candidates:
        ctx["crypto_universe"] = [
            {
                "ticker": c.ticker,
                "name": c.name,
                "asset_type": "crypto",
                "current_price": c.current_price,
                "currency": c.currency,
                "pct_from_52w_low": c.pct_from_52w_low,
                "pct_from_52w_high": c.pct_from_52w_high,
                "opportunity_score": c.opportunity_score,
            }
            for c in crypto_candidates
        ]
    return ctx


def _parse_picks(raw_list: list, candidates_map: dict[str, StockFundamentals], tier: str) -> list[OpportunityPick]:
    picks: list[OpportunityPick] = []
    for item in raw_list:
        ticker = item.get("ticker", "")
        candidate = candidates_map.get(ticker)
        try:
            picks.append(OpportunityPick(
                ticker=ticker,
                name=item.get("name") or (candidate.name if candidate else ticker),
                sector=item.get("sector") or (candidate.sector if candidate else ""),
                asset_type=item.get("asset_type") or (candidate.asset_type if candidate else "stock"),
                current_price=candidate.current_price if candidate else None,
                currency=candidate.currency if candidate else "USD",
                analyst_target=candidate.analyst_target if candidate else None,
                upside_pct=candidate.analyst_upside_pct if candidate else None,
                risk_tier=tier,
                time_horizon_months=int(item.get("time_horizon_months") or 12),
                time_horizon_label=item.get("time_horizon_label") or "12 months",
                thesis=item.get("thesis") or "",
                why_now=item.get("why_now") or "",
                key_risk=item.get("key_risk") or "",
                suggested_allocation_pct=item.get("suggested_allocation_pct"),
                opportunity_score=candidate.opportunity_score if candidate else 0.0,
                key_metrics={
                    "forward_pe": candidate.forward_pe if candidate else None,
                    "revenue_growth_pct": candidate.revenue_growth_pct if candidate else None,
                    "analyst_upside_pct": candidate.analyst_upside_pct if candidate else None,
                    "dividend_yield_pct": candidate.dividend_yield_pct if candidate else None,
                    "pct_from_52w_low": candidate.pct_from_52w_low if candidate else None,
                    "profit_margin_pct": candidate.profit_margin_pct if candidate else None,
                },
            ))
        except Exception as exc:
            log.warning("Failed to parse pick %s: %s", ticker, exc)
    return picks


def generate_research(
    candidates: list[StockFundamentals],
    sector_performance: list[SectorPerformance],
    investor_context: dict,
    api_key: str,
    crypto_candidates: list[StockFundamentals] | None = None,
) -> dict:
    client = anthropic.Anthropic(api_key=api_key)
    context = _build_context(candidates, sector_performance, investor_context, crypto_candidates)
    context_json = json.dumps(context, indent=2, default=str)

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=8096,
        system=_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": (
                    "Analyse the following screened universe and produce a deep market research brief "
                    "for this investor. Use only the data provided — reference actual numbers in every thesis.\n\n"
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
        raw = raw.strip().rstrip("`").strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        log.error("[market_research] Claude returned invalid JSON (len=%d, preview=%s) — using fallback", len(raw), raw[:200])
        return {
            "market_overview": "Market analysis temporarily unavailable. Please try again.",
            "stable_picks": [],
            "moderate_picks": [],
            "opportunity_picks": [],
            "sector_outlooks": [],
            "disclaimer": "This is for educational purposes only. Not financial advice.",
        }

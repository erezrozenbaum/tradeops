"""Daily Market Signal Sentiment Worker.

Runs once per day (registered in scheduler.py at 20:15 UTC, after price refresh).
For each investor with tickered holdings:
  - Fetches yfinance news headlines per unique ticker
  - Batches all headlines into one Claude Haiku call per ticker
  - Runs Personal Signal Guard
  - Stores result in market_signals (idempotent — skips if record already exists for today)

Cost: one Claude Haiku call per unique ticker per day across the entire user base.
Skipped entirely if ANTHROPIC_API_KEY is not set.
"""
import json
import logging
from datetime import date, datetime, timezone

log = logging.getLogger(__name__)

_HAIKU_MODEL = "claude-haiku-4-5-20251001"
_MAX_HEADLINES = 8   # cap per ticker to control token cost


def _fetch_news(ticker: str) -> list[str]:
    """Return up to _MAX_HEADLINES recent headline strings from yfinance."""
    try:
        import yfinance as yf
        news = yf.Ticker(ticker).news or []
        headlines = []
        for item in news[:_MAX_HEADLINES]:
            title = item.get("title") or item.get("content", {}).get("title", "")
            if title:
                headlines.append(title)
        return headlines
    except Exception as exc:
        log.warning("[signal_worker] yfinance news fetch failed for %s: %s", ticker, exc)
        return []


def _call_claude(
    ticker: str,
    headlines: list[str],
    position_value: float,
    position_pct: float,
    unrealized_pnl: float,
    holding_days: int,
    currency: str,
    api_key: str,
) -> tuple[dict | None, int, int]:
    """Single Claude Haiku call. Returns (parsed dict or None, input_tokens, output_tokens)."""
    try:
        import anthropic
        headlines_text = "\n".join(f"- {h}" for h in headlines)
        tax_term = "long-term" if holding_days >= 365 else "short-term"

        prompt = (
            f"You are a financial news analyst for a personal finance app.\n\n"
            f"Analyze these recent headlines for {ticker}:\n{headlines_text}\n\n"
            f"Investor context:\n"
            f"- Position: {currency} {position_value:,.0f} ({position_pct:.1f}% of portfolio)\n"
            f"- Unrealized P&L: {currency} {unrealized_pnl:+,.0f}\n"
            f"- Holding period: {holding_days} days ({tax_term} for tax purposes)\n\n"
            f"Tasks:\n"
            f"1. Rate overall sentiment: -1.0 (very bearish) to +1.0 (very bullish)\n"
            f"2. Detect if any headline mentions institutional investors "
            f"(hedge funds, Berkshire, BlackRock, Vanguard, sovereign funds, etc.)\n"
            f"3. Write a 2-3 sentence personalized rationale that summarises the key news, "
            f"references their specific position size and P&L, and notes whale activity if detected.\n\n"
            f"Respond with valid JSON only — no markdown, no extra text:\n"
            f'{{"sentiment_score": float, "signal_type": "WHALE_MENTION" or "NEWS_SENTIMENT", '
            f'"rationale": "...", "whale_entities": []}}'
        )

        client = anthropic.Anthropic(api_key=api_key)
        msg = client.messages.create(
            model=_HAIKU_MODEL,
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}],
        )
        input_tokens = msg.usage.input_tokens if msg.usage else 0
        output_tokens = msg.usage.output_tokens if msg.usage else 0
        raw = msg.content[0].text.strip() if msg.content else ""
        return json.loads(raw), input_tokens, output_tokens
    except Exception as exc:
        log.warning("[signal_worker] Claude call failed for %s: %s", ticker, exc)
        return None, 0, 0


def run_daily_sentiment() -> None:
    """Entry point called by the APScheduler job."""
    from app.core.config import settings
    from app.db.session import SessionLocal
    from app.models.investor_profile import InvestorProfile
    from app.models.investment_account import InvestmentAccount
    from app.models.market_signal import MarketSignal
    from app.market_signals.guard import (
        evaluate_signal, compute_composite_score, compute_trend_direction,
    )
    from app.portfolio_analysis.service import get_portfolio
    from app.risk_modeling.service import get_latest as get_latest_risk_model
    from sqlalchemy import and_

    if not settings.ANTHROPIC_API_KEY:
        log.info("[signal_worker] ANTHROPIC_API_KEY not set — skipping sentiment worker")
        return

    today = date.today()
    db = SessionLocal()

    try:
        # All investors with at least one tickered holding
        investor_ids = (
            db.query(InvestorProfile.id)
            .join(InvestmentAccount, InvestmentAccount.investor_id == InvestorProfile.id)
            .distinct()
            .all()
        )
        investor_ids = [row[0] for row in investor_ids]
        log.info("[signal_worker] Processing %d investors", len(investor_ids))

        total_written = 0
        total_skipped = 0

        for investor_id in investor_ids:
            try:
                investor = db.get(InvestorProfile, investor_id)
                if not investor:
                    continue

                # Skip investors whose AI budget is exhausted
                try:
                    from app.ai_usage.logger import check_monthly_budget
                    check_monthly_budget(db, investor_id)
                except Exception:
                    log.info("[signal_worker] Budget exhausted for investor %s — skipping", investor_id)
                    continue

                portfolio = get_portfolio(db, investor_id)
                if not portfolio or portfolio.total_current_value <= 0:
                    continue

                risk_model = get_latest_risk_model(db, investor_id)
                stability_score = risk_model.stability_score if risk_model else 0

                # Build ticker→holding context map
                ticker_context: dict[str, dict] = {}
                for acc in portfolio.accounts:
                    for h in acc.holdings:
                        if not h.ticker:
                            continue
                        pct = (
                            h.current_value_base / portfolio.total_current_value * 100
                            if portfolio.total_current_value > 0 else 0.0
                        )
                        holding_days = 0
                        if h.purchase_date:
                            holding_days = (date.today() - h.purchase_date).days
                        if h.ticker not in ticker_context:
                            ticker_context[h.ticker] = {
                                "value": h.current_value_base,
                                "pct": pct,
                                "pnl": h.unrealized_pnl,
                                "days": holding_days,
                            }
                        else:
                            # Accumulate across multiple accounts
                            ticker_context[h.ticker]["value"] += h.current_value_base
                            ticker_context[h.ticker]["pct"] += pct
                            ticker_context[h.ticker]["pnl"] += h.unrealized_pnl

                for ticker, ctx in ticker_context.items():
                    # Skip if we already have a signal for this ticker today
                    existing = (
                        db.query(MarketSignal)
                        .filter(and_(
                            MarketSignal.investor_id == investor_id,
                            MarketSignal.ticker == ticker,
                            MarketSignal.signal_date == today,
                        ))
                        .first()
                    )
                    if existing:
                        total_skipped += 1
                        continue

                    headlines = _fetch_news(ticker)
                    if not headlines:
                        continue

                    result, in_tok, out_tok = _call_claude(
                        ticker=ticker,
                        headlines=headlines,
                        position_value=ctx["value"],
                        position_pct=ctx["pct"],
                        unrealized_pnl=ctx["pnl"],
                        holding_days=ctx["days"],
                        currency=portfolio.base_currency,
                        api_key=settings.ANTHROPIC_API_KEY,
                    )
                    if not result:
                        continue

                    sentiment_score = float(result.get("sentiment_score", 0.0))
                    sentiment_score = max(-1.0, min(1.0, sentiment_score))
                    signal_type = result.get("signal_type", "NEWS_SENTIMENT")
                    rationale = result.get("rationale", "")
                    whale_entities = result.get("whale_entities", [])

                    is_whale = signal_type == "WHALE_MENTION"
                    composite = compute_composite_score(sentiment_score, is_whale)

                    guard = evaluate_signal(
                        ticker=ticker,
                        ticker_pct_of_portfolio=ctx["pct"],
                        stability_score=stability_score,
                    )

                    signal = MarketSignal(
                        investor_id=investor_id,
                        ticker=ticker,
                        signal_type=signal_type,
                        signal_date=today,
                        sentiment_score=round(sentiment_score, 3),
                        composite_score=composite,
                        rationale=rationale,
                        whale_entities=whale_entities,
                        personal_guard_metadata=guard.metadata,
                        guard_status=guard.status,
                        mute_reason=guard.mute_reason,
                        is_dismissed=False,
                    )
                    db.add(signal)

                    from app.ai_usage.logger import log_ai_call
                    log_ai_call(
                        db=db,
                        feature_name="market_signals",
                        model=_HAIKU_MODEL,
                        input_tokens=in_tok,
                        output_tokens=out_tok,
                        investor_id=investor_id,
                    )
                    total_written += 1

                db.commit()

            except Exception as exc:
                log.warning("[signal_worker] Failed for investor %s: %s", investor_id, exc)
                db.rollback()

        log.info("[signal_worker] Done — written=%d, skipped=%d", total_written, total_skipped)

    except Exception as exc:
        log.error("[signal_worker] Fatal error: %s", exc)
    finally:
        db.close()

"""Orchestrates the deep market research pipeline."""
import time
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.ai_usage.logger import log_ai_call
from app.core.config import settings
from app.market_research import analyzer, screener
from app.market_research.schemas import MarketResearchReport, SectorPerformance
from app.models.investment_account import InvestmentAccount
from app.models.investor_profile import InvestorProfile
from app.risk_modeling import service as rm_service

_AI_CACHE: dict[str, tuple[dict, float]] = {}
_AI_CACHE_TTL = 21_600  # 6 hours — same as screener


def get_research(db: Session, investor_id: uuid.UUID) -> MarketResearchReport | None:
    investor = db.get(InvestorProfile, investor_id)
    if not investor:
        return None

    risk_model = rm_service.get_latest(db, investor_id)

    accounts = (
        db.query(InvestmentAccount)
        .filter(InvestmentAccount.investor_id == investor_id)
        .all()
    )
    current_tickers: list[str] = sorted({
        h.ticker
        for acc in accounts
        for h in acc.holdings
        if h.ticker
    })

    investor_context: dict = {
        "experience_level": investor.experience_level.value,
        "is_minor": investor.is_minor,
        "base_currency": investor.base_currency,
        "country": investor.country,
        "current_holdings": current_tickers,
    }
    if risk_model:
        investor_context["risk_model"] = {
            "stability_score": risk_model.stability_score,
            "classification": risk_model.stability_classification,
            "low_risk_pct": risk_model.low_risk_pct,
            "growth_pct": risk_model.growth_pct,
            "high_risk_pct": risk_model.high_risk_pct,
        }

    all_stocks, sector_perf, crypto_candidates = screener.run_screen()  # uses 6h cache
    universe_size = len(all_stocks)
    candidates = all_stocks[:25]

    cache_key = str(investor_id)
    cached = _AI_CACHE.get(cache_key)
    if cached and (time.time() - cached[1]) < _AI_CACHE_TTL:
        raw = cached[0]
    else:
        raw, in_tok, out_tok = analyzer.generate_research(
            candidates=candidates,
            sector_performance=sector_perf,
            investor_context=investor_context,
            api_key=settings.ANTHROPIC_API_KEY,
            crypto_candidates=crypto_candidates,
        )
        _AI_CACHE[cache_key] = (raw, time.time())
        log_ai_call(
            db=db,
            feature_name="market_research",
            model="claude-sonnet-4-6",
            input_tokens=in_tok,
            output_tokens=out_tok,
            investor_id=investor_id,
        )
        db.commit()

    candidates_map = {c.ticker: c for c in candidates}

    stable_picks = analyzer._parse_picks(raw.get("stable_picks", []), candidates_map, "stable")
    moderate_picks = analyzer._parse_picks(raw.get("moderate_picks", []), candidates_map, "moderate")
    opportunity_picks = analyzer._parse_picks(raw.get("opportunity_picks", []), candidates_map, "high_opportunity")

    # Enrich sector_performance with AI outlooks if provided
    outlook_map: dict[str, str] = {}
    for so in raw.get("sector_outlooks", []):
        if isinstance(so, dict):
            outlook_map[so.get("sector", "")] = so.get("key_theme", "")

    enriched_sectors: list[SectorPerformance] = []
    for sp in sector_perf:
        theme = outlook_map.get(sp.sector)
        enriched = sp.model_copy(update={"outlook": sp.outlook})
        enriched_sectors.append(enriched)

    return MarketResearchReport(
        investor_id=investor_id,
        generated_at=datetime.now(timezone.utc),
        market_overview=raw.get("market_overview", ""),
        sector_insights=enriched_sectors,
        stable_picks=stable_picks,
        moderate_picks=moderate_picks,
        opportunity_picks=opportunity_picks,
        screening_universe_size=universe_size,
        candidates_scored=len(candidates),
        disclaimer=raw.get(
            "disclaimer",
            "This is for educational purposes only. Not financial advice. Always conduct your own research.",
        ),
        all_stock_candidates=candidates,
        crypto_candidates=crypto_candidates,
    )

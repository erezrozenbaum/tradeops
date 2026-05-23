import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.ai_usage.logger import log_ai_call
from app.core.config import settings
from app.financial_profiles import service as fp_service
from app.goals_analysis import service as goals_analysis_service
from app.investment_recommendations import analyzer
from app.investment_recommendations.schemas import (
    InstrumentRecommendation,
    InvestmentRoadmap,
    MonthlyAllocation,
    MonthlyPlan,
    PortfolioAction,
    RecommendationReport,
    RoadmapPhase,
)
from app.live_market_intel import scanner as market_scanner
from app.models.investment_account import InvestmentAccount
from app.models.investor_profile import InvestorProfile
from app.portfolio_analysis import rebalance_engine, service as portfolio_service
from app.provenance import recorder as provenance
from app.risk_modeling import service as rm_service
from app.tax_rules.service import get_tax_context_for_investor


def get_recommendations(db: Session, investor_id: uuid.UUID) -> RecommendationReport | None:
    investor = db.get(InvestorProfile, investor_id)
    if not investor:
        return None

    financial_profile = fp_service.get_by_investor(db, investor_id)
    risk_model = rm_service.get_latest(db, investor_id)
    portfolio_summary = portfolio_service.get_portfolio(db, investor_id)
    goals_analysis = goals_analysis_service.get_analysis(db, investor_id)

    # Rebalance result for gap context
    rebalance_result = None
    if portfolio_summary:
        rebalance_result = rebalance_engine.compute_rebalance(
            investor_id=investor_id,
            risk_model=risk_model,
            asset_allocation=portfolio_summary.asset_allocation,
        )

    # Extract tickers investor already holds
    accounts = (
        db.query(InvestmentAccount)
        .filter(InvestmentAccount.investor_id == investor_id)
        .all()
    )
    current_tickers: set[str] = {
        h.ticker
        for acc in accounts
        for h in acc.holdings
        if h.ticker
    }

    # Fetch live market signals (cached 30 min; failures return empty list)
    try:
        live_signals = market_scanner.get_opportunity_signals(
            risk_model=risk_model,
            current_tickers=current_tickers,
            max_signals=20,
        )
    except Exception:
        logger.warning("Live market signals unavailable", exc_info=True)
        live_signals = []

    tax_context = get_tax_context_for_investor(investor)

    context = analyzer.build_recommendation_context(
        investor=investor,
        financial_profile=financial_profile,
        risk_model=risk_model,
        portfolio_summary=portfolio_summary,
        rebalance_result=rebalance_result,
        goals_analysis=goals_analysis,
        current_tickers=current_tickers,
        live_signals=live_signals,
        tax_context=tax_context,
    )

    raw, in_tok, out_tok = analyzer.generate_recommendations(context, api_key=settings.ANTHROPIC_API_KEY)
    log_ai_call(
        db=db,
        feature_name="recommendations",
        model="claude-sonnet-4-6",
        input_tokens=in_tok,
        output_tokens=out_tok,
        investor_id=investor_id,
    )

    # Capture decision provenance before commit
    recs_summary = raw.get("recommendations", [])
    provenance.record_decision(
        db,
        investor_id=investor_id,
        decision_type="ai_recommendation",
        risk_model_snapshot=provenance.snapshot_risk_model(risk_model),
        holdings_summary=provenance.snapshot_holdings(portfolio_summary),
        market_signals_snapshot=provenance.snapshot_signals(live_signals),
        model_used="claude-sonnet-4-6",
        ai_input_summary=context[:1000] if isinstance(context, str) else None,
        ai_output_summary=raw.get("overall_guidance", "")[:1000],
        input_tokens=in_tok,
        output_tokens=out_tok,
        output_summary={
            "overall_guidance": raw.get("overall_guidance", "")[:300],
            "portfolio_actions": raw.get("portfolio_actions", [])[:3],
            "recommendation_tickers": [r.get("ticker") for r in recs_summary[:6]],
        },
        recommendation_count=len(recs_summary),
    )
    db.commit()

    portfolio_actions = [
        PortfolioAction(**a) for a in raw.get("portfolio_actions", [])
    ]
    recommendations = [
        InstrumentRecommendation(**r) for r in raw.get("recommendations", [])
    ]

    investment_roadmap: InvestmentRoadmap | None = None
    raw_roadmap = raw.get("investment_roadmap")
    if raw_roadmap:
        try:
            raw_plan = raw_roadmap.get("monthly_plan", {})
            monthly_plan = MonthlyPlan(
                conservative=[MonthlyAllocation(**a) for a in raw_plan.get("conservative", [])],
                balanced=[MonthlyAllocation(**a) for a in raw_plan.get("balanced", [])],
                growth=[MonthlyAllocation(**a) for a in raw_plan.get("growth", [])],
            )
            investment_roadmap = InvestmentRoadmap(
                monthly_investable_amount=raw_roadmap.get("monthly_investable_amount", 0),
                currency=raw_roadmap.get("currency", ""),
                current_phase=raw_roadmap.get("current_phase", 1),
                phases=[RoadmapPhase(**p) for p in raw_roadmap.get("phases", [])],
                monthly_plan=monthly_plan,
            )
        except Exception:
            logger.warning("Failed to parse investment roadmap from AI response", exc_info=True)
            investment_roadmap = None

    return RecommendationReport(
        investor_id=investor_id,
        overall_guidance=raw.get("overall_guidance", ""),
        portfolio_actions=portfolio_actions,
        investment_roadmap=investment_roadmap,
        recommendations=recommendations,
        market_signals=live_signals,
        generated_at=datetime.now(timezone.utc),
        disclaimer=raw.get(
            "disclaimer",
            "AI-generated output for educational and analytical purposes only. Not financial advice. "
            "Always conduct your own research and consult a licensed financial professional before investing.",
        ),
    )

import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.financial_profiles import service as fp_service
from app.goals_analysis import service as goals_analysis_service
from app.investment_recommendations import analyzer
from app.investment_recommendations.schemas import (
    InstrumentRecommendation,
    PortfolioAction,
    RecommendationReport,
)
from app.models.investment_account import InvestmentAccount
from app.models.investor_profile import InvestorProfile
from app.portfolio_analysis import rebalance_engine, service as portfolio_service
from app.risk_modeling import service as rm_service


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

    context = analyzer.build_recommendation_context(
        investor=investor,
        financial_profile=financial_profile,
        risk_model=risk_model,
        portfolio_summary=portfolio_summary,
        rebalance_result=rebalance_result,
        goals_analysis=goals_analysis,
        current_tickers=current_tickers,
    )

    raw = analyzer.generate_recommendations(context, api_key=settings.ANTHROPIC_API_KEY)

    portfolio_actions = [
        PortfolioAction(**a) for a in raw.get("portfolio_actions", [])
    ]
    recommendations = [
        InstrumentRecommendation(**r) for r in raw.get("recommendations", [])
    ]

    return RecommendationReport(
        investor_id=investor_id,
        overall_guidance=raw.get("overall_guidance", ""),
        portfolio_actions=portfolio_actions,
        recommendations=recommendations,
        generated_at=datetime.now(timezone.utc),
        disclaimer=raw.get(
            "disclaimer",
            "This is educational guidance only. Always conduct your own research before investing.",
        ),
    )

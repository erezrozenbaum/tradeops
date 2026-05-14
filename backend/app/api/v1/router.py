from fastapi import APIRouter

from app.ai_analysis.router import router as ai_analysis_router
from app.audit.router import router as audit_router
from app.backtesting.router import router as backtesting_router
from app.paper_trading.router import router as paper_trading_router
from app.dashboard.router import router as dashboard_router
from app.family_profiles.router import router as family_profile_router
from app.financial_decision.router import router as decision_router
from app.financial_profiles.router import router as financial_profile_router
from app.goals.router import router as goals_router
from app.goals.progress_router import router as goal_progress_router
from app.investor_profiles.router import router as investor_router
from app.risk_modeling.router import router as risk_model_router
from app.strategy_library.router import router as strategy_library_router
from app.strategy_selection.router import router as strategy_selection_router
from app.holdings.router import router as holdings_router
from app.market_data.router import router as market_data_router
from app.goals_analysis.router import router as goals_analysis_router
from app.market_scanner.router import router as market_scanner_router
from app.investment_recommendations.router import router as investment_recommendations_router
from app.portfolio_analysis.router import router as portfolio_router
from app.pension_simulation.router import router as pension_simulation_router
from app.debt_planner.router import router as debt_planner_router
from app.watchlist.router import router as watchlist_router
from app.notifications.router import router as notifications_router
from app.investment_agent.router import router as investment_agent_router
from app.market_research.router import router as market_research_router
from app.transactions.router import router as transactions_router
from app.price_alerts.router import router as price_alerts_router
from app.economic_calendar.router import router as economic_calendar_router
from app.portfolio_correlation.router import router as portfolio_correlation_router
from app.holdings_news.router import router as holdings_news_router
from app.reports.router import router as reports_router
from app.retirement_readiness.router import router as retirement_readiness_router
from app.broker_sync.router import router as broker_sync_router
from app.admin.router import router as admin_router

api_router = APIRouter()

api_router.include_router(investor_router, prefix="/investors", tags=["investors"])
api_router.include_router(financial_profile_router, prefix="/investors", tags=["financial-profiles"])
api_router.include_router(goals_router, prefix="/investors/{investor_id}/goals", tags=["goals"])
api_router.include_router(goal_progress_router, prefix="/investors/{investor_id}/goals", tags=["goal-progress"])
api_router.include_router(risk_model_router, prefix="/investors/{investor_id}/risk-model", tags=["risk-model"])
api_router.include_router(strategy_selection_router, prefix="/investors/{investor_id}/strategies", tags=["strategies"])
api_router.include_router(backtesting_router, prefix="/investors/{investor_id}/backtests", tags=["backtesting"])
api_router.include_router(paper_trading_router, prefix="/investors/{investor_id}/paper-portfolios", tags=["paper-trading"])
api_router.include_router(ai_analysis_router, prefix="/investors/{investor_id}/ai-report", tags=["ai-analysis"])
api_router.include_router(decision_router, prefix="/investors/{investor_id}/decision", tags=["decision"])
api_router.include_router(portfolio_router, prefix="/investors/{investor_id}/portfolio", tags=["portfolio"])
api_router.include_router(pension_simulation_router, prefix="/investors/{investor_id}/pension-simulation", tags=["pension-simulation"])
api_router.include_router(debt_planner_router, prefix="/investors/{investor_id}/debt-planner", tags=["debt-planner"])
api_router.include_router(watchlist_router, prefix="/investors/{investor_id}/watchlist", tags=["watchlist"])
api_router.include_router(notifications_router, prefix="/investors/{investor_id}/notifications", tags=["notifications"])
api_router.include_router(investment_agent_router, prefix="/investors/{investor_id}/agent", tags=["investment-agent"])
api_router.include_router(goals_analysis_router, prefix="/investors/{investor_id}/goals-analysis", tags=["goals-analysis"])
api_router.include_router(market_scanner_router, prefix="/investors/{investor_id}/market-scan", tags=["market-scan"])
api_router.include_router(investment_recommendations_router, prefix="/investors/{investor_id}/recommendations", tags=["recommendations"])
api_router.include_router(market_research_router, prefix="/investors/{investor_id}/market-research", tags=["market-research"])
api_router.include_router(holdings_router, prefix="/investors", tags=["holdings"])
api_router.include_router(market_data_router, prefix="/market", tags=["market-data"])
api_router.include_router(dashboard_router, prefix="/investors", tags=["dashboard"])
api_router.include_router(family_profile_router, prefix="/family-profiles", tags=["family-profiles"])
api_router.include_router(strategy_library_router, prefix="/strategies/templates", tags=["strategy-templates"])
api_router.include_router(audit_router, prefix="/investors", tags=["audit"])
api_router.include_router(transactions_router, prefix="/investors/{investor_id}/transactions", tags=["transactions"])
api_router.include_router(price_alerts_router, prefix="/investors/{investor_id}/alerts", tags=["price-alerts"])
api_router.include_router(economic_calendar_router, prefix="/investors/{investor_id}/calendar", tags=["economic-calendar"])
api_router.include_router(portfolio_correlation_router, prefix="/investors/{investor_id}/portfolio", tags=["portfolio-correlation"])
api_router.include_router(holdings_news_router, prefix="/investors/{investor_id}/news", tags=["holdings-news"])
api_router.include_router(reports_router, prefix="/investors/{investor_id}/reports", tags=["reports"])
api_router.include_router(retirement_readiness_router, prefix="/investors/{investor_id}/retirement-readiness", tags=["retirement-readiness"])
api_router.include_router(broker_sync_router, prefix="/investors", tags=["broker-sync"])
api_router.include_router(admin_router, prefix="/admin", tags=["admin"])

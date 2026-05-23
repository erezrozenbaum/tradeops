from fastapi import APIRouter, Depends

from app.auth.investor_access import verify_investor_access
from app.ai_usage.logger import require_ai_budget
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
from app.portfolio_chat.router import router as portfolio_chat_router
from app.family_portfolio.router import router as family_portfolio_router
from app.liquidity_runway.router import router as liquidity_runway_router
from app.resilience.router import router as resilience_router
from app.market_signals.router import router as market_signals_router
from app.action_feed.router import router as action_feed_router
from app.pairs_trading.router import router as pairs_trading_router
from app.pdf_import.router import router as pdf_import_router
from app.crypto_staking.router import router as crypto_staking_router
from app.live_trading.router import router as live_trading_router
from app.fx_impact.router import router as fx_impact_router
from app.net_worth.router import router as net_worth_router
from app.tax_summary.router import router as tax_summary_router
from app.coach.router import router as coach_router
from app.provenance.router import router as provenance_router
from app.strategy_drift.router import router as strategy_drift_router
from app.decision_timeline.router import router as decision_timeline_router
from app.behavioral_patterns.router import router as behavioral_patterns_router
from app.attribution.router import router as attribution_router
from app.investor_maturity.router import router as investor_maturity_router
from app.financial_twin.router import router as financial_twin_router, health_router as financial_health_router
from app.behavioral_risk.router import router as behavioral_risk_router
from app.simulation.router import router as simulation_router
from app.command_center.router import router as command_center_router
from app.household.router import router as household_router

api_router = APIRouter()

# Shorthand for investor-scoped ownership guard
_own = [Depends(verify_investor_access)]
# Ownership guard + AI budget check for expensive AI endpoints
_ai = [Depends(verify_investor_access), Depends(require_ai_budget)]

# ── Public/admin-scoped routers (no investor ownership check) ─────────────────
api_router.include_router(investor_router, prefix="/investors", tags=["investors"])
api_router.include_router(family_profile_router, prefix="/family-profiles", tags=["family-profiles"])
api_router.include_router(strategy_library_router, prefix="/strategies/templates", tags=["strategy-templates"])
api_router.include_router(market_data_router, prefix="/market", tags=["market-data"])
api_router.include_router(admin_router, prefix="/admin", tags=["admin"])

# ── Investor-scoped routers (ownership verified via verify_investor_access) ────
api_router.include_router(financial_profile_router, prefix="/investors", tags=["financial-profiles"], dependencies=_own)
api_router.include_router(goals_router, prefix="/investors/{investor_id}/goals", tags=["goals"], dependencies=_own)
api_router.include_router(goal_progress_router, prefix="/investors/{investor_id}/goals", tags=["goal-progress"], dependencies=_own)
api_router.include_router(risk_model_router, prefix="/investors/{investor_id}/risk-model", tags=["risk-model"], dependencies=_own)
api_router.include_router(strategy_selection_router, prefix="/investors/{investor_id}/strategies", tags=["strategies"], dependencies=_own)
api_router.include_router(backtesting_router, prefix="/investors/{investor_id}/backtests", tags=["backtesting"], dependencies=_own)
api_router.include_router(paper_trading_router, prefix="/investors/{investor_id}/paper-portfolios", tags=["paper-trading"], dependencies=_own)
api_router.include_router(ai_analysis_router, prefix="/investors/{investor_id}/ai-report", tags=["ai-analysis"], dependencies=_ai)
api_router.include_router(decision_router, prefix="/investors/{investor_id}/decision", tags=["decision"], dependencies=_own)
api_router.include_router(portfolio_router, prefix="/investors/{investor_id}/portfolio", tags=["portfolio"], dependencies=_own)
api_router.include_router(pension_simulation_router, prefix="/investors/{investor_id}/pension-simulation", tags=["pension-simulation"], dependencies=_own)
api_router.include_router(debt_planner_router, prefix="/investors/{investor_id}/debt-planner", tags=["debt-planner"], dependencies=_own)
api_router.include_router(watchlist_router, prefix="/investors/{investor_id}/watchlist", tags=["watchlist"], dependencies=_own)
api_router.include_router(notifications_router, prefix="/investors/{investor_id}/notifications", tags=["notifications"], dependencies=_own)
api_router.include_router(investment_agent_router, prefix="/investors/{investor_id}/agent", tags=["investment-agent"], dependencies=_ai)
api_router.include_router(goals_analysis_router, prefix="/investors/{investor_id}/goals-analysis", tags=["goals-analysis"], dependencies=_own)
api_router.include_router(market_scanner_router, prefix="/investors/{investor_id}/market-scan", tags=["market-scan"], dependencies=_ai)
api_router.include_router(investment_recommendations_router, prefix="/investors/{investor_id}/recommendations", tags=["recommendations"], dependencies=_ai)
api_router.include_router(market_research_router, prefix="/investors/{investor_id}/market-research", tags=["market-research"], dependencies=_ai)
api_router.include_router(holdings_router, prefix="/investors", tags=["holdings"], dependencies=_own)
api_router.include_router(dashboard_router, prefix="/investors", tags=["dashboard"], dependencies=_own)
api_router.include_router(transactions_router, prefix="/investors/{investor_id}/transactions", tags=["transactions"], dependencies=_own)
api_router.include_router(price_alerts_router, prefix="/investors/{investor_id}/alerts", tags=["price-alerts"], dependencies=_own)
api_router.include_router(economic_calendar_router, prefix="/investors/{investor_id}/calendar", tags=["economic-calendar"], dependencies=_own)
api_router.include_router(portfolio_correlation_router, prefix="/investors/{investor_id}/portfolio", tags=["portfolio-correlation"], dependencies=_own)
api_router.include_router(holdings_news_router, prefix="/investors/{investor_id}/news", tags=["holdings-news"], dependencies=_own)
api_router.include_router(reports_router, prefix="/investors/{investor_id}/reports", tags=["reports"], dependencies=_own)
api_router.include_router(retirement_readiness_router, prefix="/investors/{investor_id}/retirement-readiness", tags=["retirement-readiness"], dependencies=_own)
api_router.include_router(broker_sync_router, prefix="/investors", tags=["broker-sync"], dependencies=_own)
api_router.include_router(audit_router, prefix="/investors", tags=["audit"], dependencies=_own)
api_router.include_router(portfolio_chat_router, prefix="/investors/{investor_id}/chat", tags=["chat"], dependencies=_ai)
api_router.include_router(family_portfolio_router, prefix="/investors/{investor_id}/family-portfolio", tags=["family-portfolio"], dependencies=_own)
api_router.include_router(liquidity_runway_router, prefix="/investors/{investor_id}/portfolio", tags=["liquidity-runway"], dependencies=_own)
api_router.include_router(resilience_router, prefix="/investors/{investor_id}/portfolio", tags=["resilience"], dependencies=_own)
api_router.include_router(market_signals_router, prefix="/investors/{investor_id}/market-signals", tags=["market-signals"], dependencies=_own)
api_router.include_router(action_feed_router, prefix="/investors/{investor_id}/action-feed", tags=["action-feed"], dependencies=_own)
api_router.include_router(pairs_trading_router, prefix="/investors/{investor_id}/pairs-trading", tags=["pairs-trading"], dependencies=_own)
api_router.include_router(pdf_import_router, prefix="/investors/{investor_id}/pdf-import", tags=["pdf-import"], dependencies=_own)
api_router.include_router(crypto_staking_router, prefix="/investors/{investor_id}/crypto-staking", tags=["crypto-staking"], dependencies=_own)
api_router.include_router(live_trading_router, prefix="/investors/{investor_id}/live-trading", tags=["live-trading"], dependencies=_own)
api_router.include_router(fx_impact_router, prefix="/investors/{investor_id}", tags=["fx-impact"], dependencies=_own)
api_router.include_router(net_worth_router, prefix="/investors/{investor_id}/net-worth", tags=["net-worth"], dependencies=_own)
api_router.include_router(tax_summary_router, prefix="/investors/{investor_id}/tax-summary", tags=["tax-summary"], dependencies=_own)
api_router.include_router(coach_router, prefix="/investors/{investor_id}/coach", tags=["coach"], dependencies=_own)
api_router.include_router(provenance_router, prefix="/investors/{investor_id}/decisions", tags=["provenance"], dependencies=_own)
api_router.include_router(strategy_drift_router, prefix="/investors/{investor_id}/strategy-drift", tags=["strategy-drift"], dependencies=_own)
api_router.include_router(decision_timeline_router, prefix="/investors/{investor_id}/timeline", tags=["timeline"], dependencies=_own)
api_router.include_router(behavioral_patterns_router, prefix="/investors/{investor_id}/behavioral-patterns", tags=["behavioral-patterns"], dependencies=_own)
api_router.include_router(attribution_router, prefix="/investors/{investor_id}/attribution", tags=["attribution"], dependencies=_own)
api_router.include_router(investor_maturity_router, prefix="/investors/{investor_id}/maturity", tags=["maturity"], dependencies=_own)
api_router.include_router(financial_twin_router, prefix="/investors/{investor_id}/twin", tags=["financial-twin"], dependencies=_own)
api_router.include_router(financial_health_router, prefix="/investors/{investor_id}/health-radar", tags=["health-radar"], dependencies=_own)
api_router.include_router(behavioral_risk_router, prefix="/investors/{investor_id}/behavioral-risk", tags=["behavioral-risk"], dependencies=_own)
api_router.include_router(simulation_router, prefix="/investors/{investor_id}/simulations", tags=["simulations"], dependencies=_own)
api_router.include_router(command_center_router, prefix="/investors/{investor_id}/command-center", tags=["command-center"], dependencies=_own)
api_router.include_router(household_router, prefix="/investors/{investor_id}/household", tags=["household"], dependencies=_own)

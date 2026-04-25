import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.ai_analysis.analyzer import build_context, generate_report
from app.audit import service as audit
from app.backtesting import service as backtest_service
from app.core.config import settings
from app.financial_profiles import service as fp_service
from app.goals import service as goals_service
from app.models.investor_profile import InvestorProfile
from app.paper_trading import service as pt_service
from app.risk_modeling import service as rm_service


def generate(db: Session, investor_id: uuid.UUID) -> dict | None:
    investor = db.get(InvestorProfile, investor_id)
    if not investor:
        return None

    financial_profile = fp_service.get_by_investor(db, investor_id)
    risk_model = rm_service.get_latest(db, investor_id)
    goals = goals_service.get_by_investor(db, investor_id)
    backtest_runs = backtest_service.list_for_investor(db, investor_id)
    paper_portfolios = pt_service.list_for_investor(db, investor_id)

    context = build_context(
        investor=investor,
        financial_profile=financial_profile,
        risk_model=risk_model,
        goals=goals,
        backtest_runs=backtest_runs,
        paper_portfolios=paper_portfolios,
    )

    report = generate_report(context, api_key=settings.ANTHROPIC_API_KEY)

    audit.log_event(
        db,
        event_type="ai_analysis.report_generated",
        description="AI financial analysis report generated.",
        investor_profile_id=investor_id,
        metadata={"sections": list(report.keys())},
    )
    db.commit()

    return {
        "investor_id": investor_id,
        "generated_at": datetime.now(timezone.utc),
        **report,
    }

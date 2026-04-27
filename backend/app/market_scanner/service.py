import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.financial_decision.service import get_decision
from app.market_scanner.engine import scan
from app.market_scanner.schemas import MarketScanResult
from app.models.investor_profile import InvestorProfile
from app.portfolio_analysis.service import get_portfolio
from app.risk_modeling.service import get_latest as get_latest_risk_model


def get_scan(db: Session, investor_id: uuid.UUID) -> MarketScanResult | None:
    investor = db.get(InvestorProfile, investor_id)
    if not investor:
        return None

    risk_model = get_latest_risk_model(db, investor_id)
    decision = get_decision(db, investor_id)
    readiness_classification = decision.readiness_classification if decision else "not_ready"

    portfolio = get_portfolio(db, investor_id)
    asset_allocation = portfolio.asset_allocation if portfolio else {}

    suggestions, notes = scan(
        investor=investor,
        risk_model=risk_model,
        readiness_classification=readiness_classification,
        asset_allocation=asset_allocation,
    )

    return MarketScanResult(
        investor_id=investor_id,
        readiness_classification=readiness_classification,
        suggestions=suggestions,
        scan_notes=notes,
        computed_at=datetime.now(timezone.utc),
    )

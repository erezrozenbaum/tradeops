"""PDF report generation endpoint."""
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.investor_profile import InvestorProfile
from app.portfolio_analysis import service as portfolio_service

router = APIRouter()


@router.get("/pdf")
def generate_pdf_report(
    investor_id: uuid.UUID,
    period: str = "monthly",
    db: Session = Depends(get_db),
):
    """Generate a professional multi-page PDF portfolio report.

    period: monthly | quarterly
    Returns application/pdf stream for immediate browser download.
    """
    from app.reports.pdf_generator import generate_pdf
    from app.performance_analytics.engine import compute as compute_analytics
    from app.performance_analytics.attribution import compute_attribution
    from app.scenario_analysis.engine import compute as compute_stress
    from app.tax_harvesting.service import compute_opportunities
    from datetime import date as date_type

    investor = db.get(InvestorProfile, investor_id)
    if not investor:
        raise HTTPException(status_code=404, detail="Investor not found")

    investor_name = " ".join(
        p for p in [investor.first_name, investor.last_name] if p
    ) or "Investor"

    portfolio = portfolio_service.get_portfolio(db, investor_id)
    currency = investor.base_currency or "USD"

    # Performance analytics — use period param to determine lookback
    period_days = {"monthly": 31, "quarterly": 92}.get(period, 31)
    since = datetime.now(timezone.utc) - timedelta(days=period_days)
    snapshots = portfolio_service.get_history(db, investor_id, since=since)
    analytics = compute_analytics(snapshots, investor_id=investor_id, currency=currency)

    # Attribution uses full history
    all_snaps = portfolio_service.get_history(db, investor_id, since=None)
    attribution = compute_attribution(all_snaps, portfolio, investor_id, currency)

    # Stress test
    years = 20
    if investor.date_of_birth:
        today = date_type.today()
        age = today.year - investor.date_of_birth.year - (
            (today.month, today.day) < (investor.date_of_birth.month, investor.date_of_birth.day)
        )
        years = max(1, 65 - age)
    stress = compute_stress(portfolio, investor_id, currency, years_to_retirement=years)

    # Tax opportunities
    country = investor.country or "US"
    tax = compute_opportunities(portfolio, investor_id, country)

    pdf_bytes = generate_pdf(
        investor_name=investor_name,
        period=period,
        portfolio=portfolio,
        analytics=analytics,
        attribution=attribution,
        stress=stress,
        tax=tax,
    )

    filename = f"tradeops-report-{period}-{datetime.now(timezone.utc).strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.command_center import orchestrator
from app.command_center.schemas import (
    AIMemoryItem,
    AIMemoryResponse,
    CommandCenterReport,
    MaturityHistoryPoint,
    ScoreHistoryResponse,
    TwinHistoryPoint,
)
from app.db.session import get_db
from app.models.financial_twin_snapshot import FinancialTwinSnapshot
from app.models.investor_maturity_snapshot import InvestorMaturitySnapshot
from app.models.investor_profile import InvestorProfile

router = APIRouter()


def _check_investor(investor_id: uuid.UUID, db: Session) -> InvestorProfile:
    inv = db.get(InvestorProfile, investor_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Investor not found")
    return inv


@router.get("", response_model=CommandCenterReport)
def get_command_center(
    investor_id: uuid.UUID,
    verbosity: Literal["beginner", "standard", "advanced"] = Query(
        default="standard",
        description="AI summary detail level. Defaults to maturity-based auto-selection.",
    ),
    db: Session = Depends(get_db),
):
    _check_investor(investor_id, db)
    return orchestrator.build(db, investor_id, verbosity=verbosity)


@router.get("/ai-memory", response_model=AIMemoryResponse)
def get_ai_memory(
    investor_id: uuid.UUID,
    months: int = Query(default=3, ge=1, le=12),
    db: Session = Depends(get_db),
):
    """Return the rolling AI memory timeline for this investor."""
    from app.command_center.ai_memory import get_recent
    from app.models.ai_memory_entry import AIMemoryEntry

    _check_investor(investor_id, db)
    entries: list[AIMemoryEntry] = get_recent(db, investor_id, months=months, limit=50)
    items = [
        AIMemoryItem(
            id=str(e.id),
            summary_at=e.summary_at,
            verbosity=e.verbosity,
            portfolio_assessment=e.portfolio_assessment,
            key_metrics=e.key_metrics,
        )
        for e in entries
    ]
    return AIMemoryResponse(items=items)


@router.get("/score-history", response_model=ScoreHistoryResponse)
def get_score_history(
    investor_id: uuid.UUID,
    months: int = Query(default=6, ge=1, le=12),
    db: Session = Depends(get_db),
):
    """Return twin-score and maturity-score history for charting."""
    _check_investor(investor_id, db)
    cutoff = datetime.now(timezone.utc) - timedelta(days=months * 30)

    twin_rows = (
        db.query(FinancialTwinSnapshot)
        .filter(
            FinancialTwinSnapshot.investor_id == investor_id,
            FinancialTwinSnapshot.computed_at >= cutoff,
        )
        .order_by(FinancialTwinSnapshot.computed_at.asc())
        .limit(200)
        .all()
    )

    maturity_rows = (
        db.query(InvestorMaturitySnapshot)
        .filter(
            InvestorMaturitySnapshot.investor_id == investor_id,
            InvestorMaturitySnapshot.computed_at >= cutoff,
        )
        .order_by(InvestorMaturitySnapshot.computed_at.asc())
        .limit(60)
        .all()
    )

    twin_history = [
        TwinHistoryPoint(
            computed_at=r.computed_at,
            overall_score=r.overall_score,
            financial_stability=r.financial_stability,
            behavioral_discipline=r.behavioral_discipline,
            emotional_risk=r.emotional_risk,
            portfolio_consistency=r.portfolio_consistency,
            financial_resilience=r.financial_resilience,
            risk_alignment=r.risk_alignment,
            long_term_discipline=r.long_term_discipline,
            contribution_momentum=r.contribution_momentum,
        )
        for r in twin_rows
    ]

    maturity_history = [
        MaturityHistoryPoint(
            computed_at=r.computed_at,
            composite_score=r.composite_score,
            stage=r.stage,
        )
        for r in maturity_rows
    ]

    return ScoreHistoryResponse(twin_history=twin_history, maturity_history=maturity_history)


@router.get("/pdf")
def get_command_center_pdf(
    investor_id: uuid.UUID,
    verbosity: Literal["beginner", "standard", "advanced"] = Query(default="standard"),
    db: Session = Depends(get_db),
):
    """Download a PDF snapshot of the Command Center report."""
    from app.reports.pdf_generator import generate_command_center_pdf

    inv = _check_investor(investor_id, db)
    investor_name = " ".join(p for p in [inv.first_name, inv.last_name] if p) or "Investor"

    report = orchestrator.build(db, investor_id, verbosity=verbosity)
    pdf_bytes = generate_command_center_pdf(investor_name=investor_name, report=report)

    filename = f"tradeops-command-center-{datetime.now(timezone.utc).strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

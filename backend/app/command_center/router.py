from __future__ import annotations

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.command_center import orchestrator
from app.command_center.schemas import CommandCenterReport, FinancialStatusHeader
from app.db.session import get_db
from app.models.investor_profiles import InvestorProfile

router = APIRouter()


def _check_investor(investor_id: uuid.UUID, db: Session) -> None:
    if not db.get(InvestorProfile, investor_id):
        raise HTTPException(status_code=404, detail="Investor not found")


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

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.advisor_share import service
from app.advisor_share.schemas import AdvisorShareListOut, AdvisorShareOut, AdvisorShareSnapshot
from app.command_center import orchestrator
from app.db.session import get_db
from app.models.investor_profile import InvestorProfile

# Investor-scoped router (registered with _own dependency in api/v1/router.py)
router = APIRouter()

# Public router — no auth dependency
public_router = APIRouter()


def _require_investor(investor_id: uuid.UUID, db: Session) -> InvestorProfile:
    investor = db.get(InvestorProfile, investor_id)
    if not investor:
        raise HTTPException(status_code=404, detail="Investor not found")
    return investor


@router.post("", response_model=AdvisorShareOut, status_code=201)
def create_share(
    investor_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    _require_investor(investor_id, db)
    entry = service.create_token(db, investor_id)
    return AdvisorShareOut.model_validate(entry)


@router.delete("/{token}", status_code=204)
def revoke_share(
    investor_id: uuid.UUID,
    token: str,
    db: Session = Depends(get_db),
):
    _require_investor(investor_id, db)
    if not service.revoke_token(db, investor_id, token):
        raise HTTPException(status_code=404, detail="Token not found or already revoked")


@router.get("", response_model=AdvisorShareListOut)
def list_shares(
    investor_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    _require_investor(investor_id, db)
    tokens = service.list_active(db, investor_id)
    return AdvisorShareListOut(tokens=[AdvisorShareOut.model_validate(t) for t in tokens])


@public_router.get("/{token}", response_model=AdvisorShareSnapshot)
def view_share(
    token: str,
    db: Session = Depends(get_db),
):
    entry = service.get_valid(db, token)
    if not entry:
        raise HTTPException(status_code=404, detail="Share link not found or expired")

    investor = db.get(InvestorProfile, entry.investor_id)
    if not investor:
        raise HTTPException(status_code=404, detail="Investor not found")

    report = orchestrator.build(db, entry.investor_id, verbosity="standard")
    return AdvisorShareSnapshot(
        investor_name=investor.full_name,
        report=report,
        expires_at=entry.expires_at,
    )

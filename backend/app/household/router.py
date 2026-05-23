from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.household import service
from app.household.schemas import (
    HouseholdAggregateMetrics,
    HouseholdCreate,
    HouseholdOut,
    HouseholdSummary,
)
from app.models.investor_profile import InvestorProfile

router = APIRouter()


def _require_investor(investor_id: uuid.UUID, db: Session) -> InvestorProfile:
    investor = db.get(InvestorProfile, investor_id)
    if not investor:
        raise HTTPException(status_code=404, detail="Investor not found")
    return investor


@router.post("/create", response_model=HouseholdOut, status_code=201)
def create_household(
    investor_id: uuid.UUID,
    body: HouseholdCreate,
    db: Session = Depends(get_db),
):
    investor = _require_investor(investor_id, db)
    if investor.household_id:
        raise HTTPException(status_code=409, detail="Investor is already in a household. Leave first.")
    household = service.create_household(db, investor_id, body.name)
    return HouseholdOut.model_validate(household)


@router.post("/join/{household_id}", response_model=HouseholdOut)
def join_household(
    investor_id: uuid.UUID,
    household_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    investor = _require_investor(investor_id, db)
    if investor.household_id:
        raise HTTPException(status_code=409, detail="Investor is already in a household. Leave first.")
    try:
        household = service.join_household(db, investor_id, household_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return HouseholdOut.model_validate(household)


@router.delete("", status_code=204)
def leave_household(
    investor_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    _require_investor(investor_id, db)
    service.leave_household(db, investor_id)


@router.get("", response_model=HouseholdSummary)
def get_household_summary(
    investor_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    summary = service.get_summary(db, investor_id)
    if not summary:
        raise HTTPException(status_code=404, detail="Investor is not in a household")
    return summary


@router.get("/aggregate", response_model=HouseholdAggregateMetrics)
def get_aggregate_metrics(
    investor_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    metrics = service.get_aggregate_metrics(db, investor_id)
    if not metrics:
        raise HTTPException(status_code=404, detail="Investor is not in a household")
    return metrics

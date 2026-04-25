import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.financial_profile import (
    FinancialAssetCreate,
    FinancialAssetOut,
    FinancialAssetUpdate,
    FinancialLiabilityCreate,
    FinancialLiabilityOut,
    FinancialLiabilityUpdate,
    FinancialProfileCreate,
    FinancialProfileOut,
    FinancialProfileUpdate,
)
from app.financial_profiles import service

router = APIRouter()


@router.post(
    "/{investor_id}/financial-profile",
    response_model=FinancialProfileOut,
    status_code=status.HTTP_201_CREATED,
)
def create_financial_profile(
    investor_id: uuid.UUID, data: FinancialProfileCreate, db: Session = Depends(get_db)
):
    fp = service.create(db, investor_id, data)
    if not fp:
        raise HTTPException(status_code=404, detail="Investor profile not found")
    return fp


@router.get("/{investor_id}/financial-profile", response_model=FinancialProfileOut)
def get_financial_profile(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    fp = service.get_by_investor(db, investor_id)
    if not fp:
        raise HTTPException(status_code=404, detail="Financial profile not found")
    return fp


@router.put("/{investor_id}/financial-profile", response_model=FinancialProfileOut)
def update_financial_profile(
    investor_id: uuid.UUID, data: FinancialProfileUpdate, db: Session = Depends(get_db)
):
    fp = service.update(db, investor_id, data)
    if not fp:
        raise HTTPException(status_code=404, detail="Financial profile not found")
    return fp


# ── Assets ──────────────────────────────────────────────────────────────────


@router.post(
    "/{investor_id}/financial-profile/assets",
    response_model=FinancialAssetOut,
    status_code=status.HTTP_201_CREATED,
)
def add_asset(
    investor_id: uuid.UUID, data: FinancialAssetCreate, db: Session = Depends(get_db)
):
    asset = service.add_asset(db, investor_id, data)
    if not asset:
        raise HTTPException(status_code=404, detail="Financial profile not found")
    return asset


@router.put(
    "/{investor_id}/financial-profile/assets/{asset_id}",
    response_model=FinancialAssetOut,
)
def update_asset(
    investor_id: uuid.UUID,
    asset_id: uuid.UUID,
    data: FinancialAssetUpdate,
    db: Session = Depends(get_db),
):
    asset = service.update_asset(db, investor_id, asset_id, data)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset


@router.delete(
    "/{investor_id}/financial-profile/assets/{asset_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_asset(
    investor_id: uuid.UUID, asset_id: uuid.UUID, db: Session = Depends(get_db)
):
    if not service.remove_asset(db, investor_id, asset_id):
        raise HTTPException(status_code=404, detail="Asset not found")


# ── Liabilities ─────────────────────────────────────────────────────────────


@router.post(
    "/{investor_id}/financial-profile/liabilities",
    response_model=FinancialLiabilityOut,
    status_code=status.HTTP_201_CREATED,
)
def add_liability(
    investor_id: uuid.UUID, data: FinancialLiabilityCreate, db: Session = Depends(get_db)
):
    liability = service.add_liability(db, investor_id, data)
    if not liability:
        raise HTTPException(status_code=404, detail="Financial profile not found")
    return liability


@router.put(
    "/{investor_id}/financial-profile/liabilities/{liability_id}",
    response_model=FinancialLiabilityOut,
)
def update_liability(
    investor_id: uuid.UUID,
    liability_id: uuid.UUID,
    data: FinancialLiabilityUpdate,
    db: Session = Depends(get_db),
):
    liability = service.update_liability(db, investor_id, liability_id, data)
    if not liability:
        raise HTTPException(status_code=404, detail="Liability not found")
    return liability


@router.delete(
    "/{investor_id}/financial-profile/liabilities/{liability_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_liability(
    investor_id: uuid.UUID, liability_id: uuid.UUID, db: Session = Depends(get_db)
):
    if not service.remove_liability(db, investor_id, liability_id):
        raise HTTPException(status_code=404, detail="Liability not found")

import uuid

from sqlalchemy.orm import Session

from app.models.financial_profile import FinancialAsset, FinancialLiability, FinancialProfile
from app.models.investor_profile import InvestorProfile
from app.schemas.financial_profile import (
    FinancialAssetCreate,
    FinancialAssetUpdate,
    FinancialLiabilityCreate,
    FinancialLiabilityUpdate,
    FinancialProfileCreate,
    FinancialProfileUpdate,
)
from app.audit import service as audit


def get_by_investor(db: Session, investor_id: uuid.UUID) -> FinancialProfile | None:
    return (
        db.query(FinancialProfile)
        .filter(FinancialProfile.investor_profile_id == investor_id)
        .first()
    )


def create(
    db: Session, investor_id: uuid.UUID, data: FinancialProfileCreate
) -> FinancialProfile | None:
    if not db.get(InvestorProfile, investor_id):
        return None
    fp = FinancialProfile(investor_profile_id=investor_id, **data.model_dump())
    db.add(fp)
    db.flush()
    audit.log_event(
        db,
        event_type="financial_profile.created",
        description="Financial profile created",
        investor_profile_id=investor_id,
    )
    db.commit()
    db.refresh(fp)
    return fp


def update(
    db: Session, investor_id: uuid.UUID, data: FinancialProfileUpdate
) -> FinancialProfile | None:
    fp = get_by_investor(db, investor_id)
    if not fp:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(fp, field, value)
    db.flush()
    audit.log_event(
        db,
        event_type="financial_profile.updated",
        description="Financial profile updated",
        investor_profile_id=investor_id,
        metadata=data.model_dump(exclude_none=True),
    )
    db.commit()
    db.refresh(fp)
    return fp


# ── Assets ──────────────────────────────────────────────────────────────────


def add_asset(
    db: Session, investor_id: uuid.UUID, data: FinancialAssetCreate
) -> FinancialAsset | None:
    fp = get_by_investor(db, investor_id)
    if not fp:
        return None
    asset = FinancialAsset(financial_profile_id=fp.id, **data.model_dump())
    db.add(asset)
    db.flush()
    audit.log_event(
        db,
        event_type="asset.added",
        description=f"Asset '{asset.name}' added",
        investor_profile_id=investor_id,
        metadata={"asset_id": str(asset.id), "name": asset.name, "value": asset.current_value},
    )
    db.commit()
    db.refresh(asset)
    return asset


def update_asset(
    db: Session, investor_id: uuid.UUID, asset_id: uuid.UUID, data: FinancialAssetUpdate
) -> FinancialAsset | None:
    fp = get_by_investor(db, investor_id)
    if not fp:
        return None
    asset = db.get(FinancialAsset, asset_id)
    if not asset or asset.financial_profile_id != fp.id:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(asset, field, value)
    db.flush()
    audit.log_event(
        db,
        event_type="asset.updated",
        description=f"Asset '{asset.name}' updated",
        investor_profile_id=investor_id,
        metadata={"asset_id": str(asset_id)},
    )
    db.commit()
    db.refresh(asset)
    return asset


def remove_asset(
    db: Session, investor_id: uuid.UUID, asset_id: uuid.UUID
) -> bool:
    fp = get_by_investor(db, investor_id)
    if not fp:
        return False
    asset = db.get(FinancialAsset, asset_id)
    if not asset or asset.financial_profile_id != fp.id:
        return False
    audit.log_event(
        db,
        event_type="asset.removed",
        description=f"Asset '{asset.name}' removed",
        investor_profile_id=investor_id,
        metadata={"asset_id": str(asset_id)},
    )
    db.delete(asset)
    db.commit()
    return True


# ── Liabilities ─────────────────────────────────────────────────────────────


def add_liability(
    db: Session, investor_id: uuid.UUID, data: FinancialLiabilityCreate
) -> FinancialLiability | None:
    fp = get_by_investor(db, investor_id)
    if not fp:
        return None
    liability = FinancialLiability(financial_profile_id=fp.id, **data.model_dump())
    db.add(liability)
    db.flush()
    audit.log_event(
        db,
        event_type="liability.added",
        description=f"Liability '{liability.name}' added",
        investor_profile_id=investor_id,
        metadata={"liability_id": str(liability.id), "name": liability.name},
    )
    db.commit()
    db.refresh(liability)
    return liability


def update_liability(
    db: Session, investor_id: uuid.UUID, liability_id: uuid.UUID, data: FinancialLiabilityUpdate
) -> FinancialLiability | None:
    fp = get_by_investor(db, investor_id)
    if not fp:
        return None
    liability = db.get(FinancialLiability, liability_id)
    if not liability or liability.financial_profile_id != fp.id:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(liability, field, value)
    db.flush()
    audit.log_event(
        db,
        event_type="liability.updated",
        description=f"Liability '{liability.name}' updated",
        investor_profile_id=investor_id,
        metadata={"liability_id": str(liability_id)},
    )
    db.commit()
    db.refresh(liability)
    return liability


def remove_liability(
    db: Session, investor_id: uuid.UUID, liability_id: uuid.UUID
) -> bool:
    fp = get_by_investor(db, investor_id)
    if not fp:
        return False
    liability = db.get(FinancialLiability, liability_id)
    if not liability or liability.financial_profile_id != fp.id:
        return False
    audit.log_event(
        db,
        event_type="liability.removed",
        description=f"Liability '{liability.name}' removed",
        investor_profile_id=investor_id,
        metadata={"liability_id": str(liability_id)},
    )
    db.delete(liability)
    db.commit()
    return True

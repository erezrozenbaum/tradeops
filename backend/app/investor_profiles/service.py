import uuid

from sqlalchemy.orm import Session

from app.models.investor_profile import InvestorProfile
from app.schemas.investor_profile import InvestorProfileCreate, InvestorProfileUpdate
from app.audit import service as audit


def get(db: Session, investor_id: uuid.UUID) -> InvestorProfile | None:
    return db.get(InvestorProfile, investor_id)


def get_all(db: Session, skip: int = 0, limit: int = 100) -> list[InvestorProfile]:
    return db.query(InvestorProfile).offset(skip).limit(limit).all()


def create(db: Session, data: InvestorProfileCreate) -> InvestorProfile:
    profile = InvestorProfile(**data.model_dump())
    db.add(profile)
    db.flush()
    audit.log_event(
        db,
        event_type="investor_profile.created",
        description=f"Investor profile created for {profile.full_name}",
        investor_profile_id=profile.id,
    )
    db.commit()
    db.refresh(profile)
    return profile


def update(
    db: Session, investor_id: uuid.UUID, data: InvestorProfileUpdate
) -> InvestorProfile | None:
    profile = get(db, investor_id)
    if not profile:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(profile, field, value)
    db.flush()
    audit.log_event(
        db,
        event_type="investor_profile.updated",
        description=f"Investor profile updated for {profile.full_name}",
        investor_profile_id=profile.id,
        metadata=data.model_dump(exclude_none=True),
    )
    db.commit()
    db.refresh(profile)
    return profile


def delete(db: Session, investor_id: uuid.UUID) -> bool:
    profile = get(db, investor_id)
    if not profile:
        return False
    audit.log_event(
        db,
        event_type="investor_profile.deleted",
        description=f"Investor profile deleted: {profile.full_name}",
        investor_profile_id=profile.id,
    )
    db.delete(profile)
    db.commit()
    return True

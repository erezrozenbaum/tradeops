import uuid

from sqlalchemy.orm import Session

from app.models.family_profile import FamilyMember, FamilyProfile
from app.models.investor_profile import InvestorProfile
from app.schemas.family_profile import (
    FamilyMemberCreate,
    FamilyMemberUpdate,
    FamilyProfileCreate,
    FamilyProfileUpdate,
)
from app.audit import service as audit


def get(db: Session, family_id: uuid.UUID) -> FamilyProfile | None:
    return db.get(FamilyProfile, family_id)


def get_by_investor(db: Session, investor_id: uuid.UUID) -> list[FamilyProfile]:
    return (
        db.query(FamilyProfile)
        .filter(FamilyProfile.primary_investor_id == investor_id)
        .all()
    )


def create(db: Session, data: FamilyProfileCreate) -> FamilyProfile | None:
    if not db.get(InvestorProfile, data.primary_investor_id):
        return None
    family = FamilyProfile(**data.model_dump())
    db.add(family)
    db.flush()
    audit.log_event(
        db,
        event_type="family_profile.created",
        description=f"Family profile '{family.name}' created",
        investor_profile_id=data.primary_investor_id,
        metadata={"family_id": str(family.id)},
    )
    db.commit()
    db.refresh(family)
    return family


def update(
    db: Session, family_id: uuid.UUID, data: FamilyProfileUpdate
) -> FamilyProfile | None:
    family = get(db, family_id)
    if not family:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(family, field, value)
    db.flush()
    audit.log_event(
        db,
        event_type="family_profile.updated",
        description=f"Family profile '{family.name}' updated",
        investor_profile_id=family.primary_investor_id,
        metadata=data.model_dump(exclude_none=True),
    )
    db.commit()
    db.refresh(family)
    return family


def delete(db: Session, family_id: uuid.UUID) -> bool:
    family = get(db, family_id)
    if not family:
        return False
    audit.log_event(
        db,
        event_type="family_profile.deleted",
        description=f"Family profile '{family.name}' deleted",
        investor_profile_id=family.primary_investor_id,
        metadata={"family_id": str(family_id)},
    )
    db.delete(family)
    db.commit()
    return True


# ── Members ──────────────────────────────────────────────────────────────────


def add_member(
    db: Session, family_id: uuid.UUID, data: FamilyMemberCreate
) -> FamilyMember | None:
    family = get(db, family_id)
    if not family:
        return None
    member = FamilyMember(family_profile_id=family_id, **data.model_dump())
    db.add(member)
    db.flush()
    audit.log_event(
        db,
        event_type="family_member.added",
        description=f"Family member '{member.name}' added to '{family.name}'",
        investor_profile_id=family.primary_investor_id,
        metadata={"member_id": str(member.id), "name": member.name},
    )
    db.commit()
    db.refresh(member)
    return member


def update_member(
    db: Session, family_id: uuid.UUID, member_id: uuid.UUID, data: FamilyMemberUpdate
) -> FamilyMember | None:
    family = get(db, family_id)
    if not family:
        return None
    member = db.get(FamilyMember, member_id)
    if not member or member.family_profile_id != family_id:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(member, field, value)
    db.flush()
    audit.log_event(
        db,
        event_type="family_member.updated",
        description=f"Family member '{member.name}' updated",
        investor_profile_id=family.primary_investor_id,
        metadata={"member_id": str(member_id)},
    )
    db.commit()
    db.refresh(member)
    return member


def remove_member(
    db: Session, family_id: uuid.UUID, member_id: uuid.UUID
) -> bool:
    family = get(db, family_id)
    if not family:
        return False
    member = db.get(FamilyMember, member_id)
    if not member or member.family_profile_id != family_id:
        return False
    audit.log_event(
        db,
        event_type="family_member.removed",
        description=f"Family member '{member.name}' removed",
        investor_profile_id=family.primary_investor_id,
        metadata={"member_id": str(member_id)},
    )
    db.delete(member)
    db.commit()
    return True

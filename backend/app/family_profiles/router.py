import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.family_profiles import service
from app.schemas.family_profile import (
    FamilyMemberCreate,
    FamilyMemberOut,
    FamilyMemberUpdate,
    FamilyProfileCreate,
    FamilyProfileOut,
    FamilyProfileUpdate,
)

router = APIRouter()


@router.post("", response_model=FamilyProfileOut, status_code=status.HTTP_201_CREATED)
def create_family_profile(data: FamilyProfileCreate, db: Session = Depends(get_db)):
    family = service.create(db, data)
    if not family:
        raise HTTPException(status_code=404, detail="Primary investor profile not found")
    return family


@router.get("", response_model=list[FamilyProfileOut])
def list_family_profiles(
    investor_id: uuid.UUID = Query(..., description="Filter by primary investor"),
    db: Session = Depends(get_db),
):
    return service.get_by_investor(db, investor_id)


@router.get("/{family_id}", response_model=FamilyProfileOut)
def get_family_profile(family_id: uuid.UUID, db: Session = Depends(get_db)):
    family = service.get(db, family_id)
    if not family:
        raise HTTPException(status_code=404, detail="Family profile not found")
    return family


@router.put("/{family_id}", response_model=FamilyProfileOut)
def update_family_profile(
    family_id: uuid.UUID, data: FamilyProfileUpdate, db: Session = Depends(get_db)
):
    family = service.update(db, family_id, data)
    if not family:
        raise HTTPException(status_code=404, detail="Family profile not found")
    return family


@router.delete("/{family_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_family_profile(family_id: uuid.UUID, db: Session = Depends(get_db)):
    if not service.delete(db, family_id):
        raise HTTPException(status_code=404, detail="Family profile not found")


# ── Members ──────────────────────────────────────────────────────────────────


@router.post(
    "/{family_id}/members",
    response_model=FamilyMemberOut,
    status_code=status.HTTP_201_CREATED,
)
def add_member(
    family_id: uuid.UUID, data: FamilyMemberCreate, db: Session = Depends(get_db)
):
    member = service.add_member(db, family_id, data)
    if not member:
        raise HTTPException(status_code=404, detail="Family profile not found")
    return member


@router.put("/{family_id}/members/{member_id}", response_model=FamilyMemberOut)
def update_member(
    family_id: uuid.UUID,
    member_id: uuid.UUID,
    data: FamilyMemberUpdate,
    db: Session = Depends(get_db),
):
    member = service.update_member(db, family_id, member_id, data)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member


@router.delete("/{family_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    family_id: uuid.UUID, member_id: uuid.UUID, db: Session = Depends(get_db)
):
    if not service.remove_member(db, family_id, member_id):
        raise HTTPException(status_code=404, detail="Member not found")

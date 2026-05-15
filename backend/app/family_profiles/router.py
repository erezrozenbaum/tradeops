import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.family_profiles import service
from app.models.user import User
from app.schemas.family_profile import (
    FamilyMemberCreate,
    FamilyMemberOut,
    FamilyMemberUpdate,
    FamilyProfileCreate,
    FamilyProfileOut,
    FamilyProfileUpdate,
    InviteInfo,
    InviteOut,
    InviteRequest,
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


# ── Invites ───────────────────────────────────────────────────────────────────


@router.post("/{family_id}/members/{member_id}/invite", response_model=InviteOut)
def send_invite(
    family_id: uuid.UUID,
    member_id: uuid.UUID,
    data: InviteRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Generate an invite link for a family member to link their own account."""
    member = service.create_invite(db, family_id, member_id, data.email)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found or is the primary member")
    base = str(request.base_url).rstrip("/")
    return InviteOut(
        token=member.invite_token,
        invite_url=f"{base}/join?token={member.invite_token}",
        email=member.invite_email,
        expires_at=member.invite_expires_at,
    )


@router.get("/invite/{token}", response_model=InviteInfo)
def get_invite_info(token: str, db: Session = Depends(get_db)):
    """Return invite metadata for the /join page (no auth required)."""
    member = service.get_invite_by_token(db, token)
    if not member:
        raise HTTPException(status_code=404, detail="Invite not found")
    from datetime import datetime, timezone
    if member.invite_status == "pending" and member.invite_expires_at and member.invite_expires_at < datetime.now(timezone.utc):
        member.invite_status = "expired"
        db.commit()
    return InviteInfo(
        family_name=member.family.name,
        member_name=member.name,
        relationship_type=member.relationship_type,
        status=member.invite_status,
    )


@router.post("/invite/{token}/accept", response_model=FamilyMemberOut)
def accept_invite(
    token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Accept a family invite — links the authenticated user's investor profile to the member."""
    from app.models.investor_profile import InvestorProfile
    investor = (
        db.query(InvestorProfile)
        .filter(InvestorProfile.user_id == current_user.id)
        .first()
    )
    if not investor:
        raise HTTPException(status_code=404, detail="No investor profile found for this user")
    member = service.accept_invite(db, token, investor.id)
    if not member:
        raise HTTPException(status_code=400, detail="Invite is invalid, expired, or already used")
    return member

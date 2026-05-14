import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.admin.dependencies import require_admin
from app.admin.schemas import AdminProfileOut, AdminStats, AdminUserOut, AssignProfile, RoleUpdate
from app.db.session import get_db
from app.models.investor_profile import InvestorProfile
from app.models.user import User

router = APIRouter()


@router.get("/stats", response_model=AdminStats)
def get_stats(db: Session = Depends(get_db), _=Depends(require_admin)):
    total_users = db.query(User).count()
    total_profiles = db.query(InvestorProfile).count()
    unassigned = db.query(InvestorProfile).filter(InvestorProfile.user_id.is_(None)).count()
    return AdminStats(total_users=total_users, total_profiles=total_profiles, unassigned_profiles=unassigned)


@router.get("/users", response_model=list[AdminUserOut])
def list_users(db: Session = Depends(get_db), _=Depends(require_admin)):
    users = db.query(User).order_by(User.created_at).all()
    result = []
    for u in users:
        count = db.query(InvestorProfile).filter(InvestorProfile.user_id == u.id).count()
        result.append(AdminUserOut(
            id=u.id, email=u.email, role=u.role, created_at=u.created_at, profile_count=count
        ))
    return result


@router.patch("/users/{user_id}/role", response_model=AdminUserOut)
def update_role(user_id: uuid.UUID, data: RoleUpdate, db: Session = Depends(get_db), _=Depends(require_admin)):
    if data.role not in ("user", "admin"):
        raise HTTPException(status_code=400, detail="Role must be 'user' or 'admin'")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = data.role
    db.commit()
    db.refresh(user)
    count = db.query(InvestorProfile).filter(InvestorProfile.user_id == user.id).count()
    return AdminUserOut(id=user.id, email=user.email, role=user.role, created_at=user.created_at, profile_count=count)


@router.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: uuid.UUID, db: Session = Depends(get_db), _=Depends(require_admin)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()


@router.get("/profiles", response_model=list[AdminProfileOut])
def list_profiles(db: Session = Depends(get_db), _=Depends(require_admin)):
    profiles = db.query(InvestorProfile).order_by(InvestorProfile.created_at).all()
    result = []
    for p in profiles:
        email = None
        if p.user_id:
            u = db.get(User, p.user_id)
            email = u.email if u else None
        result.append(AdminProfileOut(
            id=p.id, full_name=p.full_name, country=p.country,
            base_currency=p.base_currency, user_id=p.user_id,
            user_email=email, created_at=p.created_at,
        ))
    return result


@router.patch("/profiles/{profile_id}/assign", response_model=AdminProfileOut)
def assign_profile(profile_id: uuid.UUID, data: AssignProfile, db: Session = Depends(get_db), _=Depends(require_admin)):
    profile = db.get(InvestorProfile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    if data.user_id is not None and not db.get(User, data.user_id):
        raise HTTPException(status_code=404, detail="User not found")
    profile.user_id = data.user_id
    db.commit()
    db.refresh(profile)
    email = None
    if profile.user_id:
        u = db.get(User, profile.user_id)
        email = u.email if u else None
    return AdminProfileOut(
        id=profile.id, full_name=profile.full_name, country=profile.country,
        base_currency=profile.base_currency, user_id=profile.user_id,
        user_email=email, created_at=profile.created_at,
    )

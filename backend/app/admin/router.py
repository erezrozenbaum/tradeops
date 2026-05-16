import uuid
from datetime import datetime, timezone, timedelta
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.admin.dependencies import require_admin
from app.admin.schemas import (
    AdminProfileOut, AdminStats, AdminUserOut, AssignProfile, RoleUpdate,
    AiUsageSummary, AiUsageFeatureRow, AiUsageUserRow,
)
from app.db.session import get_db
from app.models.investor_profile import InvestorProfile
from app.models.user import User
from app.models.ai_usage_log import AiUsageLog

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
    counts = dict(
        db.query(InvestorProfile.user_id, func.count(InvestorProfile.id))
        .filter(InvestorProfile.user_id.isnot(None))
        .group_by(InvestorProfile.user_id)
        .all()
    )
    return [
        AdminUserOut(id=u.id, email=u.email, role=u.role, created_at=u.created_at, profile_count=counts.get(u.id, 0))
        for u in users
    ]


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
    user_ids = {p.user_id for p in profiles if p.user_id}
    users = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}
    return [
        AdminProfileOut(
            id=p.id, full_name=p.full_name, country=p.country,
            base_currency=p.base_currency, user_id=p.user_id,
            user_email=users[p.user_id].email if p.user_id and p.user_id in users else None,
            created_at=p.created_at,
        )
        for p in profiles
    ]


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


@router.get("/ai-usage", response_model=AiUsageSummary)
def get_ai_usage(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    logs = (
        db.query(AiUsageLog)
        .filter(AiUsageLog.called_at >= since)
        .order_by(AiUsageLog.called_at.desc())
        .all()
    )

    # Build investor_id → user email lookup
    investor_email: dict[uuid.UUID, str | None] = {}
    for log_entry in logs:
        if log_entry.investor_id and log_entry.investor_id not in investor_email:
            profile = db.get(InvestorProfile, log_entry.investor_id)
            if profile and profile.user_id:
                user = db.get(User, profile.user_id)
                investor_email[log_entry.investor_id] = user.email if user else None
            else:
                investor_email[log_entry.investor_id] = None

    # Aggregate by feature
    feature_agg: dict[str, dict] = defaultdict(lambda: {"calls": 0, "input_tokens": 0, "output_tokens": 0, "cost_usd": 0.0})
    for l in logs:
        feature_agg[l.feature_name]["calls"] += 1
        feature_agg[l.feature_name]["input_tokens"] += l.input_tokens
        feature_agg[l.feature_name]["output_tokens"] += l.output_tokens
        feature_agg[l.feature_name]["cost_usd"] += l.cost_usd

    by_feature = [
        AiUsageFeatureRow(feature_name=k, **v)
        for k, v in sorted(feature_agg.items(), key=lambda x: -x[1]["cost_usd"])
    ]

    # Aggregate by investor
    investor_agg: dict[uuid.UUID | None, dict] = defaultdict(
        lambda: {"calls": 0, "input_tokens": 0, "output_tokens": 0, "cost_usd": 0.0, "by_feature": defaultdict(lambda: {"calls": 0, "input_tokens": 0, "output_tokens": 0, "cost_usd": 0.0})}
    )
    for l in logs:
        key = l.investor_id
        investor_agg[key]["calls"] += 1
        investor_agg[key]["input_tokens"] += l.input_tokens
        investor_agg[key]["output_tokens"] += l.output_tokens
        investor_agg[key]["cost_usd"] += l.cost_usd
        investor_agg[key]["by_feature"][l.feature_name]["calls"] += 1
        investor_agg[key]["by_feature"][l.feature_name]["input_tokens"] += l.input_tokens
        investor_agg[key]["by_feature"][l.feature_name]["output_tokens"] += l.output_tokens
        investor_agg[key]["by_feature"][l.feature_name]["cost_usd"] += l.cost_usd

    by_user = []
    for inv_id, agg in sorted(investor_agg.items(), key=lambda x: -x[1]["cost_usd"]):
        user_features = [
            AiUsageFeatureRow(feature_name=k, **v)
            for k, v in sorted(agg["by_feature"].items(), key=lambda x: -x[1]["cost_usd"])
        ]
        by_user.append(AiUsageUserRow(
            user_email=investor_email.get(inv_id) if inv_id else None,
            investor_id=inv_id,
            calls=agg["calls"],
            input_tokens=agg["input_tokens"],
            output_tokens=agg["output_tokens"],
            cost_usd=round(agg["cost_usd"], 6),
            by_feature=user_features,
        ))

    total_cost = sum(l.cost_usd for l in logs)
    total_in = sum(l.input_tokens for l in logs)
    total_out = sum(l.output_tokens for l in logs)

    return AiUsageSummary(
        period_label=f"Last {days} days",
        total_calls=len(logs),
        total_input_tokens=total_in,
        total_output_tokens=total_out,
        total_cost_usd=round(total_cost, 6),
        by_feature=by_feature,
        by_user=by_user,
    )

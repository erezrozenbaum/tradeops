import uuid

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.investor_profile import InvestorProfile
from app.models.user import User


def verify_investor_access(
    investor_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Raises 404 if investor_id does not belong to current_user.

    Applied at include_router level so every investor-scoped endpoint
    is protected without duplicating the check in each handler.
    """
    profile = db.get(InvestorProfile, investor_id)
    if not profile or profile.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Investor profile not found")

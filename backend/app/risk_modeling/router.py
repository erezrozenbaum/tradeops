import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.risk_modeling import service
from app.schemas.risk_model import RiskModelOut

router = APIRouter()


@router.post(
    "",
    response_model=RiskModelOut,
    status_code=status.HTTP_201_CREATED,
    summary="Generate a new risk model snapshot",
)
def generate_risk_model(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    rm = service.generate(db, investor_id)
    if rm is None:
        raise HTTPException(
            status_code=422,
            detail="Cannot generate risk model — investor not found or financial profile is missing.",
        )
    return rm


@router.get("", response_model=RiskModelOut, summary="Get the latest risk model")
def get_latest_risk_model(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    rm = service.get_latest(db, investor_id)
    if not rm:
        raise HTTPException(
            status_code=404,
            detail="No risk model found. Generate one first.",
        )
    return rm


@router.get(
    "/history",
    response_model=list[RiskModelOut],
    summary="Full history of generated risk models (newest first)",
)
def get_risk_model_history(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    return service.get_history(db, investor_id)

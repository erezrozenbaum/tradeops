import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.crypto_staking import service
from app.crypto_staking.schemas import EnableStakingRequest, StakingReport, StakingToggleOut

router = APIRouter()


@router.get("", response_model=StakingReport)
def get_staking_report(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    """Return staking yield report for all staked crypto holdings.

    Shows estimated annual rewards (native + base currency) and tax treatment note.
    Uses cached prices — no live fetch.
    """
    return service.build_staking_report(db, investor_id)


@router.post("/{holding_id}", response_model=StakingToggleOut)
def enable_staking(
    investor_id: uuid.UUID,
    holding_id: uuid.UUID,
    body: EnableStakingRequest,
    db: Session = Depends(get_db),
):
    """Enable staking on a crypto holding and set the APY."""
    holding = service.enable_staking(db, investor_id, holding_id, body.staking_apy)
    if not holding:
        raise HTTPException(
            status_code=404,
            detail="Holding not found or is not a crypto asset. Only crypto holdings can be staked.",
        )
    return holding


@router.delete("/{holding_id}", response_model=StakingToggleOut)
def disable_staking(
    investor_id: uuid.UUID,
    holding_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """Disable staking on a crypto holding (clears fund_status and APY)."""
    holding = service.disable_staking(db, investor_id, holding_id)
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found or is not a crypto asset.")
    return holding

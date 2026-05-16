"""Live Trading router — gated real-money order execution via IBKR."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.live_trading import engine as gate_engine
from app.live_trading import service
from app.live_trading.schemas import (
    AcknowledgeRiskRequest,
    HaltRequest,
    LiveOrderOut,
    LiveTradingReadiness,
    LiveTradingSessionOut,
    OrderRequest,
)

router = APIRouter()


@router.get("/status", response_model=LiveTradingReadiness)
def get_readiness(
    investor_id: uuid.UUID,
    gateway_url: str | None = Query(None),
    ibkr_account_id: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """Check all 5 unlock gates. Pass gateway_url + ibkr_account_id to also test IBKR connectivity."""
    return gate_engine.check_readiness(
        db, investor_id, gateway_url=gateway_url, ibkr_account_id=ibkr_account_id
    )


@router.post("/acknowledge", response_model=LiveTradingSessionOut)
def acknowledge_risk(
    investor_id: uuid.UUID,
    body: AcknowledgeRiskRequest,
    db: Session = Depends(get_db),
):
    """Sign the real-money risk acknowledgment. Requires confirmation='I UNDERSTAND'."""
    return service.acknowledge_risk(db, investor_id, body)


@router.post("/session", response_model=LiveTradingSessionOut)
def activate_session(
    investor_id: uuid.UUID,
    gateway_url: str = Query(...),
    ibkr_account_id: str = Query(...),
    db: Session = Depends(get_db),
):
    """Activate live trading session. All 5 gates must pass."""
    session, error = service.activate_session(db, investor_id, gateway_url, ibkr_account_id)
    if error:
        raise HTTPException(status_code=422, detail=error)
    return session


@router.post("/halt", response_model=LiveTradingSessionOut)
def halt_session(
    investor_id: uuid.UUID,
    body: HaltRequest,
    db: Session = Depends(get_db),
):
    """Kill switch — immediately halts live trading and cancels all open orders."""
    session = service.halt(db, investor_id, reason=body.reason)
    if session is None:
        raise HTTPException(status_code=404, detail="No active live trading session.")
    return session


@router.post("/orders", response_model=LiveOrderOut)
def submit_order(
    investor_id: uuid.UUID,
    body: OrderRequest,
    db: Session = Depends(get_db),
):
    """Submit a live order. Requires an active session. All risk gates enforced."""
    order, error = service.submit_order(db, investor_id, body)
    if order is None:
        raise HTTPException(status_code=422, detail=error)
    # Return the order even if rejected, so the UI can show the rejection reason
    return order


@router.get("/orders", response_model=list[LiveOrderOut])
def list_orders(
    investor_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    return service.list_orders(db, investor_id)

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.staged_orders import service
from app.staged_orders.schemas import (
    GenerateRebalanceResult,
    StagedOrderCreate,
    StagedOrderList,
    StagedOrderOut,
)

router = APIRouter()


@router.get("", response_model=StagedOrderList)
def list_orders(
    investor_id: uuid.UUID,
    status: str | None = None,
    db: Session = Depends(get_db),
):
    return service.list_staged_orders(db, investor_id, status=status)


@router.post("", response_model=StagedOrderOut, status_code=201)
def create_order(
    investor_id: uuid.UUID,
    payload: StagedOrderCreate,
    db: Session = Depends(get_db),
):
    return service.create_staged_order(db, investor_id, payload)


@router.post("/generate-rebalance", response_model=GenerateRebalanceResult)
def generate_rebalance(
    investor_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """Generate the minimum set of orders to reach risk-model targets.

    Sells are sequenced before buys (tax-efficient) and each order includes
    pre-flight review and tax analysis.
    """
    try:
        return service.generate_minimum_rebalance(db, investor_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/{order_id}/execute", response_model=StagedOrderOut)
def execute_order(
    investor_id: uuid.UUID,
    order_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    try:
        return service.mark_executed(db, investor_id, order_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.delete("/{order_id}", response_model=StagedOrderOut)
def cancel_order(
    investor_id: uuid.UUID,
    order_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    try:
        return service.cancel_order(db, investor_id, order_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

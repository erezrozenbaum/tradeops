import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.investment_account import (
    InvestmentAccountCreate,
    InvestmentAccountOut,
    InvestmentAccountUpdate,
    InvestmentHoldingCreate,
    InvestmentHoldingOut,
    InvestmentHoldingUpdate,
)
from app.holdings import service

router = APIRouter()


# ── Accounts ─────────────────────────────────────────────────────────────────

@router.get("/{investor_id}/accounts", response_model=list[InvestmentAccountOut])
def list_accounts(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    return service.list_accounts(db, investor_id)


@router.post(
    "/{investor_id}/accounts",
    response_model=InvestmentAccountOut,
    status_code=status.HTTP_201_CREATED,
)
def create_account(
    investor_id: uuid.UUID, data: InvestmentAccountCreate, db: Session = Depends(get_db)
):
    account = service.create_account(db, investor_id, data)
    if not account:
        raise HTTPException(status_code=404, detail="Investor not found")
    return account


@router.get("/{investor_id}/accounts/{account_id}", response_model=InvestmentAccountOut)
def get_account(investor_id: uuid.UUID, account_id: uuid.UUID, db: Session = Depends(get_db)):
    account = service.get_account(db, investor_id, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@router.put("/{investor_id}/accounts/{account_id}", response_model=InvestmentAccountOut)
def update_account(
    investor_id: uuid.UUID,
    account_id: uuid.UUID,
    data: InvestmentAccountUpdate,
    db: Session = Depends(get_db),
):
    account = service.update_account(db, investor_id, account_id, data)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@router.delete("/{investor_id}/accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(investor_id: uuid.UUID, account_id: uuid.UUID, db: Session = Depends(get_db)):
    if not service.delete_account(db, investor_id, account_id):
        raise HTTPException(status_code=404, detail="Account not found")


# ── Holdings ─────────────────────────────────────────────────────────────────

@router.get(
    "/{investor_id}/accounts/{account_id}/holdings",
    response_model=list[InvestmentHoldingOut],
)
def list_holdings(
    investor_id: uuid.UUID, account_id: uuid.UUID, db: Session = Depends(get_db)
):
    account = service.get_account(db, investor_id, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return service.list_holdings(db, account_id)


@router.post(
    "/{investor_id}/accounts/{account_id}/holdings",
    response_model=InvestmentHoldingOut,
    status_code=status.HTTP_201_CREATED,
)
def add_holding(
    investor_id: uuid.UUID,
    account_id: uuid.UUID,
    data: InvestmentHoldingCreate,
    db: Session = Depends(get_db),
):
    holding = service.add_holding(db, investor_id, account_id, data)
    if not holding:
        raise HTTPException(status_code=404, detail="Account not found")
    return holding


@router.put(
    "/{investor_id}/accounts/{account_id}/holdings/{holding_id}",
    response_model=InvestmentHoldingOut,
)
def update_holding(
    investor_id: uuid.UUID,
    account_id: uuid.UUID,
    holding_id: uuid.UUID,
    data: InvestmentHoldingUpdate,
    db: Session = Depends(get_db),
):
    holding = service.update_holding(db, investor_id, account_id, holding_id, data)
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    return holding


@router.delete(
    "/{investor_id}/accounts/{account_id}/holdings/{holding_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_holding(
    investor_id: uuid.UUID,
    account_id: uuid.UUID,
    holding_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    if not service.delete_holding(db, investor_id, account_id, holding_id):
        raise HTTPException(status_code=404, detail="Holding not found")

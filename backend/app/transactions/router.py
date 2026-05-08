import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.transactions import service
from app.transactions.schemas import TransactionCreate, TransactionOut, TransactionUpdate

router = APIRouter()


@router.get("", response_model=list[TransactionOut])
def list_transactions(
    investor_id: uuid.UUID,
    account_id: uuid.UUID | None = None,
    ticker: str | None = None,
    tx_type: str | None = None,
    since: date | None = None,
    until: date | None = None,
    limit: int = 200,
    db: Session = Depends(get_db),
):
    return service.list_transactions(
        db, investor_id, account_id=account_id, ticker=ticker,
        tx_type=tx_type, since=since, until=until, limit=limit,
    )


@router.post("", response_model=TransactionOut, status_code=201)
def create_transaction(
    investor_id: uuid.UUID,
    body: TransactionCreate,
    db: Session = Depends(get_db),
):
    if body.transaction_type not in {"buy", "sell", "dividend", "fee", "split", "bonus"}:
        raise HTTPException(status_code=422, detail="Invalid transaction_type")
    return service.create_transaction(db, investor_id, body)


@router.get("/{tx_id}", response_model=TransactionOut)
def get_transaction(tx_id: uuid.UUID, investor_id: uuid.UUID, db: Session = Depends(get_db)):
    tx = service.get_transaction(db, tx_id)
    if not tx or tx.investor_id != investor_id:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return tx


@router.put("/{tx_id}", response_model=TransactionOut)
def update_transaction(
    tx_id: uuid.UUID,
    investor_id: uuid.UUID,
    body: TransactionUpdate,
    db: Session = Depends(get_db),
):
    tx = service.get_transaction(db, tx_id)
    if not tx or tx.investor_id != investor_id:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return service.update_transaction(db, tx, body)


@router.delete("/{tx_id}", status_code=204)
def delete_transaction(tx_id: uuid.UUID, investor_id: uuid.UUID, db: Session = Depends(get_db)):
    tx = service.get_transaction(db, tx_id)
    if not tx or tx.investor_id != investor_id:
        raise HTTPException(status_code=404, detail="Transaction not found")
    service.delete_transaction(db, tx)

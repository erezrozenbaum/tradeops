import uuid
from datetime import date

from sqlalchemy.orm import Session

from app.models.holding_transaction import HoldingTransaction
from app.transactions.schemas import TransactionCreate, TransactionUpdate


def list_transactions(
    db: Session,
    investor_id: uuid.UUID,
    account_id: uuid.UUID | None = None,
    ticker: str | None = None,
    tx_type: str | None = None,
    since: date | None = None,
    until: date | None = None,
    skip: int = 0,
    limit: int = 200,
) -> list[HoldingTransaction]:
    q = db.query(HoldingTransaction).filter(HoldingTransaction.investor_id == investor_id)
    if account_id:
        q = q.filter(HoldingTransaction.account_id == account_id)
    if ticker:
        q = q.filter(HoldingTransaction.ticker == ticker.upper())
    if tx_type:
        q = q.filter(HoldingTransaction.transaction_type == tx_type)
    if since:
        q = q.filter(HoldingTransaction.transaction_date >= since)
    if until:
        q = q.filter(HoldingTransaction.transaction_date <= until)
    return q.order_by(HoldingTransaction.transaction_date.desc()).offset(skip).limit(limit).all()


def get_transaction(db: Session, tx_id: uuid.UUID) -> HoldingTransaction | None:
    return db.get(HoldingTransaction, tx_id)


def create_transaction(
    db: Session, investor_id: uuid.UUID, data: TransactionCreate
) -> HoldingTransaction:
    tx = HoldingTransaction(
        id=uuid.uuid4(),
        investor_id=investor_id,
        account_id=data.account_id,
        holding_id=data.holding_id,
        transaction_type=data.transaction_type,
        ticker=data.ticker.upper() if data.ticker else None,
        asset_name=data.asset_name,
        quantity=data.quantity,
        price_per_unit=data.price_per_unit,
        total_amount=data.total_amount,
        fees=data.fees,
        currency=data.currency,
        transaction_date=data.transaction_date,
        notes=data.notes,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


def update_transaction(
    db: Session, tx: HoldingTransaction, data: TransactionUpdate
) -> HoldingTransaction:
    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "ticker" and value:
            value = value.upper()
        setattr(tx, field, value)
    db.commit()
    db.refresh(tx)
    return tx


def delete_transaction(db: Session, tx: HoldingTransaction) -> None:
    db.delete(tx)
    db.commit()

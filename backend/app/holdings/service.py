import uuid

from sqlalchemy.orm import Session

from app.models.investment_account import InvestmentAccount, InvestmentHolding
from app.models.investor_profile import InvestorProfile
from app.schemas.investment_account import (
    InvestmentAccountCreate,
    InvestmentAccountUpdate,
    InvestmentHoldingCreate,
    InvestmentHoldingUpdate,
)
from app.audit import service as audit


# ── Accounts ─────────────────────────────────────────────────────────────────

def list_accounts(db: Session, investor_id: uuid.UUID) -> list[InvestmentAccount]:
    return (
        db.query(InvestmentAccount)
        .filter(InvestmentAccount.investor_id == investor_id)
        .order_by(InvestmentAccount.created_at)
        .all()
    )


def get_account(db: Session, investor_id: uuid.UUID, account_id: uuid.UUID) -> InvestmentAccount | None:
    return (
        db.query(InvestmentAccount)
        .filter(InvestmentAccount.id == account_id, InvestmentAccount.investor_id == investor_id)
        .first()
    )


def create_account(
    db: Session, investor_id: uuid.UUID, data: InvestmentAccountCreate
) -> InvestmentAccount | None:
    if not db.get(InvestorProfile, investor_id):
        return None
    account = InvestmentAccount(investor_id=investor_id, **data.model_dump())
    db.add(account)
    db.flush()
    audit.log_event(
        db,
        event_type="investment_account.created",
        description=f"Investment account created: {data.provider_name} ({data.account_type})",
        investor_profile_id=investor_id,
    )
    db.commit()
    db.refresh(account)
    return account


def update_account(
    db: Session, investor_id: uuid.UUID, account_id: uuid.UUID, data: InvestmentAccountUpdate
) -> InvestmentAccount | None:
    account = get_account(db, investor_id, account_id)
    if not account:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(account, field, value)
    db.commit()
    db.refresh(account)
    return account


def delete_account(db: Session, investor_id: uuid.UUID, account_id: uuid.UUID) -> bool:
    account = get_account(db, investor_id, account_id)
    if not account:
        return False
    db.delete(account)
    db.commit()
    return True


# ── Holdings ─────────────────────────────────────────────────────────────────

def list_holdings(db: Session, account_id: uuid.UUID) -> list[InvestmentHolding]:
    return (
        db.query(InvestmentHolding)
        .filter(InvestmentHolding.account_id == account_id)
        .order_by(InvestmentHolding.created_at)
        .all()
    )


def get_holding(db: Session, account_id: uuid.UUID, holding_id: uuid.UUID) -> InvestmentHolding | None:
    return (
        db.query(InvestmentHolding)
        .filter(InvestmentHolding.id == holding_id, InvestmentHolding.account_id == account_id)
        .first()
    )


def add_holding(
    db: Session,
    investor_id: uuid.UUID,
    account_id: uuid.UUID,
    data: InvestmentHoldingCreate,
) -> InvestmentHolding | None:
    account = get_account(db, investor_id, account_id)
    if not account:
        return None
    holding = InvestmentHolding(account_id=account_id, **data.model_dump())
    db.add(holding)
    db.flush()
    audit.log_event(
        db,
        event_type="investment_holding.added",
        description=f"Holding added: {data.name} ({data.ticker or data.isin or 'no ticker'})",
        investor_profile_id=investor_id,
    )
    db.commit()
    db.refresh(holding)
    return holding


def update_holding(
    db: Session,
    investor_id: uuid.UUID,
    account_id: uuid.UUID,
    holding_id: uuid.UUID,
    data: InvestmentHoldingUpdate,
) -> InvestmentHolding | None:
    account = get_account(db, investor_id, account_id)
    if not account:
        return None
    holding = get_holding(db, account_id, holding_id)
    if not holding:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(holding, field, value)
    db.commit()
    db.refresh(holding)
    return holding


def delete_holding(
    db: Session,
    investor_id: uuid.UUID,
    account_id: uuid.UUID,
    holding_id: uuid.UUID,
) -> bool:
    account = get_account(db, investor_id, account_id)
    if not account:
        return False
    holding = get_holding(db, account_id, holding_id)
    if not holding:
        return False
    db.delete(holding)
    db.commit()
    return True

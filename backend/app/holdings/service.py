import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.investment_account import InvestmentAccount, InvestmentHolding
from app.models.investor_profile import InvestorProfile
from app.schemas.investment_account import (
    AutoSyncUpdate,
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


def set_auto_sync(
    db: Session, investor_id: uuid.UUID, account_id: uuid.UUID, data: AutoSyncUpdate
) -> InvestmentAccount | None:
    account = get_account(db, investor_id, account_id)
    if not account:
        return None
    account.auto_sync_enabled = data.auto_sync_enabled
    if data.sync_broker_type is not None:
        account.sync_broker_type = data.sync_broker_type
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

    holding_data = data.model_dump()

    # Auto-capture FX rate at purchase time for FX impact analysis
    # Use historical rate on purchase_date when known; fall back to current rate.
    try:
        investor = db.get(InvestorProfile, investor_id)
        if investor and data.currency and data.currency != investor.base_currency:
            rate: float | None = None
            if data.purchase_date:
                from app.currency_engine.history import get_rate_at_date
                rate = get_rate_at_date(db, investor.base_currency, data.currency, data.purchase_date)
            if not rate:
                from app.currency_engine.rates import get_rate
                rate = get_rate(db, investor.base_currency, data.currency)
            if rate and rate > 0:
                holding_data["purchase_fx_rate"] = rate
    except Exception:
        pass  # non-blocking — analysis will show "unavailable" for this holding

    if holding_data.get("current_balance") is not None:
        holding_data["balance_updated_at"] = datetime.now(timezone.utc)

    holding = InvestmentHolding(account_id=account_id, **holding_data)
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
    update_data = data.model_dump(exclude_unset=True)
    if "current_balance" in update_data and update_data["current_balance"] is not None:
        update_data["balance_updated_at"] = datetime.now(timezone.utc)
    for field, value in update_data.items():
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

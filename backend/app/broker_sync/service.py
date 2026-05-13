"""Upsert broker-imported rows into investment_holdings.

Match strategy (in order):
  1. ISIN match within the account
  2. Ticker match within the account
  3. Name match (case-insensitive) within the account

If matched → update quantity, avg_buy_price, current_value.
If not matched → create new holding.
"""
import uuid

from sqlalchemy.orm import Session

from app.broker_sync.schemas import BrokerImportRow, BrokerSyncResult
from app.models.investment_account import InvestmentAccount, InvestmentHolding


def _find_holding(
    db: Session,
    account_id: uuid.UUID,
    row: BrokerImportRow,
) -> InvestmentHolding | None:
    holdings = (
        db.query(InvestmentHolding)
        .filter(InvestmentHolding.account_id == account_id)
        .all()
    )

    # ISIN match
    if row.isin:
        for h in holdings:
            if h.isin and h.isin.upper() == row.isin.upper():
                return h

    # Ticker match
    if row.ticker:
        for h in holdings:
            if h.ticker and h.ticker.upper() == row.ticker.upper():
                return h

    # Name match (case-insensitive)
    for h in holdings:
        if h.name.strip().lower() == row.name.strip().lower():
            return h

    return None


def sync_holdings(
    db: Session,
    account_id: uuid.UUID,
    investor_id: uuid.UUID,
    rows: list[BrokerImportRow],
    broker_type: str,
) -> BrokerSyncResult:
    account = (
        db.query(InvestmentAccount)
        .filter(
            InvestmentAccount.id == account_id,
            InvestmentAccount.investor_id == investor_id,
        )
        .first()
    )
    if not account:
        return BrokerSyncResult(
            broker_type=broker_type,
            imported=0,
            updated=0,
            skipped=0,
            errors=["Account not found or does not belong to this investor"],
        )

    imported = updated = skipped = 0
    errors: list[str] = []

    for row in rows:
        if not row.name:
            skipped += 1
            continue

        existing = _find_holding(db, account_id, row)

        if existing:
            existing.quantity = row.quantity
            existing.avg_buy_price = row.avg_buy_price
            if row.current_value is not None:
                existing.current_value = row.current_value
            if row.isin and not existing.isin:
                existing.isin = row.isin
            if row.ticker and not existing.ticker:
                existing.ticker = row.ticker
            updated += 1
        else:
            new_holding = InvestmentHolding(
                account_id=account_id,
                ticker=row.ticker,
                isin=row.isin,
                name=row.name,
                asset_type=row.asset_type,
                quantity=row.quantity,
                avg_buy_price=row.avg_buy_price,
                currency=row.currency,
                current_value=row.current_value,
                fees=0.0,
            )
            db.add(new_holding)
            imported += 1

    db.commit()

    return BrokerSyncResult(
        broker_type=broker_type,
        imported=imported,
        updated=updated,
        skipped=skipped,
        errors=errors,
    )

"""Broker sync status service — aggregates per-account sync health and order drift."""
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session


def get_sync_status(db: Session, investor_id: uuid.UUID) -> dict:
    from app.models.investment_account import InvestmentAccount
    from app.models.investment_holding import InvestmentHolding
    from app.models.staged_order import StagedOrder
    from app.models.price_snapshot import PriceSnapshot

    # All accounts for this investor
    accounts = (
        db.query(InvestmentAccount)
        .filter(InvestmentAccount.investor_id == investor_id)
        .order_by(InvestmentAccount.created_at.desc())
        .all()
    )

    account_rows = []
    for acc in accounts:
        holding_count = (
            db.query(InvestmentHolding)
            .filter(InvestmentHolding.account_id == acc.id)
            .count()
        )
        last_synced = acc.last_synced_at
        if last_synced and last_synced.tzinfo is None:
            last_synced = last_synced.replace(tzinfo=timezone.utc)

        account_rows.append({
            "id": str(acc.id),
            "name": acc.account_name or acc.provider_name or "Unnamed Account",
            "provider": acc.provider_name,
            "account_type": acc.account_type,
            "currency": acc.currency,
            "auto_sync_enabled": acc.auto_sync_enabled,
            "sync_broker_type": acc.sync_broker_type,
            "last_synced_at": last_synced.isoformat() if last_synced else None,
            "holding_count": holding_count,
            "sync_status": _sync_status_label(last_synced),
        })

    # Pending staged orders
    pending_orders = (
        db.query(StagedOrder)
        .filter(
            StagedOrder.investor_id == investor_id,
            StagedOrder.status == "pending",
        )
        .all()
    )

    # Build drift: pending orders matched against current holdings
    drift_rows = []
    for order in pending_orders:
        if not order.ticker:
            drift_rows.append({
                "ticker": None,
                "name": order.name,
                "staged_action": order.action,
                "staged_value": order.estimated_value,
                "staged_currency": order.currency,
                "current_holding_qty": None,
                "current_holding_value": None,
                "order_id": str(order.id),
                "created_at": order.created_at.isoformat() if order.created_at else None,
            })
            continue

        holding = (
            db.query(InvestmentHolding)
            .join(InvestmentAccount, InvestmentHolding.account_id == InvestmentAccount.id)
            .filter(
                InvestmentAccount.investor_id == investor_id,
                InvestmentHolding.ticker == order.ticker,
            )
            .first()
        )
        drift_rows.append({
            "ticker": order.ticker,
            "name": order.name,
            "staged_action": order.action,
            "staged_value": order.estimated_value,
            "staged_currency": order.currency,
            "current_holding_qty": float(holding.quantity) if holding else 0.0,
            "current_holding_value": float(holding.current_value) if holding and holding.current_value else None,
            "order_id": str(order.id),
            "created_at": order.created_at.isoformat() if order.created_at else None,
        })

    # Last global price refresh (newest PriceSnapshot)
    latest_snap = (
        db.query(PriceSnapshot)
        .order_by(PriceSnapshot.fetched_at.desc())
        .first()
    )
    last_price_refresh = None
    if latest_snap:
        ts = latest_snap.fetched_at
        if ts and ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        last_price_refresh = ts.isoformat() if ts else None

    return {
        "accounts": account_rows,
        "pending_order_drift": drift_rows,
        "total_pending_orders": len(pending_orders),
        "last_price_refresh": last_price_refresh,
    }


def _sync_status_label(last_synced: datetime | None) -> str:
    if not last_synced:
        return "never"
    now = datetime.now(timezone.utc)
    hours = (now - last_synced).total_seconds() / 3600
    if hours < 25:
        return "fresh"
    if hours < 72:
        return "stale"
    return "outdated"

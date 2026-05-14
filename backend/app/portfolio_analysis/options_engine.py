"""Pure options P&L engine — no DB access."""
from datetime import date

_OPTION_TYPES = {"call_option", "put_option"}
_DEFAULT_MULTIPLIER = 100.0


def days_to_expiry(expiry_date: date | None) -> int | None:
    if not expiry_date:
        return None
    return max(0, (expiry_date - date.today()).days)


def expiry_status(days: int | None) -> str:
    if days is None:
        return "unknown"
    if days == 0:
        return "expired"
    if days <= 7:
        return "critical"
    if days <= 30:
        return "warning"
    return "ok"


def compute_position(holding) -> dict:
    multiplier = holding.contract_multiplier or _DEFAULT_MULTIPLIER
    qty = holding.quantity
    premium_per_unit = holding.avg_buy_price
    cost_basis = round(premium_per_unit * qty * multiplier, 2)

    current_val = holding.current_value
    if current_val is not None:
        unrealized_pnl = round(current_val - cost_basis, 2)
        unrealized_pnl_pct = round((unrealized_pnl / cost_basis * 100), 2) if cost_basis > 0 else 0.0
    else:
        unrealized_pnl = None
        unrealized_pnl_pct = None

    is_short = (holding.position_type or "long") == "short"
    days = days_to_expiry(holding.expiry_date)

    return {
        "id": str(holding.id),
        "name": holding.name,
        "asset_type": holding.asset_type,
        "option_type": holding.option_type,
        "underlying_ticker": holding.underlying_ticker,
        "strike_price": holding.strike_price,
        "expiry_date": str(holding.expiry_date) if holding.expiry_date else None,
        "days_to_expiry": days,
        "expiry_status": expiry_status(days),
        "quantity": qty,
        "contract_multiplier": multiplier,
        "premium_per_unit": premium_per_unit,
        "cost_basis": cost_basis,
        "current_value": current_val,
        "unrealized_pnl": unrealized_pnl,
        "unrealized_pnl_pct": unrealized_pnl_pct,
        "position_type": holding.position_type or "long",
        "max_loss": cost_basis if not is_short else None,
        "max_loss_unlimited": is_short,
        "currency": holding.currency,
    }

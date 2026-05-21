"""Tax Summary service.

Computes realized capital gains using WACC (weighted average cost) method.
For each sell transaction, cost basis = avg_cost_at_time × qty_sold.
Holding period determined from first buy date for that ticker.

This is an approximation — does not do FIFO lot matching. For accurate
tax filing users should verify with their broker's official statements.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import date


@dataclass
class RealizedGainRow:
    ticker: str
    asset_name: str
    sell_date: date
    proceeds: float
    cost_basis: float
    gain: float
    holding_days: int
    is_long_term: bool
    currency: str


@dataclass
class DividendRow:
    ticker: str
    asset_name: str
    pay_date: date
    amount: float
    currency: str


@dataclass
class TaxYearSummary:
    year: int
    total_gains: float
    total_losses: float
    net_realized: float
    total_dividends: float
    estimated_tax: float  # 25% flat (Israeli default)
    realized_rows: list[RealizedGainRow] = field(default_factory=list)
    dividend_rows: list[DividendRow] = field(default_factory=list)


@dataclass
class TaxSummaryResult:
    available_years: list[int]
    selected_year: int | None
    summary: TaxYearSummary | None


def get_summary(db, investor_id: uuid.UUID, year: int | None = None) -> TaxSummaryResult:
    from app.models.holding_transaction import HoldingTransaction

    txns = (
        db.query(HoldingTransaction)
        .filter(HoldingTransaction.investor_id == investor_id)
        .order_by(HoldingTransaction.transaction_date.asc())
        .all()
    )

    # WACC position tracker: ticker → {qty, avg_cost, first_buy_date}
    positions: dict[str, dict] = {}
    realized: list[RealizedGainRow] = []
    dividends: list[DividendRow] = []

    for txn in txns:
        ticker = txn.ticker or ""

        if txn.transaction_type == "buy" and ticker:
            qty = txn.quantity or 0.0
            if qty <= 0:
                continue
            unit_cost = txn.price_per_unit or (txn.total_amount / qty if qty else 0.0)
            pos = positions.get(ticker, {"qty": 0.0, "avg_cost": 0.0, "first_buy_date": txn.transaction_date})
            new_qty = pos["qty"] + qty
            if new_qty > 0:
                new_avg = (pos["qty"] * pos["avg_cost"] + qty * unit_cost) / new_qty
            else:
                new_avg = unit_cost
            if pos["qty"] == 0:
                pos["first_buy_date"] = txn.transaction_date
            positions[ticker] = {"qty": new_qty, "avg_cost": new_avg, "first_buy_date": pos["first_buy_date"]}

        elif txn.transaction_type == "sell" and ticker:
            qty_sold = txn.quantity or 0.0
            if qty_sold <= 0:
                continue
            sell_price = txn.price_per_unit or (txn.total_amount / qty_sold if qty_sold else 0.0)
            fees = txn.fees or 0.0
            proceeds = sell_price * qty_sold - fees

            pos = positions.get(ticker)
            if pos and pos["qty"] > 0:
                cost_basis = pos["avg_cost"] * qty_sold
                gain = proceeds - cost_basis
                first_buy = pos.get("first_buy_date", txn.transaction_date)
                holding_days = (txn.transaction_date - first_buy).days if first_buy else 0
                realized.append(RealizedGainRow(
                    ticker=ticker,
                    asset_name=txn.asset_name or ticker,
                    sell_date=txn.transaction_date,
                    proceeds=round(proceeds, 2),
                    cost_basis=round(cost_basis, 2),
                    gain=round(gain, 2),
                    holding_days=holding_days,
                    is_long_term=holding_days >= 365,
                    currency=txn.currency,
                ))
                # Reduce position
                remaining = pos["qty"] - qty_sold
                positions[ticker] = {
                    "qty": max(0.0, remaining),
                    "avg_cost": pos["avg_cost"],
                    "first_buy_date": pos["first_buy_date"],
                }
            else:
                # No tracked position — record with unknown cost basis
                realized.append(RealizedGainRow(
                    ticker=ticker,
                    asset_name=txn.asset_name or ticker,
                    sell_date=txn.transaction_date,
                    proceeds=round(proceeds, 2),
                    cost_basis=0.0,
                    gain=round(proceeds, 2),
                    holding_days=0,
                    is_long_term=False,
                    currency=txn.currency,
                ))

        elif txn.transaction_type == "dividend":
            dividends.append(DividendRow(
                ticker=ticker or "UNKNOWN",
                asset_name=txn.asset_name or ticker or "Unknown",
                pay_date=txn.transaction_date,
                amount=round(txn.total_amount, 2),
                currency=txn.currency,
            ))

    available_years = sorted(
        set(r.sell_date.year for r in realized) | set(d.pay_date.year for d in dividends),
        reverse=True,
    )

    if not available_years:
        return TaxSummaryResult(available_years=[], selected_year=None, summary=None)

    selected = year if year in available_years else available_years[0]

    yr_realized = [r for r in realized if r.sell_date.year == selected]
    yr_dividends = [d for d in dividends if d.pay_date.year == selected]

    total_gains = sum(r.gain for r in yr_realized if r.gain > 0)
    total_losses = sum(r.gain for r in yr_realized if r.gain < 0)
    net_realized = total_gains + total_losses
    total_dividends = sum(d.amount for d in yr_dividends)
    estimated_tax = max(0.0, net_realized * 0.25) + (total_dividends * 0.25)

    summary = TaxYearSummary(
        year=selected,
        total_gains=round(total_gains, 2),
        total_losses=round(total_losses, 2),
        net_realized=round(net_realized, 2),
        total_dividends=round(total_dividends, 2),
        estimated_tax=round(estimated_tax, 2),
        realized_rows=sorted(yr_realized, key=lambda r: r.sell_date, reverse=True),
        dividend_rows=sorted(yr_dividends, key=lambda d: d.pay_date, reverse=True),
    )

    return TaxSummaryResult(
        available_years=available_years,
        selected_year=selected,
        summary=summary,
    )

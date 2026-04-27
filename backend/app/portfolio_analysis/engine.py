"""
Pure portfolio analysis engine — no DB access.

Converts all holding values to the investor's base currency and computes:
  - cost basis and current value per holding and account
  - total portfolio P&L
  - asset allocation by type (%)
  - currency exposure by currency (%)
"""
from datetime import datetime, timezone
from typing import Callable

from app.models.investment_account import InvestmentAccount, InvestmentHolding
from app.portfolio_analysis.schemas import (
    AccountAnalysis,
    HoldingAnalysis,
    PortfolioSummary,
)


def _holding_current_value(h: InvestmentHolding) -> float:
    """Current value in the holding's own currency.

    Uses manually entered current_value if present; otherwise falls back to cost basis.
    """
    if h.current_value is not None:
        return h.current_value
    return h.quantity * h.avg_buy_price


def analyze(
    investor_id,
    base_currency: str,
    accounts: list[InvestmentAccount],
    convert: Callable[[float, str, str], float],
) -> PortfolioSummary:
    account_analyses: list[AccountAnalysis] = []
    total_cost = 0.0
    total_value = 0.0
    asset_buckets: dict[str, float] = {}
    currency_buckets: dict[str, float] = {}

    for account in accounts:
        acc_cost = 0.0
        acc_value = 0.0
        holding_analyses: list[HoldingAnalysis] = []

        for h in account.holdings:
            cost_local = h.quantity * h.avg_buy_price
            value_local = _holding_current_value(h)

            cost_base = convert(cost_local, h.currency, base_currency)
            value_base = convert(value_local, h.currency, base_currency)

            pnl = value_base - cost_base
            pnl_pct = (pnl / cost_base * 100) if cost_base > 0 else 0.0

            holding_analyses.append(HoldingAnalysis(
                id=h.id,
                account_id=h.account_id,
                name=h.name,
                ticker=h.ticker,
                isin=h.isin,
                asset_type=h.asset_type,
                quantity=h.quantity,
                avg_buy_price=h.avg_buy_price,
                cost_basis=cost_base,
                current_value_local=value_local,
                current_value_base=value_base,
                unrealized_pnl=round(pnl, 2),
                unrealized_pnl_pct=round(pnl_pct, 2),
                currency=h.currency,
                purchase_date=h.purchase_date,
            ))

            acc_cost += cost_base
            acc_value += value_base

            asset_buckets[h.asset_type] = asset_buckets.get(h.asset_type, 0.0) + value_base
            currency_buckets[h.currency] = currency_buckets.get(h.currency, 0.0) + value_base

        acc_pnl = acc_value - acc_cost
        acc_pnl_pct = (acc_pnl / acc_cost * 100) if acc_cost > 0 else 0.0

        account_analyses.append(AccountAnalysis(
            id=account.id,
            provider_name=account.provider_name,
            account_type=account.account_type,
            account_name=account.account_name,
            currency=account.currency,
            total_cost_basis=round(acc_cost, 2),
            total_current_value=round(acc_value, 2),
            unrealized_pnl=round(acc_pnl, 2),
            unrealized_pnl_pct=round(acc_pnl_pct, 2),
            holdings=holding_analyses,
        ))

        total_cost += acc_cost
        total_value += acc_value

    total_pnl = total_value - total_cost
    total_pnl_pct = (total_pnl / total_cost * 100) if total_cost > 0 else 0.0

    def to_pct(buckets: dict[str, float]) -> dict[str, float]:
        total = sum(buckets.values())
        if total == 0:
            return {}
        return {k: round(v / total * 100, 2) for k, v in sorted(buckets.items())}

    return PortfolioSummary(
        investor_id=investor_id,
        base_currency=base_currency,
        total_cost_basis=round(total_cost, 2),
        total_current_value=round(total_value, 2),
        unrealized_pnl=round(total_pnl, 2),
        unrealized_pnl_pct=round(total_pnl_pct, 2),
        asset_allocation=to_pct(asset_buckets),
        currency_exposure=to_pct(currency_buckets),
        accounts=account_analyses,
        computed_at=datetime.now(timezone.utc),
    )

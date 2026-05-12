"""
Pure portfolio analysis engine — no DB access.

Converts all holding values to the investor's base currency and computes:
  - cost basis and current value per holding and account
  - total portfolio P&L and after-tax P&L (25% capital gains tax on gains)
  - asset allocation by type (%)
  - currency exposure by currency (%)
  - FX rates used for conversion
"""
from datetime import datetime, timezone
from typing import Callable

from app.models.investment_account import InvestmentAccount, InvestmentHolding
from app.portfolio_analysis.schemas import (
    AccountAnalysis,
    HoldingAnalysis,
    PortfolioSummary,
)

_TAX_RATE = 0.25  # Israel capital gains tax on realised/unrealised gains


def _after_tax(pnl: float) -> float:
    """Apply capital gains tax to a gain; losses are unchanged."""
    return round(pnl * (1 - _TAX_RATE) if pnl > 0 else pnl, 2)


def analyze(
    investor_id,
    base_currency: str,
    accounts: list[InvestmentAccount],
    convert: Callable[[float, str, str], float],
    live_prices: dict[str, tuple[float, str]] | None = None,
    prices_updated_at: "datetime | None" = None,
) -> PortfolioSummary:
    """Analyze portfolio.

    live_prices: {ticker: (price_per_unit, price_currency)} from market data cache.
    """
    lp = live_prices or {}
    account_analyses: list[AccountAnalysis] = []
    total_cost = 0.0
    total_value = 0.0
    total_pnl_after_tax = 0.0
    asset_buckets: dict[str, float] = {}
    currency_buckets: dict[str, float] = {}
    unique_foreign_currencies: set[str] = set()
    any_stale_price = False

    for account in accounts:
        acc_cost = 0.0
        acc_value = 0.0
        acc_pnl_after_tax = 0.0
        holding_analyses: list[HoldingAnalysis] = []

        for h in account.holdings:
            if h.currency != base_currency:
                unique_foreign_currencies.add(h.currency)

            is_pension = h.asset_type in ("pension_fund", "study_fund")
            live_price: float | None = None
            live_price_currency: str | None = None

            if is_pension:
                cost_local = h.total_deposits if h.total_deposits is not None else 0.0
                cost_base = convert(cost_local, h.currency, base_currency)
                if h.current_balance is not None:
                    value_local = h.current_balance
                    price_source = "manual"
                elif h.current_value is not None:
                    value_local = h.current_value
                    price_source = "manual"
                else:
                    value_local = cost_local
                    price_source = "cost_basis"
                value_base = convert(value_local, h.currency, base_currency)
            else:
                # Include brokerage fees in cost basis — fees are a real cost of acquisition
                cost_local = h.quantity * h.avg_buy_price + (h.fees or 0.0)
                cost_base = convert(cost_local, h.currency, base_currency)

                if h.ticker and h.ticker in lp:
                    lp_price, lp_currency = lp[h.ticker]
                    value_base = convert(lp_price * h.quantity, lp_currency, base_currency)
                    value_local = lp_price * h.quantity  # in price currency
                    price_source = "live"
                    live_price = lp_price
                    live_price_currency = lp_currency
                    if lp_currency != base_currency:
                        unique_foreign_currencies.add(lp_currency)
                elif h.current_value is not None:
                    value_local = h.current_value
                    value_base = convert(value_local, h.currency, base_currency)
                    price_source = "manual"
                else:
                    value_local = cost_local
                    value_base = cost_base
                    price_source = "cost_basis"
                    if h.ticker:
                        any_stale_price = True

            pnl = value_base - cost_base
            pnl_pct = (pnl / cost_base * 100) if cost_base > 0 else 0.0
            # Pension and study funds are taxed as income at withdrawal, not as capital gains.
            # Do not apply flat 25% CGT — show gross gain and let the user plan accordingly.
            pnl_at = pnl if is_pension else _after_tax(pnl)

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
                pnl_after_tax=pnl_at,
                currency=h.currency,
                purchase_date=h.purchase_date,
                price_source=price_source,
                live_price=live_price,
                live_price_currency=live_price_currency,
            ))

            acc_cost += cost_base
            acc_value += value_base
            acc_pnl_after_tax += pnl_at

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
            pnl_after_tax=round(acc_pnl_after_tax, 2),
            holdings=holding_analyses,
        ))

        total_cost += acc_cost
        total_value += acc_value
        total_pnl_after_tax += acc_pnl_after_tax

    total_pnl = total_value - total_cost
    total_pnl_pct = (total_pnl / total_cost * 100) if total_cost > 0 else 0.0
    total_pnl_at_pct = (total_pnl_after_tax / total_cost * 100) if total_cost > 0 else 0.0

    # FX rates used: rate from each foreign currency to base_currency
    fx_rates: dict[str, float] = {}
    for c in unique_foreign_currencies:
        rate = convert(1.0, c, base_currency)
        fx_rates[c] = round(rate, 4)

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
        pnl_after_tax=round(total_pnl_after_tax, 2),
        pnl_after_tax_pct=round(total_pnl_at_pct, 2),
        fx_rates=fx_rates,
        asset_allocation=to_pct(asset_buckets),
        currency_exposure=to_pct(currency_buckets),
        accounts=account_analyses,
        computed_at=datetime.now(timezone.utc),
        has_stale_prices=any_stale_price,
        prices_updated_at=prices_updated_at,
    )

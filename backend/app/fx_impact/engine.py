"""FX Impact engine — decomposes portfolio P&L into asset P&L and currency P&L.

Math:
    cost_basis_local  = avg_buy_price × qty  (× contract_multiplier for options)
    cost_basis_base   = cost_basis_local × purchase_fx_rate   (rate at purchase)
    current_val_base  = live_price_local × qty × current_rate  (or current_value if set)

    asset_pnl   = (live_price_local − avg_buy_price) × qty × current_rate
    fx_pnl      = cost_basis_local × (current_rate − purchase_fx_rate)
    total_pnl   = asset_pnl + fx_pnl   (= current_val_base − cost_basis_base)

For holdings with currency == base_currency: fx_pnl = 0, purchase_fx_rate = 1.0.
For holdings without purchase_fx_rate: all three P&L figures are None.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy.orm import Session


@dataclass
class HoldingFxImpact:
    holding_id: str
    name: str
    ticker: str | None
    asset_type: str
    currency: str
    base_currency: str
    quantity: float
    avg_buy_price: float
    purchase_fx_rate: float | None
    current_fx_rate: float | None
    cost_basis_local: float
    cost_basis_base: float | None     # None if purchase_fx_rate missing
    current_value_base: float | None  # None if no live data
    asset_pnl: float | None
    fx_pnl: float | None
    total_pnl: float | None
    asset_pnl_pct: float | None
    fx_pnl_pct: float | None
    same_currency: bool               # True → no FX exposure
    fx_data_available: bool           # False → purchase_fx_rate missing


@dataclass
class FxImpactResult:
    investor_id: uuid.UUID
    base_currency: str
    holdings: list[HoldingFxImpact]
    total_asset_pnl: float
    total_fx_pnl: float
    total_pnl: float
    total_cost_basis: float
    holdings_missing_fx_data: int


_OPTION_TYPES = {"call_option", "put_option"}


def compute(db: Session, investor_id: uuid.UUID) -> FxImpactResult:
    from app.models.investment_account import InvestmentAccount
    from app.models.investor_profile import InvestorProfile
    from app.currency_engine.rates import get_rate

    investor = db.get(InvestorProfile, investor_id)
    base_currency = investor.base_currency if investor else "USD"

    accounts = (
        db.query(InvestmentAccount)
        .filter(InvestmentAccount.investor_id == investor_id)
        .all()
    )

    impacts: list[HoldingFxImpact] = []
    total_asset_pnl = 0.0
    total_fx_pnl = 0.0
    total_pnl_sum = 0.0
    total_cost_basis = 0.0
    missing_fx_count = 0

    for acc in accounts:
        for h in acc.holdings:
            # Multiplier: options use contract_multiplier, others use 1
            multiplier = 1.0
            if h.asset_type in _OPTION_TYPES:
                multiplier = h.contract_multiplier or 100.0

            cost_basis_local = round(h.avg_buy_price * h.quantity * multiplier, 4)
            same_currency = h.currency == base_currency

            # Current FX rate (base → holding currency)
            if same_currency:
                current_fx_rate = 1.0
            else:
                current_fx_rate = get_rate(db, base_currency, h.currency)

            # Current value in base currency
            current_value_base: float | None = None
            if h.current_value is not None:
                # Manually set current_value is already in holding's currency
                if same_currency or current_fx_rate is None:
                    current_value_base = h.current_value
                else:
                    current_value_base = h.current_value / current_fx_rate
            elif current_fx_rate and current_fx_rate > 0:
                # Estimate from cost basis (no live price)
                current_value_base = None  # can't compute without live price

            # P&L decomposition
            if same_currency:
                purchase_fx_rate = 1.0
                cost_basis_base = cost_basis_local
                fx_data_available = True

                if current_value_base is not None:
                    asset_pnl = round(current_value_base - cost_basis_base, 2)
                    fx_pnl = 0.0
                    total_pnl_val = asset_pnl
                    asset_pnl_pct = round(asset_pnl / cost_basis_base * 100, 2) if cost_basis_base > 0 else 0.0
                    fx_pnl_pct = 0.0
                else:
                    asset_pnl = fx_pnl = total_pnl_val = asset_pnl_pct = fx_pnl_pct = None

            elif h.purchase_fx_rate and h.purchase_fx_rate > 0 and current_fx_rate and current_fx_rate > 0:
                purchase_fx_rate = h.purchase_fx_rate
                # rate is stored as base→holding, so to get local→base: 1/rate
                purchase_rate_local_to_base = 1.0 / purchase_fx_rate
                current_rate_local_to_base = 1.0 / current_fx_rate
                cost_basis_base = round(cost_basis_local * purchase_rate_local_to_base, 2)
                fx_data_available = True

                if current_value_base is not None:
                    total_pnl_val = round(current_value_base - cost_basis_base, 2)
                    asset_pnl = round((current_value_base - cost_basis_local * current_rate_local_to_base), 2)
                    # asset_pnl = change in local price × qty × current_rate_to_base
                    # fx_pnl = cost_basis_local × (current_rate_to_base − purchase_rate_to_base)
                    fx_pnl = round(cost_basis_local * (current_rate_local_to_base - purchase_rate_local_to_base), 2)
                    asset_pnl_pct = round(asset_pnl / cost_basis_base * 100, 2) if cost_basis_base > 0 else 0.0
                    fx_pnl_pct = round(fx_pnl / cost_basis_base * 100, 2) if cost_basis_base > 0 else 0.0
                else:
                    asset_pnl = fx_pnl = total_pnl_val = asset_pnl_pct = fx_pnl_pct = None

            else:
                # No purchase_fx_rate — cannot decompose
                purchase_fx_rate = h.purchase_fx_rate
                cost_basis_base = None
                asset_pnl = fx_pnl = total_pnl_val = asset_pnl_pct = fx_pnl_pct = None
                fx_data_available = False
                missing_fx_count += 1

            if total_pnl_val is not None:
                total_asset_pnl += asset_pnl or 0.0
                total_fx_pnl += fx_pnl or 0.0
                total_pnl_sum += total_pnl_val

            cost_basis_base_for_total = cost_basis_base if cost_basis_base is not None else 0.0
            total_cost_basis += cost_basis_base_for_total

            impacts.append(HoldingFxImpact(
                holding_id=str(h.id),
                name=h.name,
                ticker=h.ticker,
                asset_type=h.asset_type,
                currency=h.currency,
                base_currency=base_currency,
                quantity=h.quantity,
                avg_buy_price=h.avg_buy_price,
                purchase_fx_rate=purchase_fx_rate if not same_currency else None,
                current_fx_rate=current_fx_rate if not same_currency else None,
                cost_basis_local=round(cost_basis_local, 2),
                cost_basis_base=cost_basis_base,
                current_value_base=round(current_value_base, 2) if current_value_base is not None else None,
                asset_pnl=asset_pnl,
                fx_pnl=fx_pnl,
                total_pnl=total_pnl_val,
                asset_pnl_pct=asset_pnl_pct,
                fx_pnl_pct=fx_pnl_pct,
                same_currency=same_currency,
                fx_data_available=fx_data_available,
            ))

    return FxImpactResult(
        investor_id=investor_id,
        base_currency=base_currency,
        holdings=impacts,
        total_asset_pnl=round(total_asset_pnl, 2),
        total_fx_pnl=round(total_fx_pnl, 2),
        total_pnl=round(total_pnl_sum, 2),
        total_cost_basis=round(total_cost_basis, 2),
        holdings_missing_fx_data=missing_fx_count,
    )

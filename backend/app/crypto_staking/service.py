"""Crypto Staking & Yield service.

Uses existing InvestmentHolding fields — no schema migration:
  fund_status = "staking"   → marks a crypto holding as staked
  annual_return_rate        → staking APY in percent (e.g. 5.2 = 5.2%)

Staking rewards are INCOME (not capital gains) — this distinction
affects tax treatment in most jurisdictions.
"""
from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.crypto_staking.schemas import StakingPosition, StakingReport
from app.currency_engine.rates import convert as fx_convert
from app.market_data.service import get_cached_price
from app.models.investment_account import InvestmentAccount, InvestmentHolding
from app.models.investor_profile import InvestorProfile


def _tax_note(ticker: str | None, base_currency: str) -> str:
    is_il = base_currency == "ILS"
    ticker_upper = (ticker or "").upper()
    if is_il:
        return (
            f"Staking rewards on {ticker_upper or 'crypto'} are taxable as income in Israel "
            "(treated as interest/yield). Consult a tax advisor for your specific situation."
        )
    return (
        f"Staking rewards on {ticker_upper or 'crypto'} are typically treated as ordinary income "
        "at fair market value when received. Different from capital gains treatment. "
        "Consult a tax advisor for your jurisdiction."
    )


def build_staking_report(db: Session, investor_id: uuid.UUID) -> StakingReport:
    investor = db.get(InvestorProfile, investor_id)
    base_currency = investor.base_currency if investor else "USD"

    accounts = (
        db.query(InvestmentAccount)
        .filter(InvestmentAccount.investor_id == investor_id)
        .all()
    )

    positions: list[StakingPosition] = []
    total_income_base = 0.0
    has_price_data = False

    for account in accounts:
        for holding in account.holdings:
            if holding.fund_status != "staking":
                continue
            apy = holding.annual_return_rate
            if not apy or apy <= 0:
                continue

            annual_rewards_native = holding.quantity * (apy / 100.0)

            # Try to get live price
            price_in_base: float | None = None
            price_raw: float | None = None
            if holding.ticker:
                snap = get_cached_price(db, holding.ticker)
                if snap:
                    price_raw = snap.price
                    try:
                        price_in_base = fx_convert(db, snap.price, snap.currency, base_currency)
                    except Exception:
                        price_in_base = None

            annual_rewards_base: float | None = None
            if price_in_base is not None:
                annual_rewards_base = annual_rewards_native * price_in_base
                total_income_base += annual_rewards_base
                has_price_data = True

            positions.append(StakingPosition(
                holding_id=holding.id,
                account_id=account.id,
                name=holding.name,
                ticker=holding.ticker,
                quantity=holding.quantity,
                staking_apy=apy,
                current_price_usd=price_raw,
                current_price_base=price_in_base,
                estimated_annual_rewards_native=round(annual_rewards_native, 8),
                estimated_annual_rewards_base=round(annual_rewards_base, 2) if annual_rewards_base is not None else None,
                currency=holding.currency,
                tax_treatment="income",
                tax_note=_tax_note(holding.ticker, base_currency),
            ))

    if not positions:
        tax_summary = "No staked positions found. Enable staking on a crypto holding to track yield income."
    else:
        count = len(positions)
        income_str = (
            f"{total_income_base:,.2f} {base_currency}"
            if has_price_data
            else "price data unavailable"
        )
        tax_summary = (
            f"{count} staked position{'s' if count > 1 else ''} generating an estimated "
            f"{income_str}/year in staking rewards. "
            "Staking rewards are taxed as ordinary income, not capital gains — "
            "keep records of reward amounts at time of receipt."
        )

    return StakingReport(
        investor_id=investor_id,
        base_currency=base_currency,
        total_estimated_annual_income_base=round(total_income_base, 2) if has_price_data else None,
        positions=positions,
        tax_summary=tax_summary,
    )


def enable_staking(
    db: Session,
    investor_id: uuid.UUID,
    holding_id: uuid.UUID,
    staking_apy: float,
) -> InvestmentHolding | None:
    holding = _get_crypto_holding(db, investor_id, holding_id)
    if not holding:
        return None
    holding.fund_status = "staking"
    holding.annual_return_rate = staking_apy
    db.commit()
    db.refresh(holding)
    return holding


def disable_staking(
    db: Session,
    investor_id: uuid.UUID,
    holding_id: uuid.UUID,
) -> InvestmentHolding | None:
    holding = _get_crypto_holding(db, investor_id, holding_id)
    if not holding:
        return None
    holding.fund_status = None
    holding.annual_return_rate = None
    db.commit()
    db.refresh(holding)
    return holding


def _get_crypto_holding(
    db: Session, investor_id: uuid.UUID, holding_id: uuid.UUID
) -> InvestmentHolding | None:
    return (
        db.query(InvestmentHolding)
        .join(InvestmentAccount, InvestmentHolding.account_id == InvestmentAccount.id)
        .filter(
            InvestmentAccount.investor_id == investor_id,
            InvestmentHolding.id == holding_id,
            InvestmentHolding.asset_type == "crypto",
        )
        .first()
    )

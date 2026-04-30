"""Unit tests for portfolio_analysis.engine — no DB required."""
import uuid
from types import SimpleNamespace
from datetime import date

import pytest

from app.portfolio_analysis.engine import analyze

INVESTOR_ID = uuid.uuid4()


def _holding(
    name="Test ETF",
    asset_type="etf",
    quantity=10.0,
    avg_buy_price=100.0,
    currency="ILS",
    current_value=None,
    ticker=None,
    isin=None,
    fees=0.0,
    purchase_date=None,
):
    return SimpleNamespace(
        id=uuid.uuid4(),
        account_id=uuid.uuid4(),
        name=name,
        ticker=ticker,
        isin=isin,
        asset_type=asset_type,
        quantity=quantity,
        avg_buy_price=avg_buy_price,
        currency=currency,
        fees=fees,
        purchase_date=purchase_date,
        current_value=current_value,
    )


def _account(holdings=None, currency="ILS", provider_name="Test Bank", account_type="brokerage"):
    return SimpleNamespace(
        id=uuid.uuid4(),
        provider_name=provider_name,
        account_type=account_type,
        account_name=None,
        currency=currency,
        holdings=holdings or [],
    )


def identity_convert(amount, from_currency, to_currency):
    """1:1 conversion — same currency or no FX for testing."""
    return amount


def fixed_convert(rate):
    """Returns a converter that multiplies by `rate` when currencies differ."""
    def convert(amount, from_currency, to_currency):
        if from_currency == to_currency:
            return amount
        return amount * rate
    return convert


# ── Basic correctness ─────────────────────────────────────────────────────────

def test_empty_portfolio():
    result = analyze(
        investor_id=INVESTOR_ID,
        base_currency="ILS",
        accounts=[],
        convert=identity_convert,
    )
    assert result.total_cost_basis == 0.0
    assert result.total_current_value == 0.0
    assert result.unrealized_pnl == 0.0
    assert result.asset_allocation == {}
    assert result.currency_exposure == {}
    assert result.accounts == []


def test_single_holding_no_current_value_uses_cost_basis():
    h = _holding(quantity=10, avg_buy_price=100)
    account = _account(holdings=[h])
    result = analyze(INVESTOR_ID,"ILS", [account], identity_convert)

    assert result.total_cost_basis == 1000.0
    assert result.total_current_value == 1000.0
    assert result.unrealized_pnl == 0.0
    assert result.unrealized_pnl_pct == 0.0


def test_single_holding_with_current_value_above_cost():
    h = _holding(quantity=10, avg_buy_price=100, current_value=1500)
    account = _account(holdings=[h])
    result = analyze(INVESTOR_ID,"ILS", [account], identity_convert)

    assert result.total_cost_basis == 1000.0
    assert result.total_current_value == 1500.0
    assert result.unrealized_pnl == 500.0
    assert result.unrealized_pnl_pct == 50.0


def test_single_holding_loss():
    h = _holding(quantity=10, avg_buy_price=100, current_value=800)
    account = _account(holdings=[h])
    result = analyze(INVESTOR_ID,"ILS", [account], identity_convert)

    assert result.total_current_value == 800.0
    assert result.unrealized_pnl == -200.0
    assert result.unrealized_pnl_pct == -20.0


# ── Asset allocation ──────────────────────────────────────────────────────────

def test_asset_allocation_single_type():
    h = _holding(asset_type="etf", current_value=1000)
    account = _account(holdings=[h])
    result = analyze(INVESTOR_ID,"ILS", [account], identity_convert)

    assert result.asset_allocation == {"etf": 100.0}


def test_asset_allocation_multiple_types():
    h1 = _holding(asset_type="etf", quantity=10, avg_buy_price=100, current_value=1000)
    h2 = _holding(asset_type="stock", quantity=5, avg_buy_price=200, current_value=1000)
    account = _account(holdings=[h1, h2])
    result = analyze(INVESTOR_ID,"ILS", [account], identity_convert)

    assert result.asset_allocation["etf"] == 50.0
    assert result.asset_allocation["stock"] == 50.0


def test_asset_allocation_unequal_distribution():
    h1 = _holding(asset_type="etf", quantity=10, avg_buy_price=100, current_value=750)
    h2 = _holding(asset_type="crypto", quantity=1, avg_buy_price=100, current_value=250)
    account = _account(holdings=[h1, h2])
    result = analyze(INVESTOR_ID,"ILS", [account], identity_convert)

    assert result.asset_allocation["etf"] == 75.0
    assert result.asset_allocation["crypto"] == 25.0


# ── Currency exposure ─────────────────────────────────────────────────────────

def test_currency_exposure_single_currency():
    h = _holding(currency="USD", current_value=1000)
    account = _account(holdings=[h])
    result = analyze(INVESTOR_ID,"ILS", [account], identity_convert)

    assert result.currency_exposure == {"USD": 100.0}


def test_currency_exposure_multiple_currencies():
    h1 = _holding(currency="ILS", quantity=10, avg_buy_price=100, current_value=1000)
    h2 = _holding(currency="USD", quantity=10, avg_buy_price=100, current_value=1000)
    account = _account(holdings=[h1, h2])
    result = analyze(INVESTOR_ID,"ILS", [account], identity_convert)

    assert result.currency_exposure["ILS"] == 50.0
    assert result.currency_exposure["USD"] == 50.0


# ── FX conversion ─────────────────────────────────────────────────────────────

def test_fx_conversion_applied_to_values():
    """USD holding with 3.7 ILS/USD rate should convert correctly."""
    h = _holding(currency="USD", quantity=1, avg_buy_price=100, current_value=100)
    account = _account(holdings=[h])
    result = analyze(INVESTOR_ID,"ILS", [account], fixed_convert(3.7))

    assert result.total_cost_basis == pytest.approx(370.0)
    assert result.total_current_value == pytest.approx(370.0)


def test_fx_conversion_mixed_currencies():
    h_ils = _holding(currency="ILS", quantity=1, avg_buy_price=1000, current_value=1000)
    h_usd = _holding(currency="USD", quantity=1, avg_buy_price=100, current_value=120)
    account = _account(holdings=[h_ils, h_usd])
    result = analyze(INVESTOR_ID,"ILS", [account], fixed_convert(3.7))

    expected_ils_value = 1000.0
    expected_usd_value = 120 * 3.7
    assert result.total_current_value == pytest.approx(expected_ils_value + expected_usd_value)


# ── Multiple accounts ─────────────────────────────────────────────────────────

def test_multiple_accounts_aggregated():
    h1 = _holding(quantity=10, avg_buy_price=100, current_value=1100)
    h2 = _holding(quantity=5, avg_buy_price=200, current_value=900)
    acc1 = _account(holdings=[h1])
    acc2 = _account(holdings=[h2])
    result = analyze(INVESTOR_ID,"ILS", [acc1, acc2], identity_convert)

    assert result.total_cost_basis == 2000.0
    assert result.total_current_value == 2000.0
    assert result.unrealized_pnl == 0.0
    assert len(result.accounts) == 2


def test_account_level_pnl():
    h = _holding(quantity=10, avg_buy_price=100, current_value=1200)
    account = _account(holdings=[h])
    result = analyze(INVESTOR_ID,"ILS", [account], identity_convert)

    acc = result.accounts[0]
    assert acc.total_cost_basis == 1000.0
    assert acc.total_current_value == 1200.0
    assert acc.unrealized_pnl == 200.0
    assert acc.unrealized_pnl_pct == 20.0


# ── Holding-level detail ──────────────────────────────────────────────────────

def test_holding_analysis_fields():
    h = _holding(
        name="Apple Inc",
        ticker="AAPL",
        asset_type="stock",
        quantity=5,
        avg_buy_price=150,
        current_value=900,
        currency="USD",
        purchase_date=date(2024, 1, 15),
    )
    account = _account(holdings=[h])
    result = analyze(INVESTOR_ID,"USD", [account], identity_convert)

    ha = result.accounts[0].holdings[0]
    assert ha.name == "Apple Inc"
    assert ha.ticker == "AAPL"
    assert ha.cost_basis == 750.0
    assert ha.current_value_base == 900.0
    assert ha.unrealized_pnl == 150.0
    assert ha.unrealized_pnl_pct == 20.0
    assert ha.purchase_date == date(2024, 1, 15)


# ── After-tax P&L ─────────────────────────────────────────────────────────────

def test_pnl_after_tax_on_gain():
    h = _holding(quantity=10, avg_buy_price=100, current_value=1500)
    result = analyze(INVESTOR_ID, "ILS", [_account(holdings=[h])], identity_convert)
    # gain = 500, after 25% tax → 375
    assert result.pnl_after_tax == pytest.approx(375.0)
    assert result.pnl_after_tax_pct == pytest.approx(37.5)


def test_pnl_after_tax_on_loss_unchanged():
    h = _holding(quantity=10, avg_buy_price=100, current_value=800)
    result = analyze(INVESTOR_ID, "ILS", [_account(holdings=[h])], identity_convert)
    # loss = -200, tax does not apply
    assert result.pnl_after_tax == pytest.approx(-200.0)


def test_pnl_after_tax_zero_at_breakeven():
    h = _holding(quantity=10, avg_buy_price=100)  # no current_value → cost_basis fallback
    result = analyze(INVESTOR_ID, "ILS", [_account(holdings=[h])], identity_convert)
    assert result.pnl_after_tax == 0.0


def test_pnl_after_tax_holding_level():
    h = _holding(quantity=10, avg_buy_price=100, current_value=1200)
    result = analyze(INVESTOR_ID, "ILS", [_account(holdings=[h])], identity_convert)
    ha = result.accounts[0].holdings[0]
    assert ha.pnl_after_tax == pytest.approx(150.0)  # gain 200 * 0.75


def test_pnl_after_tax_account_level():
    h = _holding(quantity=10, avg_buy_price=100, current_value=1400)
    result = analyze(INVESTOR_ID, "ILS", [_account(holdings=[h])], identity_convert)
    acc = result.accounts[0]
    assert acc.pnl_after_tax == pytest.approx(300.0)  # gain 400 * 0.75


# ── FX rates ──────────────────────────────────────────────────────────────────

def test_fx_rates_populated_for_foreign_currency():
    h = _holding(currency="USD", quantity=1, avg_buy_price=100, current_value=100)
    result = analyze(INVESTOR_ID, "ILS", [_account(holdings=[h])], fixed_convert(3.7))
    assert "USD" in result.fx_rates
    assert result.fx_rates["USD"] == pytest.approx(3.7)


def test_fx_rates_empty_when_all_same_currency():
    h = _holding(currency="ILS", quantity=1, avg_buy_price=100, current_value=100)
    result = analyze(INVESTOR_ID, "ILS", [_account(holdings=[h])], identity_convert)
    assert result.fx_rates == {}

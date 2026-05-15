"""Tests for liquidity runway engine (pure logic — no DB, no yfinance)."""
import uuid
from types import SimpleNamespace

import pytest

from app.liquidity_runway.engine import (
    _get_tier,
    compute_liquidity_runway,
)
from app.liquidity_runway.schemas import LiquidityRunway


# ── Helpers ───────────────────────────────────────────────────────────────────

def _holding(
    *,
    name="VTI",
    ticker="VTI",
    asset_type="etf",
    current_value_base=10_000.0,
    unrealized_pnl=1_000.0,
    cost_basis=9_000.0,
    hid=None,
):
    return SimpleNamespace(
        id=hid or uuid.uuid4(),
        name=name,
        ticker=ticker,
        asset_type=asset_type,
        current_value_base=current_value_base,
        unrealized_pnl=unrealized_pnl,
        cost_basis=cost_basis,
    )


def _account(holdings, *, account_type="brokerage", provider_name="Broker",
             account_name="Main", aid=None):
    total_val = sum(h.current_value_base for h in holdings)
    total_pnl = sum(h.unrealized_pnl for h in holdings)
    cost = total_val - total_pnl
    return SimpleNamespace(
        id=aid or uuid.uuid4(),
        provider_name=provider_name,
        account_name=account_name,
        account_type=account_type,
        total_current_value=total_val,
        total_cost_basis=cost,
        unrealized_pnl=total_pnl,
        holdings=holdings,
    )


def _portfolio(accounts, *, currency="USD", total_current_value=None):
    total = total_current_value or sum(a.total_current_value for a in accounts)
    return SimpleNamespace(
        base_currency=currency,
        total_current_value=total,
        accounts=accounts,
    )


# ── _get_tier ─────────────────────────────────────────────────────────────────

class TestGetTier:
    def test_stock_is_tier_1(self):
        tier, _ = _get_tier("stock", "brokerage")
        assert tier == 1

    def test_etf_is_tier_1(self):
        tier, _ = _get_tier("etf", "brokerage")
        assert tier == 1

    def test_crypto_is_tier_1(self):
        tier, _ = _get_tier("crypto", "crypto")
        assert tier == 1

    def test_bond_is_tier_2(self):
        tier, _ = _get_tier("bond", "brokerage")
        assert tier == 2

    def test_fund_is_tier_2(self):
        tier, _ = _get_tier("fund", "brokerage")
        assert tier == 2

    def test_real_estate_is_tier_3(self):
        tier, _ = _get_tier("real_estate", "brokerage")
        assert tier == 3

    def test_pension_fund_is_tier_3(self):
        tier, _ = _get_tier("pension_fund", "pension")
        assert tier == 3

    def test_study_fund_is_tier_3(self):
        tier, _ = _get_tier("study_fund", "keren_hishtalmut")
        assert tier == 3

    def test_keren_hishtalmut_account_overrides_to_tier_3(self):
        # A stock held in a keren hishtalmut account → locked
        tier, _ = _get_tier("stock", "keren_hishtalmut")
        assert tier == 3

    def test_pension_account_overrides_to_tier_3(self):
        tier, _ = _get_tier("etf", "pension")
        assert tier == 3


# ── compute_liquidity_runway ──────────────────────────────────────────────────

class TestComputeLiquidityRunway:

    def test_basic_bucket_structure(self):
        acc = _account([_holding(asset_type="etf", current_value_base=50_000.0, unrealized_pnl=5_000.0)])
        portfolio = _portfolio([acc])
        result = compute_liquidity_runway(portfolio, uuid.uuid4(), "US")

        assert isinstance(result, LiquidityRunway)
        assert len(result.buckets) == 3
        tiers = {b.tier for b in result.buckets}
        assert tiers == {1, 2, 3}

    def test_etf_in_brokerage_lands_in_tier_1(self):
        acc = _account([_holding(asset_type="etf", current_value_base=20_000.0, unrealized_pnl=2_000.0)])
        portfolio = _portfolio([acc])
        result = compute_liquidity_runway(portfolio, uuid.uuid4(), "US")

        tier1 = next(b for b in result.buckets if b.tier == 1)
        assert tier1.total_gross == pytest.approx(20_000.0)
        assert tier1.holding_count == 1

    def test_pension_fund_in_tier_3(self):
        acc = _account(
            [_holding(asset_type="pension_fund", current_value_base=200_000.0, unrealized_pnl=30_000.0)],
            account_type="pension",
        )
        portfolio = _portfolio([acc])
        result = compute_liquidity_runway(portfolio, uuid.uuid4(), "IL")

        tier3 = next(b for b in result.buckets if b.tier == 3)
        assert tier3.total_gross == pytest.approx(200_000.0)
        assert tier3.total_net_to_pocket == 0.0

    def test_net_to_pocket_deducts_tax_and_impact(self):
        # Holding with 1000 gain, 25% tax → tax=250; 10000 gross, tier1 impact=0.5% → impact=50
        # net = 10000 - 250 - 50 = 9700
        acc = _account([_holding(asset_type="stock", current_value_base=10_000.0, unrealized_pnl=1_000.0)])
        portfolio = _portfolio([acc])
        # IL rate is 25%
        result = compute_liquidity_runway(portfolio, uuid.uuid4(), "IL")

        h = result.holdings[0]
        assert h.estimated_tax == pytest.approx(250.0)
        assert h.market_impact == pytest.approx(50.0)
        assert h.net_to_pocket == pytest.approx(9_700.0)

    def test_loss_holding_has_zero_tax(self):
        acc = _account([_holding(asset_type="stock", current_value_base=8_000.0, unrealized_pnl=-2_000.0)])
        portfolio = _portfolio([acc])
        result = compute_liquidity_runway(portfolio, uuid.uuid4(), "US")

        h = result.holdings[0]
        assert h.estimated_tax == 0.0
        # impact = 8000 * 0.5% = 40
        assert h.market_impact == pytest.approx(40.0)
        assert h.net_to_pocket == pytest.approx(7_960.0)

    def test_total_net_excludes_locked_tier(self):
        acc1 = _account([_holding(asset_type="etf", current_value_base=10_000.0, unrealized_pnl=0.0)])
        acc2 = _account(
            [_holding(asset_type="pension_fund", current_value_base=50_000.0, unrealized_pnl=10_000.0)],
            account_type="pension",
        )
        portfolio = _portfolio([acc1, acc2])
        result = compute_liquidity_runway(portfolio, uuid.uuid4(), "US")

        # total_net_to_pocket must not include the locked holding
        assert result.total_net_to_pocket < 50_000.0
        assert result.total_gross == pytest.approx(60_000.0)

    def test_emergency_lever_no_target_returns_no_selection(self):
        acc = _account([_holding(asset_type="etf", current_value_base=10_000.0, unrealized_pnl=1_000.0)])
        portfolio = _portfolio([acc])
        result = compute_liquidity_runway(portfolio, uuid.uuid4(), "US", target_amount=None)

        assert result.target_amount is None
        assert result.target_met is None
        assert all(not h.selected_for_target for h in result.holdings)

    def test_emergency_lever_meets_target(self):
        holdings = [
            _holding(name="A", asset_type="etf", current_value_base=30_000.0, unrealized_pnl=0.0),
            _holding(name="B", asset_type="etf", current_value_base=30_000.0, unrealized_pnl=0.0),
        ]
        acc = _account(holdings)
        portfolio = _portfolio([acc])
        result = compute_liquidity_runway(portfolio, uuid.uuid4(), "US", target_amount=25_000.0)

        assert result.target_met is True
        selected = [h for h in result.holdings if h.selected_for_target]
        assert len(selected) >= 1
        assert result.lever_total_net >= 25_000.0

    def test_emergency_lever_target_not_met_when_insufficient(self):
        acc = _account([_holding(asset_type="etf", current_value_base=5_000.0, unrealized_pnl=0.0)])
        portfolio = _portfolio([acc])
        result = compute_liquidity_runway(portfolio, uuid.uuid4(), "US", target_amount=100_000.0)

        assert result.target_met is False

    def test_locked_assets_not_selected_for_lever(self):
        acc = _account(
            [_holding(asset_type="pension_fund", current_value_base=500_000.0, unrealized_pnl=50_000.0)],
            account_type="pension",
        )
        portfolio = _portfolio([acc])
        result = compute_liquidity_runway(portfolio, uuid.uuid4(), "US", target_amount=100_000.0)

        locked = [h for h in result.holdings if h.tier == 3]
        assert all(not h.selected_for_target for h in locked)
        assert result.target_met is False

    def test_cheapest_to_liquidate_selected_first(self):
        """Holding with zero gain (no tax) selected before holding with large gain."""
        loss_holding = _holding(name="Loss", asset_type="stock", current_value_base=20_000.0,
                                unrealized_pnl=-5_000.0)   # no tax
        gain_holding = _holding(name="Gain", asset_type="stock", current_value_base=20_000.0,
                                unrealized_pnl=15_000.0)   # tax on 15k gain = 3750 (US 25%)
        acc = _account([loss_holding, gain_holding])
        portfolio = _portfolio([acc])

        # Target = 15_000 → should select the loss_holding first (cheaper to liquidate)
        result = compute_liquidity_runway(portfolio, uuid.uuid4(), "US", target_amount=15_000.0)

        selected = [h for h in result.holdings if h.selected_for_target]
        assert len(selected) == 1
        assert selected[0].name == "Loss"

    def test_empty_portfolio_returns_zero_totals(self):
        portfolio = _portfolio([], total_current_value=0.0)
        result = compute_liquidity_runway(portfolio, uuid.uuid4(), "US")

        assert result.total_gross == 0.0
        assert result.total_net_to_pocket == 0.0
        assert all(b.holding_count == 0 for b in result.buckets)

    def test_currency_reflected_in_result(self):
        acc = _account([_holding(current_value_base=50_000.0, unrealized_pnl=5_000.0)])
        portfolio = _portfolio([acc], currency="ILS")
        result = compute_liquidity_runway(portfolio, uuid.uuid4(), "IL")
        assert result.currency == "ILS"

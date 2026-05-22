"""Tests for tax-loss harvesting service (pure logic — no DB, no yfinance)."""
import uuid
from datetime import date
from types import SimpleNamespace


from app.tax_harvesting.service import (
    _suggest_replacement,
    _holding_period_label,
    compute_opportunities,
)
from app.tax_harvesting.schemas import TaxOpportunityResult


# ── Helpers ───────────────────────────────────────────────────────────────────

def _holding(
    *,
    name="ACME",
    ticker=None,
    asset_type="stock",
    cost_basis=10_000.0,
    current_value_base=8_000.0,
    unrealized_pnl=-2_000.0,
    unrealized_pnl_pct=-20.0,
    purchase_date: date | None = date(2023, 1, 1),
):
    return SimpleNamespace(
        id=uuid.uuid4(),
        name=name,
        ticker=ticker,
        asset_type=asset_type,
        cost_basis=cost_basis,
        current_value_base=current_value_base,
        unrealized_pnl=unrealized_pnl,
        unrealized_pnl_pct=unrealized_pnl_pct,
        live_price=None,
        purchase_date=purchase_date,
    )


def _account(holdings, *, name="Main Brokerage"):
    return SimpleNamespace(account_name=name, provider_name=name, holdings=holdings)


def _portfolio(accounts, *, currency="USD", total_current_value=100_000.0):
    return SimpleNamespace(
        accounts=accounts,
        base_currency=currency,
        total_current_value=total_current_value,
    )


# ── _suggest_replacement ──────────────────────────────────────────────────────

class TestSuggestReplacement:
    def test_stock_suggests_vti(self):
        ticker, rationale = _suggest_replacement("stock")
        assert ticker == "VTI"
        assert rationale is not None and len(rationale) > 0

    def test_bond_suggests_agg(self):
        ticker, _ = _suggest_replacement("bond")
        assert ticker == "AGG"

    def test_etf_suggests_vt(self):
        ticker, _ = _suggest_replacement("etf")
        assert ticker == "VT"

    def test_real_estate_suggests_vnq(self):
        ticker, _ = _suggest_replacement("real_estate")
        assert ticker == "VNQ"

    def test_fund_suggests_vt(self):
        ticker, _ = _suggest_replacement("fund")
        assert ticker == "VT"

    def test_crypto_no_replacement(self):
        ticker, rationale = _suggest_replacement("crypto")
        assert ticker is None
        assert rationale is None

    def test_unknown_type_no_replacement(self):
        ticker, rationale = _suggest_replacement("other")
        assert ticker is None


# ── _holding_period_label ─────────────────────────────────────────────────────

class TestHoldingPeriodLabel:
    def test_short_term_label(self):
        label = _holding_period_label(187, True)
        assert "187 days" in label
        assert "short-term" in label

    def test_long_term_label(self):
        label = _holding_period_label(400, False)
        assert "400 days" in label
        assert "long-term" in label

    def test_none_days_returns_none(self):
        assert _holding_period_label(None, True) is None


# ── compute_opportunities ─────────────────────────────────────────────────────

class TestComputeOpportunities:
    def test_empty_portfolio_returns_zero_result(self):
        investor_id = uuid.uuid4()
        result = compute_opportunities(None, investor_id, "IL")
        assert isinstance(result, TaxOpportunityResult)
        assert result.harvest_opportunities == []
        assert result.total_estimated_tax_saving == 0.0

    def test_below_threshold_not_flagged(self):
        # Loss of 3% is below the 5% threshold
        h = _holding(unrealized_pnl_pct=-3.0, unrealized_pnl=-300.0, cost_basis=10_000.0)
        portfolio = _portfolio([_account([h])])
        result = compute_opportunities(portfolio, uuid.uuid4(), "US")
        assert result.harvest_opportunities == []

    def test_above_threshold_flagged(self):
        h = _holding(unrealized_pnl_pct=-20.0, unrealized_pnl=-2_000.0)
        portfolio = _portfolio([_account([h])])
        result = compute_opportunities(portfolio, uuid.uuid4(), "IL")
        assert len(result.harvest_opportunities) == 1

    def test_sorted_by_estimated_saving_desc(self):
        h_small = _holding(name="SmallLoss", unrealized_pnl_pct=-6.0, unrealized_pnl=-600.0, cost_basis=10_000.0)
        h_large = _holding(name="LargeLoss", unrealized_pnl_pct=-30.0, unrealized_pnl=-3_000.0, cost_basis=10_000.0)
        portfolio = _portfolio([_account([h_small, h_large])])
        result = compute_opportunities(portfolio, uuid.uuid4(), "IL")
        savings = [op.estimated_tax_saving for op in result.harvest_opportunities]
        assert savings == sorted(savings, reverse=True)

    def test_replacement_suggestion_populated(self):
        h = _holding(asset_type="stock", unrealized_pnl_pct=-20.0, unrealized_pnl=-2_000.0)
        portfolio = _portfolio([_account([h])])
        result = compute_opportunities(portfolio, uuid.uuid4(), "US")
        op = result.harvest_opportunities[0]
        assert op.suggested_replacement == "VTI"
        assert op.replacement_rationale is not None

    def test_holding_period_label_populated(self):
        h = _holding(
            unrealized_pnl_pct=-20.0, unrealized_pnl=-2_000.0,
            purchase_date=date(2024, 1, 1),
        )
        portfolio = _portfolio([_account([h])])
        result = compute_opportunities(portfolio, uuid.uuid4(), "IL")
        op = result.harvest_opportunities[0]
        assert op.holding_period_label is not None
        assert "days" in op.holding_period_label

    def test_holding_period_label_none_when_no_purchase_date(self):
        h = _holding(unrealized_pnl_pct=-20.0, unrealized_pnl=-2_000.0, purchase_date=None)
        portfolio = _portfolio([_account([h])])
        result = compute_opportunities(portfolio, uuid.uuid4(), "IL")
        op = result.harvest_opportunities[0]
        assert op.holding_period_label is None

    def test_crypto_no_replacement(self):
        h = _holding(asset_type="crypto", unrealized_pnl_pct=-40.0, unrealized_pnl=-4_000.0)
        portfolio = _portfolio([_account([h])])
        result = compute_opportunities(portfolio, uuid.uuid4(), "IL")
        op = result.harvest_opportunities[0]
        assert op.suggested_replacement is None

    def test_gain_offset_populated(self):
        h_loss = _holding(name="Loser", unrealized_pnl_pct=-20.0, unrealized_pnl=-2_000.0)
        h_gain = _holding(name="Winner", unrealized_pnl_pct=15.0, unrealized_pnl=1_500.0, cost_basis=10_000.0, current_value_base=11_500.0)
        portfolio = _portfolio([_account([h_loss, h_gain])])
        result = compute_opportunities(portfolio, uuid.uuid4(), "US")
        assert len(result.gain_offsets) >= 1
        assert result.gain_offsets[0].unrealized_gain > 0

    def test_total_saving_is_sum_of_individual(self):
        h1 = _holding(name="A", unrealized_pnl_pct=-20.0, unrealized_pnl=-2_000.0)
        h2 = _holding(name="B", unrealized_pnl_pct=-15.0, unrealized_pnl=-1_500.0)
        portfolio = _portfolio([_account([h1, h2])])
        result = compute_opportunities(portfolio, uuid.uuid4(), "IL")
        expected = sum(op.estimated_tax_saving for op in result.harvest_opportunities)
        assert abs(result.total_estimated_tax_saving - expected) < 0.01

"""Unit tests for scenario_analysis — no DB required."""
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from app.scenario_analysis.engine import compute, _apply_scenario, _tier_values
from app.scenario_analysis.scenarios import SCENARIOS, Scenario

INVESTOR_ID = uuid.uuid4()
NOW = datetime.now(timezone.utc)


# ── Helpers ────────────────────────────────────────────────────────────────

def _holding(name, asset_type, value, ticker=None):
    return SimpleNamespace(
        name=name,
        ticker=ticker,
        asset_type=asset_type,
        current_value_base=value,
        currency="USD",
    )


def _account(holdings):
    return SimpleNamespace(holdings=holdings)


def _portfolio(accounts, total=None):
    all_holdings = [h for acc in accounts for h in acc.holdings]
    computed_total = sum(h.current_value_base for h in all_holdings)
    return SimpleNamespace(
        total_current_value=total if total is not None else computed_total,
        total_cost_basis=computed_total * 0.8,
        accounts=accounts,
        base_currency="ILS",
    )


def _scenario(growth=-50.0, low_risk=-5.0, high_risk=-60.0, ils_fx=0.0, recovery=54):
    return Scenario(
        id="test", name="Test", description="desc", year="2000",
        low_risk_drawdown=low_risk,
        growth_drawdown=growth,
        high_risk_drawdown=high_risk,
        ils_fx_shock=ils_fx,
        recovery_months=recovery,
    )


# ── Scenario data integrity ────────────────────────────────────────────────

class TestScenariosData:
    def test_all_scenarios_have_required_fields(self):
        for s in SCENARIOS:
            assert s.id
            assert s.name
            assert isinstance(s.recovery_months, (int, type(None)))

    def test_covid_recovery_faster_than_gfc(self):
        gfc = next(s for s in SCENARIOS if s.id == "2008_gfc")
        covid = next(s for s in SCENARIOS if s.id == "covid_crash")
        assert covid.recovery_months < gfc.recovery_months

    def test_hypothetical_scenarios_have_no_recovery(self):
        for s in SCENARIOS:
            if s.year == "Hypothetical":
                assert s.recovery_months is None


# ── Per-holding impact ─────────────────────────────────────────────────────

class TestHoldingImpacts:
    def test_equity_holding_takes_growth_drawdown(self):
        acc = _account([_holding("AAPL", "stock", 10_000)])
        portfolio = _portfolio([acc])
        scenario = _scenario(growth=-40.0, low_risk=0.0, high_risk=0.0)
        tier_vals = _tier_values(portfolio)
        result = _apply_scenario(scenario, portfolio, tier_vals, "USD")

        assert len(result.holding_impacts) == 1
        hi = result.holding_impacts[0]
        assert hi.name == "AAPL"
        assert hi.simulated_loss == pytest.approx(-4_000.0, rel=1e-3)
        assert hi.simulated_value == pytest.approx(6_000.0, rel=1e-3)

    def test_bond_holding_takes_low_risk_drawdown(self):
        acc = _account([_holding("AGG", "bond", 5_000)])
        portfolio = _portfolio([acc])
        scenario = _scenario(growth=0.0, low_risk=-18.0, high_risk=0.0)
        tier_vals = _tier_values(portfolio)
        result = _apply_scenario(scenario, portfolio, tier_vals, "USD")

        hi = result.holding_impacts[0]
        assert hi.simulated_loss == pytest.approx(-900.0, rel=1e-3)

    def test_crypto_holding_takes_high_risk_drawdown(self):
        acc = _account([_holding("BTC", "crypto", 2_000)])
        portfolio = _portfolio([acc])
        scenario = _scenario(growth=0.0, low_risk=0.0, high_risk=-65.0)
        tier_vals = _tier_values(portfolio)
        result = _apply_scenario(scenario, portfolio, tier_vals, "USD")

        hi = result.holding_impacts[0]
        assert hi.simulated_loss == pytest.approx(-1_300.0, rel=1e-3)

    def test_holdings_sorted_worst_first(self):
        acc = _account([
            _holding("BTC", "crypto", 1_000),   # -65% → -650
            _holding("AAPL", "stock", 10_000),  # -50% → -5000
            _holding("AGG", "bond", 5_000),     # -5%  → -250
        ])
        portfolio = _portfolio([acc])
        scenario = _scenario(growth=-50.0, low_risk=-5.0, high_risk=-65.0)
        tier_vals = _tier_values(portfolio)
        result = _apply_scenario(scenario, portfolio, tier_vals, "USD")

        losses = [h.simulated_loss for h in result.holding_impacts]
        assert losses == sorted(losses)  # ascending (most negative first)

    def test_holding_impact_sum_matches_tier_loss(self):
        acc = _account([
            _holding("QQQ", "etf", 8_000),
            _holding("VTI", "etf", 2_000),
        ])
        portfolio = _portfolio([acc])
        scenario = _scenario(growth=-40.0, low_risk=0.0, high_risk=0.0)
        tier_vals = _tier_values(portfolio)
        result = _apply_scenario(scenario, portfolio, tier_vals, "USD")

        total_holding_loss = sum(h.simulated_loss for h in result.holding_impacts)
        assert total_holding_loss == pytest.approx(result.growth_loss, rel=1e-3)

    def test_zero_value_holdings_excluded(self):
        acc = _account([
            _holding("AAPL", "stock", 10_000),
            _holding("EMPTY", "stock", 0.0),
        ])
        portfolio = _portfolio([acc])
        scenario = _scenario(growth=-50.0)
        tier_vals = _tier_values(portfolio)
        result = _apply_scenario(scenario, portfolio, tier_vals, "USD")

        assert len(result.holding_impacts) == 1
        assert result.holding_impacts[0].name == "AAPL"

    def test_simulated_value_floor_zero(self):
        acc = _account([_holding("LUNA", "crypto", 500)])
        portfolio = _portfolio([acc])
        scenario = _scenario(growth=0.0, low_risk=0.0, high_risk=-200.0)  # impossible but test floor
        tier_vals = _tier_values(portfolio)
        result = _apply_scenario(scenario, portfolio, tier_vals, "USD")

        assert result.holding_impacts[0].simulated_value == 0.0

    def test_empty_portfolio_returns_empty_impacts(self):
        portfolio = _portfolio([_account([])])
        portfolio.total_current_value = 0.0
        scenario = _scenario()
        tier_vals = _tier_values(portfolio)
        result = _apply_scenario(scenario, portfolio, tier_vals, "USD")

        assert result.holding_impacts == []
        assert result.portfolio_loss == 0.0

    def test_recovery_months_passed_through(self):
        acc = _account([_holding("SPY", "etf", 10_000)])
        portfolio = _portfolio([acc])
        scenario = _scenario(recovery=6)
        tier_vals = _tier_values(portfolio)
        result = _apply_scenario(scenario, portfolio, tier_vals, "USD")

        assert result.recovery_months == 6

    def test_recovery_months_none_for_hypothetical(self):
        acc = _account([_holding("SPY", "etf", 10_000)])
        portfolio = _portfolio([acc])
        scenario = _scenario(recovery=None)
        tier_vals = _tier_values(portfolio)
        result = _apply_scenario(scenario, portfolio, tier_vals, "USD")

        assert result.recovery_months is None


# ── Full compute() integration ─────────────────────────────────────────────

class TestComputeIntegration:
    def test_compute_returns_all_scenarios(self):
        acc = _account([_holding("SPY", "etf", 50_000)])
        portfolio = _portfolio([acc])
        result = compute(portfolio, INVESTOR_ID, "USD", years_to_retirement=10)

        assert len(result.scenarios) == len(SCENARIOS)

    def test_compute_each_scenario_has_holding_impacts(self):
        acc = _account([
            _holding("SPY", "etf", 30_000),
            _holding("AGG", "bond", 20_000),
        ])
        portfolio = _portfolio([acc])
        result = compute(portfolio, INVESTOR_ID, "USD", years_to_retirement=10)

        for s in result.scenarios:
            # Only scenarios with non-zero drawdowns will have impacts
            if s.portfolio_loss != 0:
                assert len(s.holding_impacts) > 0

    def test_compute_none_portfolio(self):
        result = compute(None, INVESTOR_ID, "USD")
        assert result.scenarios == []
        assert result.current_value == 0.0

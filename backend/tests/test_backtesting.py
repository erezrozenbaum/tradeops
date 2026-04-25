import uuid
from unittest.mock import MagicMock

import pytest

from app.backtesting.engine import BacktestResult, run_backtest, _STRATEGY_PARAMS
from app.models.strategy_template import StrategyTemplate, StrategyType


def _make_template(
    strategy_type: StrategyType = StrategyType.balanced,
    name: str = "Test Strategy",
    min_investable_capital: float = 0.0,
    time_horizon_min_months: int = 24,
) -> StrategyTemplate:
    t = MagicMock(spec=StrategyTemplate)
    t.id = uuid.uuid4()
    t.strategy_type = strategy_type
    t.name = name
    t.min_investable_capital = min_investable_capital
    t.time_horizon_min_months = time_horizon_min_months
    return t


class TestStrategyParams:
    def test_all_strategy_types_have_params(self):
        for st in StrategyType:
            assert st.value in _STRATEGY_PARAMS

    def test_non_investable_types_have_zero_params(self):
        assert _STRATEGY_PARAMS[StrategyType.education_only.value] == (0.0, 0.0)
        assert _STRATEGY_PARAMS[StrategyType.foundation_building.value] == (0.0, 0.0)

    def test_speculative_has_higher_mean_than_conservative(self):
        spec_mean, _ = _STRATEGY_PARAMS[StrategyType.speculative.value]
        cons_mean, _ = _STRATEGY_PARAMS[StrategyType.conservative.value]
        assert spec_mean > cons_mean

    def test_speculative_has_higher_volatility_than_conservative(self):
        _, spec_std = _STRATEGY_PARAMS[StrategyType.speculative.value]
        _, cons_std = _STRATEGY_PARAMS[StrategyType.conservative.value]
        assert spec_std > cons_std


class TestBacktestEngine:
    def test_returns_backtest_result(self):
        t = _make_template()
        result = run_backtest(t, initial_capital=10000.0, period_months=12, currency="USD")
        assert isinstance(result, BacktestResult)

    def test_period_count_matches_requested(self):
        t = _make_template()
        result = run_backtest(t, initial_capital=10000.0, period_months=24, currency="USD")
        assert len(result.periods) == 24

    def test_period_months_stored_on_result(self):
        t = _make_template()
        result = run_backtest(t, initial_capital=10000.0, period_months=36, currency="USD")
        assert result.period_months == 36

    def test_deterministic_with_seed(self):
        t = _make_template()
        r1 = run_backtest(t, initial_capital=10000.0, period_months=24, currency="USD", seed=42)
        r2 = run_backtest(t, initial_capital=10000.0, period_months=24, currency="USD", seed=42)
        assert r1.final_capital == r2.final_capital
        assert r1.total_return_pct == r2.total_return_pct

    def test_different_seeds_produce_different_results(self):
        t = _make_template(strategy_type=StrategyType.balanced)
        r1 = run_backtest(t, initial_capital=10000.0, period_months=24, currency="USD", seed=1)
        r2 = run_backtest(t, initial_capital=10000.0, period_months=24, currency="USD", seed=99)
        assert r1.final_capital != r2.final_capital

    def test_education_only_zero_return(self):
        t = _make_template(strategy_type=StrategyType.education_only)
        result = run_backtest(t, initial_capital=5000.0, period_months=12, currency="USD", seed=0)
        assert result.total_return_pct == 0.0
        assert result.final_capital == result.initial_capital

    def test_foundation_building_zero_return(self):
        t = _make_template(strategy_type=StrategyType.foundation_building)
        result = run_backtest(t, initial_capital=5000.0, period_months=12, currency="USD", seed=0)
        assert result.total_return_pct == 0.0

    def test_zero_capital_produces_zero_final(self):
        t = _make_template(strategy_type=StrategyType.balanced)
        result = run_backtest(t, initial_capital=0.0, period_months=12, currency="USD", seed=42)
        assert result.final_capital == 0.0
        assert result.total_return_pct == 0.0

    def test_max_drawdown_non_negative(self):
        t = _make_template(strategy_type=StrategyType.speculative)
        result = run_backtest(t, initial_capital=10000.0, period_months=60, currency="USD", seed=7)
        assert result.max_drawdown_pct >= 0.0

    def test_win_rate_bounded_0_to_100(self):
        t = _make_template(strategy_type=StrategyType.growth)
        result = run_backtest(t, initial_capital=10000.0, period_months=48, currency="USD", seed=3)
        assert 0.0 <= result.win_rate_pct <= 100.0

    def test_total_return_matches_final_capital(self):
        t = _make_template(strategy_type=StrategyType.balanced)
        initial = 10000.0
        result = run_backtest(t, initial_capital=initial, period_months=12, currency="USD", seed=42)
        expected_return = round((result.final_capital - initial) / initial * 100, 4)
        assert result.total_return_pct == expected_return

    def test_period_month_numbers_sequential(self):
        t = _make_template()
        result = run_backtest(t, initial_capital=10000.0, period_months=6, currency="USD", seed=1)
        months = [p.month for p in result.periods]
        assert months == list(range(1, 7))

    def test_notes_not_empty(self):
        t = _make_template()
        result = run_backtest(t, initial_capital=10000.0, period_months=12, currency="USD", seed=1)
        assert len(result.notes) > 0

    def test_notes_contain_simulation_disclaimer(self):
        t = _make_template()
        result = run_backtest(t, initial_capital=10000.0, period_months=12, currency="USD", seed=1)
        assert "simulation" in result.notes.lower()


class TestBacktestMetrics:
    def test_sharpe_zero_for_zero_volatility_strategy(self):
        t = _make_template(strategy_type=StrategyType.education_only)
        result = run_backtest(t, initial_capital=10000.0, period_months=12, currency="USD")
        assert result.sharpe_ratio == 0.0

    def test_speculative_win_rate_plausible_over_long_horizon(self):
        t = _make_template(strategy_type=StrategyType.speculative)
        result = run_backtest(t, initial_capital=10000.0, period_months=120, currency="USD", seed=5)
        # With positive drift, win rate over 10 years should be above 30%
        assert result.win_rate_pct > 30.0

    def test_large_capital_scales_correctly(self):
        t = _make_template(strategy_type=StrategyType.balanced)
        r1 = run_backtest(t, initial_capital=1000.0, period_months=12, currency="USD", seed=42)
        r2 = run_backtest(t, initial_capital=100000.0, period_months=12, currency="USD", seed=42)
        # Same seed → same percentage return, scaled capital
        assert abs(r1.total_return_pct - r2.total_return_pct) < 0.0001

    def test_annualized_return_consistent_with_total_over_12_months(self):
        t = _make_template(strategy_type=StrategyType.conservative)
        result = run_backtest(t, initial_capital=10000.0, period_months=12, currency="USD", seed=10)
        # Over exactly 12 months, annualized ≈ total
        assert abs(result.annualized_return_pct - result.total_return_pct) < 0.5

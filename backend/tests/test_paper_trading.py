"""Tests for the paper trading engine (pure, no DB)."""
import pytest

from app.models.strategy_template import StrategyType
from app.paper_trading.engine import TickResult, simulate_tick


class TestSimulateTick:
    def test_returns_tick_result(self):
        result = simulate_tick(StrategyType.balanced.value, 10_000.0)
        assert isinstance(result, TickResult)

    def test_value_before_equals_current(self):
        result = simulate_tick(StrategyType.conservative.value, 5_000.0, seed=1)
        assert result.value_before == 5_000.0

    def test_deterministic_with_seed(self):
        r1 = simulate_tick(StrategyType.growth.value, 10_000.0, seed=42)
        r2 = simulate_tick(StrategyType.growth.value, 10_000.0, seed=42)
        assert r1.value_after == r2.value_after
        assert r1.monthly_return_pct == r2.monthly_return_pct

    def test_different_seeds_produce_different_results(self):
        r1 = simulate_tick(StrategyType.growth.value, 10_000.0, seed=1)
        r2 = simulate_tick(StrategyType.growth.value, 10_000.0, seed=2)
        assert r1.value_after != r2.value_after

    def test_zero_return_for_education_only(self):
        result = simulate_tick(StrategyType.education_only.value, 10_000.0, seed=99)
        assert result.monthly_return_pct == 0.0
        assert result.value_after == result.value_before

    def test_zero_return_for_foundation_building(self):
        result = simulate_tick(StrategyType.foundation_building.value, 10_000.0, seed=99)
        assert result.monthly_return_pct == 0.0

    def test_value_after_computed_correctly(self):
        result = simulate_tick(StrategyType.conservative.value, 10_000.0, seed=7)
        expected = round(result.value_before * (1.0 + result.monthly_return_pct / 100), 2)
        assert abs(result.value_after - expected) < 0.01

    def test_non_negative_value_for_zero_capital(self):
        result = simulate_tick(StrategyType.balanced.value, 0.0, seed=1)
        assert result.value_before == 0.0
        assert result.value_after == 0.0

    def test_unknown_strategy_type_defaults_to_zero(self):
        result = simulate_tick("unknown_type", 10_000.0, seed=1)
        assert result.monthly_return_pct == 0.0

    def test_all_strategy_types_are_covered(self):
        for st in StrategyType:
            result = simulate_tick(st.value, 1_000.0, seed=0)
            assert isinstance(result, TickResult)

    def test_value_before_rounded_to_two_decimals(self):
        result = simulate_tick(StrategyType.conservative.value, 1234.5678, seed=1)
        assert result.value_before == round(1234.5678, 2)

    def test_value_after_rounded_to_two_decimals(self):
        result = simulate_tick(StrategyType.speculative.value, 10_000.0, seed=3)
        assert result.value_after == round(result.value_after, 2)

    def test_monthly_return_pct_rounded_to_four_decimals(self):
        result = simulate_tick(StrategyType.growth.value, 10_000.0, seed=5)
        assert result.monthly_return_pct == round(result.monthly_return_pct, 4)

    def test_large_capital_scales_correctly(self):
        small = simulate_tick(StrategyType.balanced.value, 1_000.0, seed=10)
        large = simulate_tick(StrategyType.balanced.value, 1_000_000.0, seed=10)
        # Same return pct, values scale linearly
        assert small.monthly_return_pct == large.monthly_return_pct
        assert abs(large.value_after / large.value_before - small.value_after / small.value_before) < 1e-6

    def test_tick_seed_variation_produces_different_sequences(self):
        """Simulate advancing with different tick-derived seeds."""
        results = [
            simulate_tick(StrategyType.growth.value, 10_000.0, seed=100 + i)
            for i in range(5)
        ]
        returns = [r.monthly_return_pct for r in results]
        # At least some variation (not all identical)
        assert len(set(returns)) > 1

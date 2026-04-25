import pytest

from app.models.investor_profile import ExperienceLevel
from app.risk_modeling.service import _compute_allocation, _MINOR_ALLOCATION


class TestMinorAllocation:
    def test_minor_always_gets_full_low_risk(self):
        for modifier in ("reduce", "neutral", "allow_growth"):
            for level in ExperienceLevel:
                result = _compute_allocation(modifier, level, is_minor=True)
                assert result == _MINOR_ALLOCATION, (
                    f"Minor with {modifier}/{level} should get 100% low risk"
                )

    def test_minor_allocation_values(self):
        low, growth, high, drawdown = _MINOR_ALLOCATION
        assert low == 100.0
        assert growth == 0.0
        assert high == 0.0
        assert drawdown == 0.0


class TestReduceModifier:
    """Unstable/fragile investors are capped regardless of experience."""

    def test_reduce_caps_high_risk_at_zero(self):
        for level in ExperienceLevel:
            _, _, high, _ = _compute_allocation("reduce", level, is_minor=False)
            assert high == 0.0, f"reduce/{level} should have 0% high risk"

    def test_reduce_low_risk_dominant(self):
        for level in ExperienceLevel:
            low, growth, high, _ = _compute_allocation("reduce", level, is_minor=False)
            assert low == 85.0
            assert growth == 15.0
            assert high == 0.0

    def test_reduce_max_drawdown_is_5(self):
        for level in ExperienceLevel:
            _, _, _, drawdown = _compute_allocation("reduce", level, is_minor=False)
            assert drawdown == 5.0


class TestNeutralModifier:
    def test_neutral_beginner(self):
        low, growth, high, drawdown = _compute_allocation(
            "neutral", ExperienceLevel.beginner, is_minor=False
        )
        assert low == 70.0
        assert growth == 25.0
        assert high == 5.0
        assert drawdown == 10.0

    def test_neutral_intermediate(self):
        low, growth, high, drawdown = _compute_allocation(
            "neutral", ExperienceLevel.intermediate, is_minor=False
        )
        assert low == 60.0
        assert growth == 30.0
        assert high == 10.0
        assert drawdown == 15.0

    def test_neutral_advanced(self):
        low, growth, high, drawdown = _compute_allocation(
            "neutral", ExperienceLevel.advanced, is_minor=False
        )
        assert low == 50.0
        assert growth == 35.0
        assert high == 15.0
        assert drawdown == 20.0


class TestAllowGrowthModifier:
    def test_allow_growth_beginner(self):
        low, growth, high, drawdown = _compute_allocation(
            "allow_growth", ExperienceLevel.beginner, is_minor=False
        )
        assert low == 50.0
        assert growth == 35.0
        assert high == 15.0
        assert drawdown == 15.0

    def test_allow_growth_intermediate(self):
        low, growth, high, drawdown = _compute_allocation(
            "allow_growth", ExperienceLevel.intermediate, is_minor=False
        )
        assert low == 40.0
        assert growth == 40.0
        assert high == 20.0
        assert drawdown == 20.0

    def test_allow_growth_advanced(self):
        low, growth, high, drawdown = _compute_allocation(
            "allow_growth", ExperienceLevel.advanced, is_minor=False
        )
        assert low == 30.0
        assert growth == 45.0
        assert high == 25.0
        assert drawdown == 25.0


class TestAllocationInvariants:
    """Allocation percentages must always sum to 100."""

    def test_all_non_minor_combinations_sum_to_100(self):
        for modifier in ("reduce", "neutral", "allow_growth"):
            for level in ExperienceLevel:
                low, growth, high, _ = _compute_allocation(modifier, level, is_minor=False)
                total = low + growth + high
                assert total == 100.0, (
                    f"{modifier}/{level}: {low}+{growth}+{high}={total} (expected 100)"
                )

    def test_experience_increases_growth_allocation_for_neutral(self):
        beginner_high = _compute_allocation("neutral", ExperienceLevel.beginner, False)[2]
        intermediate_high = _compute_allocation("neutral", ExperienceLevel.intermediate, False)[2]
        advanced_high = _compute_allocation("neutral", ExperienceLevel.advanced, False)[2]
        assert beginner_high < intermediate_high < advanced_high

    def test_allow_growth_more_aggressive_than_neutral_same_level(self):
        for level in ExperienceLevel:
            _, _, neutral_high, _ = _compute_allocation("neutral", level, False)
            _, _, growth_high, _ = _compute_allocation("allow_growth", level, False)
            assert growth_high >= neutral_high, (
                f"allow_growth/{level} should have >= high risk than neutral/{level}"
            )

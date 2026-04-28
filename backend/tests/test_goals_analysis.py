"""Unit tests for goals_analysis.engine — no DB required."""
import uuid
from datetime import date, timedelta
from types import SimpleNamespace

import pytest

from app.goals_analysis.engine import analyze

INVESTOR_ID = uuid.uuid4()


def _goal(
    name="Retirement",
    goal_type="retirement",
    target_amount=500_000.0,
    current_amount=0.0,
    target_date=None,
    priority=1,
    currency="ILS",
):
    class _GoalType:
        value = goal_type

    g = SimpleNamespace(
        id=uuid.uuid4(),
        name=name,
        goal_type=_GoalType(),
        target_amount=target_amount,
        current_amount=current_amount,
        target_date=target_date,
        priority=priority,
        currency=currency,
    )
    g.progress_pct = round(min(current_amount / target_amount * 100, 100), 2) if target_amount > 0 else 0.0
    return g


def _future_date(months: int) -> date:
    return date.today() + timedelta(days=int(months * 30.4375))


class TestGoalComplete:
    def test_complete_goal(self):
        goal = _goal(target_amount=100_000, current_amount=100_000)
        result = analyze(INVESTOR_ID, [goal], monthly_surplus=5_000)
        ga = result.goals[0]
        assert ga.status == "complete"
        assert ga.on_track is True
        assert ga.monthly_contribution_needed is None
        assert result.total_monthly_contribution_needed == 0.0

    def test_over_complete_goal(self):
        goal = _goal(target_amount=100_000, current_amount=120_000)
        result = analyze(INVESTOR_ID, [goal], monthly_surplus=5_000)
        assert result.goals[0].status == "complete"
        assert result.goals[0].progress_pct == 100.0


class TestGoalWithTargetDate:
    def test_on_track_when_surplus_covers_needed(self):
        # 24 months from now, need 500k, currently 0 → ~20,800/mo needed
        goal = _goal(target_amount=500_000, current_amount=0, target_date=_future_date(24))
        result = analyze(INVESTOR_ID, [goal], monthly_surplus=25_000)
        ga = result.goals[0]
        assert ga.status == "on_track"
        assert ga.on_track is True
        assert ga.monthly_contribution_needed is not None
        assert ga.gap is not None
        assert ga.gap <= 0  # surplus covers it

    def test_at_risk_when_surplus_insufficient(self):
        goal = _goal(target_amount=500_000, current_amount=0, target_date=_future_date(24))
        result = analyze(INVESTOR_ID, [goal], monthly_surplus=5_000)
        ga = result.goals[0]
        assert ga.status == "at_risk"
        assert ga.on_track is False
        assert ga.gap is not None
        assert ga.gap > 0  # shortfall

    def test_at_risk_when_no_surplus_data(self):
        goal = _goal(target_amount=100_000, current_amount=0, target_date=_future_date(12))
        result = analyze(INVESTOR_ID, [goal], monthly_surplus=None)
        ga = result.goals[0]
        assert ga.status == "at_risk"
        assert ga.on_track is False
        assert ga.monthly_surplus is None
        assert ga.gap is None

    def test_monthly_contribution_computed_correctly(self):
        # 10 months from now, need 10,000 → exactly 1,000/mo
        goal = _goal(target_amount=10_000, current_amount=0, target_date=_future_date(10))
        result = analyze(INVESTOR_ID, [goal], monthly_surplus=500)
        ga = result.goals[0]
        assert ga.monthly_contribution_needed is not None
        assert abs(ga.monthly_contribution_needed - 1_000.0) < 10  # approximate due to days calc

    def test_past_target_date_is_at_risk(self):
        past_date = date.today() - timedelta(days=30)
        goal = _goal(target_amount=100_000, current_amount=0, target_date=past_date)
        result = analyze(INVESTOR_ID, [goal], monthly_surplus=5_000)
        assert result.goals[0].status == "at_risk"
        assert result.goals[0].on_track is False

    def test_months_to_target_is_populated(self):
        goal = _goal(target_amount=100_000, current_amount=0, target_date=_future_date(6))
        result = analyze(INVESTOR_ID, [goal], monthly_surplus=20_000)
        assert result.goals[0].months_to_target is not None
        assert 5.0 <= result.goals[0].months_to_target <= 7.0


class TestGoalWithoutTargetDate:
    def test_no_date_status(self):
        goal = _goal(target_amount=100_000, current_amount=0, target_date=None)
        result = analyze(INVESTOR_ID, [goal], monthly_surplus=5_000)
        ga = result.goals[0]
        assert ga.status == "no_date"
        assert ga.on_track is False
        assert ga.monthly_contribution_needed is None
        assert ga.months_to_target is None

    def test_no_date_does_not_contribute_to_total(self):
        goal = _goal(target_amount=100_000, current_amount=0, target_date=None)
        result = analyze(INVESTOR_ID, [goal], monthly_surplus=5_000)
        assert result.total_monthly_contribution_needed == 0.0


class TestMultipleGoals:
    def test_total_contribution_sums_active_goals(self):
        g1 = _goal(name="G1", target_amount=10_000, current_amount=0, target_date=_future_date(10))
        g2 = _goal(name="G2", target_amount=10_000, current_amount=0, target_date=_future_date(10))
        result = analyze(INVESTOR_ID, [g1, g2], monthly_surplus=50_000)
        # Both goals need ~1000/mo each → total ~2000/mo
        assert result.total_monthly_contribution_needed > 0
        assert len(result.goals) == 2

    def test_empty_goals_list(self):
        result = analyze(INVESTOR_ID, [], monthly_surplus=5_000)
        assert result.goals == []
        assert result.total_monthly_contribution_needed == 0.0

"""Unit tests for goal tracking modes — no DB required."""
import uuid
from types import SimpleNamespace


from app.goals_analysis.engine import analyze

INVESTOR_ID = uuid.uuid4()


def _goal(
    name="Test Goal",
    goal_type="custom",
    target_amount=10_000.0,
    current_amount=0.0,
    tracking_mode="target_by_date",
    mode_config=None,
    target_date=None,
    currency="ILS",
    priority=1,
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
        tracking_mode=tracking_mode,
        mode_config=mode_config,
        priority=priority,
        currency=currency,
    )
    g.progress_pct = round(min(current_amount / target_amount * 100, 100), 2) if target_amount > 0 else 0.0
    return g


def _log(year: int, month: int, planned: float, actual: float):
    return SimpleNamespace(period_year=year, period_month=month, planned_amount=planned, actual_amount=actual)


# ── monthly_contribution ───────────────────────────────────────────────────────

class TestMonthlyContribution:
    def test_on_track_when_current_meets_target(self):
        goal = _goal(tracking_mode="monthly_contribution", target_amount=5_000, current_amount=5_000)
        result = analyze(INVESTOR_ID, [goal], monthly_surplus=None)
        ga = result.goals[0]
        assert ga.on_track is True
        assert ga.status == "on_track"
        assert ga.gap == 0.0

    def test_at_risk_when_behind(self):
        goal = _goal(tracking_mode="monthly_contribution", target_amount=5_000, current_amount=3_000)
        result = analyze(INVESTOR_ID, [goal], monthly_surplus=None)
        ga = result.goals[0]
        assert ga.on_track is False
        assert ga.status == "at_risk"
        assert ga.gap == 2_000.0

    def test_monthly_contribution_needed_equals_target(self):
        goal = _goal(tracking_mode="monthly_contribution", target_amount=4_000, current_amount=1_000)
        result = analyze(INVESTOR_ID, [goal], monthly_surplus=None)
        assert result.goals[0].monthly_contribution_needed == 4_000.0

    def test_streak_computed_from_logs(self):
        goal = _goal(tracking_mode="monthly_contribution", target_amount=3_000, current_amount=3_000)
        logs = [
            _log(2026, 1, 3_000, 3_500),  # hit
            _log(2026, 2, 3_000, 3_200),  # hit
            _log(2026, 3, 3_000, 2_800),  # miss — streak resets here
            _log(2026, 4, 3_000, 3_100),  # hit (but streak breaks at month 3)
        ]
        result = analyze(INVESTOR_ID, [goal], monthly_surplus=None, progress_logs_by_goal={str(goal.id): logs})
        # Streak counts backwards from most recent: month 4 hit, month 3 miss → streak = 1
        assert result.goals[0].streak_months == 1

    def test_streak_zero_when_last_month_missed(self):
        goal = _goal(tracking_mode="monthly_contribution", target_amount=3_000, current_amount=3_000)
        logs = [_log(2026, 4, 3_000, 2_900)]  # miss
        result = analyze(INVESTOR_ID, [goal], monthly_surplus=None, progress_logs_by_goal={str(goal.id): logs})
        assert result.goals[0].streak_months == 0

    def test_streak_zero_with_no_logs(self):
        goal = _goal(tracking_mode="monthly_contribution", target_amount=3_000, current_amount=3_000)
        result = analyze(INVESTOR_ID, [goal], monthly_surplus=None)
        assert result.goals[0].streak_months == 0

    def test_contributes_to_total_monthly_needed(self):
        goal = _goal(tracking_mode="monthly_contribution", target_amount=5_000, current_amount=2_000)
        result = analyze(INVESTOR_ID, [goal], monthly_surplus=None)
        assert result.total_monthly_contribution_needed == 5_000.0


# ── monthly_passive_income ────────────────────────────────────────────────────

class TestMonthlyPassiveIncome:
    def test_at_risk_when_income_gap_exists(self):
        goal = _goal(tracking_mode="monthly_passive_income", target_amount=10_000, current_amount=3_000)
        result = analyze(INVESTOR_ID, [goal], monthly_surplus=None)
        ga = result.goals[0]
        assert ga.on_track is False
        assert ga.status == "at_risk"
        assert ga.income_gap == 7_000.0

    def test_complete_when_income_meets_target(self):
        goal = _goal(tracking_mode="monthly_passive_income", target_amount=10_000, current_amount=10_000)
        result = analyze(INVESTOR_ID, [goal], monthly_surplus=None)
        ga = result.goals[0]
        assert ga.on_track is True
        assert ga.status == "complete"
        assert ga.income_gap == 0.0

    def test_progress_pct_correct(self):
        goal = _goal(tracking_mode="monthly_passive_income", target_amount=10_000, current_amount=5_000)
        result = analyze(INVESTOR_ID, [goal], monthly_surplus=None)
        assert result.goals[0].progress_pct == 50.0

    def test_does_not_add_to_monthly_needed(self):
        # passive income goal has no monthly_contribution_needed
        goal = _goal(tracking_mode="monthly_passive_income", target_amount=10_000, current_amount=3_000)
        result = analyze(INVESTOR_ID, [goal], monthly_surplus=None)
        assert result.total_monthly_contribution_needed == 0.0


# ── balance_threshold ─────────────────────────────────────────────────────────

class TestBalanceThreshold:
    def test_min_threshold_on_track_when_above(self):
        goal = _goal(
            tracking_mode="balance_threshold",
            target_amount=50_000,
            current_amount=60_000,
            mode_config={"threshold_type": "min"},
        )
        result = analyze(INVESTOR_ID, [goal], monthly_surplus=None)
        ga = result.goals[0]
        assert ga.on_track is True
        assert ga.status == "on_track"
        assert ga.gap == 0.0

    def test_min_threshold_at_risk_when_below(self):
        goal = _goal(
            tracking_mode="balance_threshold",
            target_amount=50_000,
            current_amount=30_000,
            mode_config={"threshold_type": "min"},
        )
        result = analyze(INVESTOR_ID, [goal], monthly_surplus=None)
        ga = result.goals[0]
        assert ga.on_track is False
        assert ga.status == "at_risk"
        assert ga.gap == 20_000.0

    def test_max_threshold_on_track_when_below(self):
        goal = _goal(
            tracking_mode="balance_threshold",
            target_amount=100_000,
            current_amount=80_000,
            mode_config={"threshold_type": "max"},
        )
        result = analyze(INVESTOR_ID, [goal], monthly_surplus=None)
        ga = result.goals[0]
        assert ga.on_track is True
        assert ga.gap == 0.0

    def test_max_threshold_at_risk_when_above(self):
        goal = _goal(
            tracking_mode="balance_threshold",
            target_amount=100_000,
            current_amount=120_000,
            mode_config={"threshold_type": "max"},
        )
        result = analyze(INVESTOR_ID, [goal], monthly_surplus=None)
        ga = result.goals[0]
        assert ga.on_track is False
        assert ga.gap == 20_000.0

    def test_defaults_to_min_when_no_config(self):
        goal = _goal(tracking_mode="balance_threshold", target_amount=50_000, current_amount=60_000)
        result = analyze(INVESTOR_ID, [goal], monthly_surplus=None)
        assert result.goals[0].threshold_type == "min"
        assert result.goals[0].on_track is True


# ── debt_reduction ────────────────────────────────────────────────────────────

class TestDebtReduction:
    def test_at_risk_with_no_payment(self):
        goal = _goal(
            tracking_mode="debt_reduction",
            target_amount=200_000,  # total debt at start
            current_amount=0,       # amount paid
            mode_config={"monthly_payment": 0},
        )
        result = analyze(INVESTOR_ID, [goal], monthly_surplus=None)
        ga = result.goals[0]
        assert ga.on_track is False
        assert ga.status == "at_risk"
        assert ga.payoff_months is None

    def test_on_track_with_payment(self):
        goal = _goal(
            tracking_mode="debt_reduction",
            target_amount=100_000,
            current_amount=0,
            mode_config={"monthly_payment": 5_000},
        )
        result = analyze(INVESTOR_ID, [goal], monthly_surplus=None)
        ga = result.goals[0]
        assert ga.status == "on_track"
        assert ga.payoff_months == 20.0

    def test_complete_when_fully_paid(self):
        goal = _goal(
            tracking_mode="debt_reduction",
            target_amount=100_000,
            current_amount=100_000,  # all paid
            mode_config={"monthly_payment": 5_000},
        )
        result = analyze(INVESTOR_ID, [goal], monthly_surplus=None)
        ga = result.goals[0]
        assert ga.on_track is True
        assert ga.status == "complete"
        assert ga.payoff_months is None

    def test_amount_remaining_is_remaining_debt(self):
        goal = _goal(
            tracking_mode="debt_reduction",
            target_amount=200_000,
            current_amount=50_000,   # paid 50k
            mode_config={"monthly_payment": 5_000},
        )
        result = analyze(INVESTOR_ID, [goal], monthly_surplus=None)
        ga = result.goals[0]
        assert ga.amount_remaining == 150_000.0  # remaining debt
        assert ga.payoff_months == 30.0

    def test_progress_pct_reflects_amount_paid(self):
        goal = _goal(
            tracking_mode="debt_reduction",
            target_amount=100_000,
            current_amount=25_000,
            mode_config={"monthly_payment": 5_000},
        )
        result = analyze(INVESTOR_ID, [goal], monthly_surplus=None)
        assert result.goals[0].progress_pct == 25.0


# ── backward compatibility ─────────────────────────────────────────────────────

class TestBackwardCompatibility:
    def test_goal_without_tracking_mode_defaults_to_target_by_date(self):
        """Existing goals stored before tracking_mode column get None → fallback to target_by_date."""
        goal = _goal(tracking_mode=None, target_amount=100_000, current_amount=0)
        result = analyze(INVESTOR_ID, [goal], monthly_surplus=5_000)
        ga = result.goals[0]
        # Falls back to target_by_date: no target_date → no_date status
        assert ga.status == "no_date"

    def test_mixed_modes_in_one_call(self):
        g1 = _goal(name="G1", tracking_mode="target_by_date", target_amount=100_000, current_amount=0)
        g2 = _goal(name="G2", tracking_mode="monthly_contribution", target_amount=3_000, current_amount=3_000)
        g3 = _goal(name="G3", tracking_mode="debt_reduction", target_amount=50_000, current_amount=50_000,
                   mode_config={"monthly_payment": 2_000})
        result = analyze(INVESTOR_ID, [g1, g2, g3], monthly_surplus=5_000)
        assert len(result.goals) == 3
        statuses = {ga.name: ga.status for ga in result.goals}
        assert statuses["G2"] == "on_track"
        assert statuses["G3"] == "complete"

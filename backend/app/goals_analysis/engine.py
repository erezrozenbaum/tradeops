"""Pure goals analysis engine — no DB access."""
from datetime import date, datetime, timezone
import uuid

from app.goals_analysis.schemas import GoalAnalysis, GoalsAnalysisResult

_DAYS_PER_MONTH = 30.4375


def _months_until(target_date: date) -> float:
    delta_days = (target_date - date.today()).days
    return max(delta_days / _DAYS_PER_MONTH, 0.0)


def _goal_type_value(goal) -> str:
    gt = goal.goal_type
    return gt.value if hasattr(gt, "value") else str(gt)


class _GoalProxy:
    """Wraps a FinancialGoal, optionally overriding current_amount from a linked account."""

    def __init__(self, goal, current_amount_override: float | None = None):
        self._goal = goal
        self._override = current_amount_override

    def __getattr__(self, name: str):
        return getattr(self._goal, name)

    @property
    def current_amount(self) -> float:
        return self._override if self._override is not None else self._goal.current_amount

    @property
    def progress_pct(self) -> float:
        if self._goal.target_amount <= 0:
            return 0.0
        return round(min(self.current_amount / self._goal.target_amount * 100, 100), 2)


def _base(goal, *, on_track: bool, status: str, **extra) -> GoalAnalysis:
    amount_remaining = max(goal.target_amount - goal.current_amount, 0.0)
    return GoalAnalysis(
        id=goal.id,
        name=goal.name,
        goal_type=_goal_type_value(goal),
        tracking_mode=getattr(goal, "tracking_mode", None) or "target_by_date",
        target_amount=goal.target_amount,
        current_amount=goal.current_amount,
        progress_pct=goal.progress_pct,
        amount_remaining=round(amount_remaining, 2),
        target_date=goal.target_date.isoformat() if goal.target_date else None,
        months_to_target=None,
        monthly_contribution_needed=None,
        monthly_surplus=None,
        gap=None,
        on_track=on_track,
        status=status,
        currency=goal.currency,
        **extra,
    )


# ── Mode handlers ──────────────────────────────────────────────────────────────

def _analyze_target_by_date(goal, monthly_surplus: float | None) -> GoalAnalysis:
    if goal.progress_pct >= 100.0:
        return _base(goal, on_track=True, status="complete")

    if not goal.target_date:
        return _base(goal, on_track=False, status="no_date")

    months_to_target = _months_until(goal.target_date)
    if months_to_target <= 0:
        a = _base(goal, on_track=False, status="at_risk")
        a.months_to_target = 0.0
        return a

    amount_remaining = max(goal.target_amount - goal.current_amount, 0.0)
    monthly_needed = round(amount_remaining / months_to_target, 2)

    gap = None
    on_track = False
    status = "at_risk"
    if monthly_surplus is not None:
        gap = round(monthly_needed - monthly_surplus, 2)
        on_track = gap <= 0
        status = "on_track" if on_track else "at_risk"

    a = _base(goal, on_track=on_track, status=status)
    a.months_to_target = round(months_to_target, 1)
    a.monthly_contribution_needed = monthly_needed
    a.monthly_surplus = monthly_surplus
    a.gap = gap
    return a


def _analyze_monthly_contribution(goal, monthly_surplus: float | None, progress_logs: list) -> GoalAnalysis:
    """target_amount = monthly target, current_amount = current monthly contribution."""
    monthly_target = goal.target_amount
    current_monthly = goal.current_amount
    gap = round(monthly_target - current_monthly, 2)
    on_track = gap <= 0
    status = "on_track" if on_track else "at_risk"

    streak = 0
    for log in sorted(progress_logs, key=lambda l: (l.period_year, l.period_month), reverse=True):
        if log.actual_amount >= log.planned_amount:
            streak += 1
        else:
            break

    a = _base(goal, on_track=on_track, status=status, streak_months=streak)
    a.monthly_contribution_needed = monthly_target
    a.monthly_surplus = monthly_surplus
    a.gap = gap
    return a


def _analyze_monthly_passive_income(goal, monthly_surplus: float | None) -> GoalAnalysis:
    """target_amount = target monthly income, current_amount = current monthly passive income."""
    income_gap = round(max(goal.target_amount - goal.current_amount, 0.0), 2)
    on_track = income_gap <= 0
    status = "complete" if on_track else "at_risk"

    a = _base(goal, on_track=on_track, status=status, income_gap=income_gap)
    a.monthly_surplus = monthly_surplus
    return a


def _analyze_balance_threshold(goal, monthly_surplus: float | None) -> GoalAnalysis:
    """target_amount = threshold value, current_amount = current balance.
    mode_config.threshold_type: 'min' (stay above) | 'max' (stay below).
    """
    cfg = goal.mode_config or {}
    threshold_type = cfg.get("threshold_type", "min")
    target = goal.target_amount
    current = goal.current_amount

    if threshold_type == "min":
        on_track = current >= target
        gap = round(target - current, 2) if not on_track else 0.0
    else:
        on_track = current <= target
        gap = round(current - target, 2) if not on_track else 0.0

    status = "on_track" if on_track else "at_risk"
    a = _base(goal, on_track=on_track, status=status, threshold_type=threshold_type)
    a.monthly_surplus = monthly_surplus
    a.gap = gap
    return a


def _analyze_debt_reduction(goal, monthly_surplus: float | None) -> GoalAnalysis:
    """target_amount = total debt at start, current_amount = amount already paid.
    mode_config.monthly_payment = monthly payment amount.
    Remaining debt = target_amount - current_amount.
    """
    cfg = goal.mode_config or {}
    monthly_payment = cfg.get("monthly_payment", 0.0)
    remaining = round(goal.target_amount - goal.current_amount, 2)
    payoff_months = round(remaining / monthly_payment, 1) if monthly_payment > 0 and remaining > 0 else None

    on_track = remaining <= 0
    status = "complete" if on_track else ("on_track" if monthly_payment > 0 else "at_risk")

    a = _base(goal, on_track=on_track, status=status, payoff_months=payoff_months)
    a.amount_remaining = max(remaining, 0.0)
    a.monthly_contribution_needed = monthly_payment if monthly_payment > 0 else None
    a.monthly_surplus = monthly_surplus
    return a


# ── Public entry point ─────────────────────────────────────────────────────────

def analyze(
    investor_id: uuid.UUID,
    goals: list,
    monthly_surplus: float | None,
    progress_logs_by_goal: dict | None = None,
    account_value_overrides: dict[str, float] | None = None,
) -> GoalsAnalysisResult:
    if progress_logs_by_goal is None:
        progress_logs_by_goal = {}
    if account_value_overrides is None:
        account_value_overrides = {}

    goal_analyses: list[GoalAnalysis] = []
    total_needed = 0.0

    for _goal in goals:
        override = account_value_overrides.get(str(_goal.id))
        goal = _GoalProxy(_goal, override) if override is not None else _goal
        mode = getattr(goal, "tracking_mode", None) or "target_by_date"
        logs = progress_logs_by_goal.get(str(goal.id), [])

        if mode == "monthly_contribution":
            ga = _analyze_monthly_contribution(goal, monthly_surplus, logs)
        elif mode == "monthly_passive_income":
            ga = _analyze_monthly_passive_income(goal, monthly_surplus)
        elif mode == "balance_threshold":
            ga = _analyze_balance_threshold(goal, monthly_surplus)
        elif mode == "debt_reduction":
            ga = _analyze_debt_reduction(goal, monthly_surplus)
        else:
            ga = _analyze_target_by_date(goal, monthly_surplus)

        if ga.monthly_contribution_needed is not None:
            total_needed += ga.monthly_contribution_needed

        goal_analyses.append(ga)

    return GoalsAnalysisResult(
        investor_id=investor_id,
        goals=goal_analyses,
        total_monthly_contribution_needed=round(total_needed, 2),
        monthly_surplus=monthly_surplus,
        computed_at=datetime.now(timezone.utc),
    )

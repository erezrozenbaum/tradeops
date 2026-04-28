"""Pure goals analysis engine — no DB access."""
from datetime import date, datetime, timezone
import uuid

from app.goals_analysis.schemas import GoalAnalysis, GoalsAnalysisResult

_DAYS_PER_MONTH = 30.4375


def _months_until(target_date: date) -> float:
    delta_days = (target_date - date.today()).days
    return max(delta_days / _DAYS_PER_MONTH, 0.0)


def analyze(
    investor_id: uuid.UUID,
    goals: list,
    monthly_surplus: float | None,
) -> GoalsAnalysisResult:
    goal_analyses: list[GoalAnalysis] = []
    total_needed = 0.0

    for goal in goals:
        amount_remaining = max(goal.target_amount - goal.current_amount, 0.0)
        progress_pct = goal.progress_pct

        months_to_target: float | None = None
        monthly_contribution_needed: float | None = None
        gap: float | None = None

        if progress_pct >= 100.0:
            on_track = True
            status = "complete"
        elif goal.target_date:
            months_to_target = _months_until(goal.target_date)
            if months_to_target > 0:
                monthly_contribution_needed = round(amount_remaining / months_to_target, 2)
                total_needed += monthly_contribution_needed
                if monthly_surplus is not None:
                    gap = round(monthly_contribution_needed - monthly_surplus, 2)
                    on_track = gap <= 0
                    status = "on_track" if on_track else "at_risk"
                else:
                    on_track = False
                    status = "at_risk"
            else:
                on_track = False
                status = "at_risk"
        else:
            on_track = False
            status = "no_date"

        goal_analyses.append(GoalAnalysis(
            id=goal.id,
            name=goal.name,
            goal_type=goal.goal_type.value,
            target_amount=goal.target_amount,
            current_amount=goal.current_amount,
            progress_pct=progress_pct,
            amount_remaining=round(amount_remaining, 2),
            target_date=goal.target_date.isoformat() if goal.target_date else None,
            months_to_target=round(months_to_target, 1) if months_to_target is not None else None,
            monthly_contribution_needed=monthly_contribution_needed,
            monthly_surplus=monthly_surplus,
            gap=gap,
            on_track=on_track,
            status=status,
            currency=goal.currency,
        ))

    return GoalsAnalysisResult(
        investor_id=investor_id,
        goals=goal_analyses,
        total_monthly_contribution_needed=round(total_needed, 2),
        monthly_surplus=monthly_surplus,
        computed_at=datetime.now(timezone.utc),
    )

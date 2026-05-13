import uuid

from sqlalchemy.orm import Session

from app.financial_profiles.service import get_by_investor as get_financial_profile
from app.goals.service import get_by_investor as get_goals
from app.goals_analysis import engine
from app.goals_analysis.schemas import GoalsAnalysisResult
from app.models.investor_profile import InvestorProfile
from app.models.goal_progress_log import GoalProgressLog


def _account_current_value(db: Session, account_id: uuid.UUID, target_currency: str) -> float:
    """Sum holding values for a linked account, converted to target_currency."""
    from app.models.investment_account import InvestmentAccount
    from app.currency_engine.rates import convert as fx_convert

    account = db.get(InvestmentAccount, account_id)
    if not account:
        return 0.0

    total = 0.0
    for h in account.holdings:
        # Effective value: current_balance (pension), current_value (manual), or cost basis
        if h.current_balance is not None and h.current_balance > 0:
            value = h.current_balance
        elif h.current_value is not None and h.current_value > 0:
            value = h.current_value
        else:
            value = h.quantity * h.avg_buy_price
        total += fx_convert(db, value, h.currency, target_currency)

    return round(total, 2)


def get_analysis(db: Session, investor_id: uuid.UUID) -> GoalsAnalysisResult | None:
    investor = db.get(InvestorProfile, investor_id)
    if not investor:
        return None

    goals = get_goals(db, investor_id)
    financial_profile = get_financial_profile(db, investor_id)

    monthly_surplus: float | None = None
    if financial_profile:
        household_income = financial_profile.monthly_income + (financial_profile.spouse_income or 0.0)
        if household_income > 0:
            monthly_surplus = round(household_income - financial_profile.monthly_expenses, 2)

    goal_ids = [g.id for g in goals]
    logs = (
        db.query(GoalProgressLog)
        .filter(GoalProgressLog.goal_id.in_(goal_ids))
        .order_by(GoalProgressLog.period_year, GoalProgressLog.period_month)
        .all()
        if goal_ids
        else []
    )
    progress_logs_by_goal: dict[str, list] = {}
    for log in logs:
        key = str(log.goal_id)
        progress_logs_by_goal.setdefault(key, []).append(log)

    # Compute current value overrides for goals linked to investment accounts
    account_value_overrides: dict[str, float] = {}
    for goal in goals:
        if goal.linked_account_id:
            account_value_overrides[str(goal.id)] = _account_current_value(
                db, goal.linked_account_id, goal.currency
            )

    return engine.analyze(
        investor_id,
        goals,
        monthly_surplus,
        progress_logs_by_goal,
        account_value_overrides or None,
    )

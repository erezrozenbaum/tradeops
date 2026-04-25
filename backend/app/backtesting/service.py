import uuid

from sqlalchemy.orm import Session

from app.audit import service as audit
from app.backtesting.engine import run_backtest
from app.models.backtest import BacktestPeriod, BacktestRun
from app.models.investor_profile import InvestorProfile
from app.models.strategy_template import StrategyTemplate
from app.risk_modeling import service as rm_service


def create(
    db: Session,
    investor_id: uuid.UUID,
    strategy_template_id: uuid.UUID,
    period_months: int,
    seed: int | None = None,
) -> BacktestRun | None:
    investor = db.get(InvestorProfile, investor_id)
    if not investor:
        return None

    risk_model = rm_service.get_latest(db, investor_id)
    if not risk_model:
        return None

    template = db.get(StrategyTemplate, strategy_template_id)
    if not template or not template.is_active:
        return None

    result = run_backtest(
        template=template,
        initial_capital=risk_model.investable_capital,
        period_months=period_months,
        currency=risk_model.currency,
        seed=seed,
    )

    run = BacktestRun(
        investor_profile_id=investor_id,
        strategy_template_id=strategy_template_id,
        risk_model_id=risk_model.id,
        initial_capital=result.initial_capital,
        final_capital=result.final_capital,
        period_months=result.period_months,
        seed=seed,
        total_return_pct=result.total_return_pct,
        annualized_return_pct=result.annualized_return_pct,
        max_drawdown_pct=result.max_drawdown_pct,
        sharpe_ratio=result.sharpe_ratio,
        win_rate_pct=result.win_rate_pct,
        currency=risk_model.currency,
        notes=result.notes,
    )
    db.add(run)
    db.flush()

    for p in result.periods:
        db.add(BacktestPeriod(
            backtest_run_id=run.id,
            month=p.month,
            portfolio_value=p.portfolio_value,
            monthly_return_pct=p.monthly_return_pct,
        ))

    db.flush()
    audit.log_event(
        db,
        event_type="backtest.run_created",
        description=(
            f"Backtest run for template '{template.name}' over {period_months} months. "
            f"Return: {result.total_return_pct:.2f}%, drawdown: {result.max_drawdown_pct:.2f}%"
        ),
        investor_profile_id=investor_id,
        metadata={
            "backtest_run_id": str(run.id),
            "strategy_template_id": str(strategy_template_id),
            "period_months": period_months,
            "total_return_pct": result.total_return_pct,
            "max_drawdown_pct": result.max_drawdown_pct,
        },
    )
    db.commit()
    db.refresh(run)
    return run


def get(db: Session, investor_id: uuid.UUID, run_id: uuid.UUID) -> BacktestRun | None:
    return (
        db.query(BacktestRun)
        .filter(
            BacktestRun.id == run_id,
            BacktestRun.investor_profile_id == investor_id,
        )
        .first()
    )


def list_for_investor(db: Session, investor_id: uuid.UUID) -> list[BacktestRun]:
    return (
        db.query(BacktestRun)
        .filter(BacktestRun.investor_profile_id == investor_id)
        .order_by(BacktestRun.created_at.desc())
        .all()
    )

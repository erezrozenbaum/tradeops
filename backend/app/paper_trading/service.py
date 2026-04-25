import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.audit import service as audit
from app.models.investor_profile import InvestorProfile
from app.models.paper_trade import PaperPortfolio, PaperTick, PortfolioStatus
from app.models.strategy_template import StrategyTemplate
from app.paper_trading.engine import simulate_tick
from app.risk_modeling import service as rm_service


def create(
    db: Session,
    investor_id: uuid.UUID,
    strategy_template_id: uuid.UUID,
    backtest_run_id: uuid.UUID | None = None,
) -> PaperPortfolio | None:
    investor = db.get(InvestorProfile, investor_id)
    if not investor:
        return None

    risk_model = rm_service.get_latest(db, investor_id)
    if not risk_model:
        return None

    template = db.get(StrategyTemplate, strategy_template_id)
    if not template or not template.is_active:
        return None

    portfolio = PaperPortfolio(
        investor_profile_id=investor_id,
        strategy_template_id=strategy_template_id,
        risk_model_id=risk_model.id,
        backtest_run_id=backtest_run_id,
        initial_capital=risk_model.investable_capital,
        current_value=risk_model.investable_capital,
        total_return_pct=0.0,
        currency=risk_model.currency,
        status=PortfolioStatus.active,
    )
    db.add(portfolio)
    db.flush()

    audit.log_event(
        db,
        event_type="paper_trading.portfolio_created",
        description=(
            f"Paper portfolio created for strategy '{template.name}' "
            f"with initial capital {risk_model.investable_capital:.2f} {risk_model.currency}."
        ),
        investor_profile_id=investor_id,
        metadata={
            "portfolio_id": str(portfolio.id),
            "strategy_template_id": str(strategy_template_id),
            "initial_capital": risk_model.investable_capital,
            "currency": risk_model.currency,
        },
    )
    db.commit()
    db.refresh(portfolio)
    return portfolio


def advance_tick(
    db: Session,
    investor_id: uuid.UUID,
    portfolio_id: uuid.UUID,
    seed: int | None = None,
) -> PaperPortfolio | None:
    portfolio = _get_owned(db, investor_id, portfolio_id)
    if not portfolio:
        return None

    if portfolio.status != PortfolioStatus.active:
        return None

    strategy_type = (
        portfolio.template.strategy_type.value
        if hasattr(portfolio.template.strategy_type, "value")
        else str(portfolio.template.strategy_type)
    )

    tick_number = len(portfolio.ticks) + 1

    # Use a deterministic seed per tick if a base seed is provided,
    # ensuring the same base seed always produces the same full sequence.
    tick_seed = (seed + tick_number) if seed is not None else None
    result = simulate_tick(strategy_type, portfolio.current_value, seed=tick_seed)

    tick = PaperTick(
        portfolio_id=portfolio.id,
        tick_number=tick_number,
        portfolio_value_before=result.value_before,
        portfolio_value_after=result.value_after,
        monthly_return_pct=result.monthly_return_pct,
    )
    db.add(tick)

    portfolio.current_value = result.value_after
    portfolio.last_tick_at = datetime.now(timezone.utc)
    if portfolio.initial_capital > 0:
        portfolio.total_return_pct = round(
            (portfolio.current_value - portfolio.initial_capital)
            / portfolio.initial_capital
            * 100,
            4,
        )

    audit.log_event(
        db,
        event_type="paper_trading.tick_advanced",
        description=(
            f"Paper portfolio tick {tick_number}: "
            f"{result.monthly_return_pct:+.2f}% "
            f"({result.value_before:.2f} → {result.value_after:.2f} {portfolio.currency})"
        ),
        investor_profile_id=investor_id,
        metadata={
            "portfolio_id": str(portfolio.id),
            "tick_number": tick_number,
            "monthly_return_pct": result.monthly_return_pct,
            "value_before": result.value_before,
            "value_after": result.value_after,
        },
    )
    db.commit()
    db.refresh(portfolio)
    return portfolio


def close_portfolio(
    db: Session,
    investor_id: uuid.UUID,
    portfolio_id: uuid.UUID,
) -> PaperPortfolio | None:
    portfolio = _get_owned(db, investor_id, portfolio_id)
    if not portfolio:
        return None

    if portfolio.status == PortfolioStatus.completed:
        return portfolio

    portfolio.status = PortfolioStatus.completed

    audit.log_event(
        db,
        event_type="paper_trading.portfolio_closed",
        description=(
            f"Paper portfolio closed after {len(portfolio.ticks)} ticks. "
            f"Final return: {portfolio.total_return_pct:+.2f}%."
        ),
        investor_profile_id=investor_id,
        metadata={
            "portfolio_id": str(portfolio.id),
            "tick_count": len(portfolio.ticks),
            "total_return_pct": portfolio.total_return_pct,
        },
    )
    db.commit()
    db.refresh(portfolio)
    return portfolio


def get(
    db: Session, investor_id: uuid.UUID, portfolio_id: uuid.UUID
) -> PaperPortfolio | None:
    return _get_owned(db, investor_id, portfolio_id)


def list_for_investor(db: Session, investor_id: uuid.UUID) -> list[PaperPortfolio]:
    return (
        db.query(PaperPortfolio)
        .filter(PaperPortfolio.investor_profile_id == investor_id)
        .order_by(PaperPortfolio.started_at.desc())
        .all()
    )


def _get_owned(
    db: Session, investor_id: uuid.UUID, portfolio_id: uuid.UUID
) -> PaperPortfolio | None:
    return (
        db.query(PaperPortfolio)
        .filter(
            PaperPortfolio.id == portfolio_id,
            PaperPortfolio.investor_profile_id == investor_id,
        )
        .first()
    )

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.audit import service as audit
from app.market_data import service as market_data
from app.models.investor_profile import InvestorProfile
from app.models.paper_trade import (
    PaperOrder,
    PaperPortfolio,
    PaperPosition,
    PaperTick,
    PortfolioStatus,
)
from app.models.strategy_template import StrategyTemplate
from app.paper_trading.engine import simulate_tick
from app.risk_modeling import service as rm_service


def create(
    db: Session,
    investor_id: uuid.UUID,
    initial_cash: float,
    currency: str,
    strategy_template_id: uuid.UUID | None = None,
    backtest_run_id: uuid.UUID | None = None,
) -> PaperPortfolio | None:
    investor = db.get(InvestorProfile, investor_id)
    if not investor:
        return None

    template = None
    if strategy_template_id:
        template = db.get(StrategyTemplate, strategy_template_id)
        if not template or not template.is_active:
            return None

    risk_model = rm_service.get_latest(db, investor_id)

    portfolio = PaperPortfolio(
        investor_profile_id=investor_id,
        strategy_template_id=strategy_template_id,
        risk_model_id=risk_model.id if risk_model else None,
        backtest_run_id=backtest_run_id,
        initial_capital=initial_cash,
        cash_balance=initial_cash,
        current_value=initial_cash,
        total_return_pct=0.0,
        currency=currency.upper(),
        status=PortfolioStatus.active,
    )
    db.add(portfolio)
    db.flush()

    audit.log_event(
        db,
        event_type="paper_trading.portfolio_created",
        description=(
            f"Paper portfolio created with {initial_cash:.2f} {currency}"
            + (f" using strategy '{template.name}'" if template else "")
            + "."
        ),
        investor_profile_id=investor_id,
        metadata={
            "portfolio_id": str(portfolio.id),
            "initial_cash": initial_cash,
            "currency": currency,
            "strategy_template_id": str(strategy_template_id) if strategy_template_id else None,
        },
    )
    db.commit()
    db.refresh(portfolio)
    return portfolio


def place_order(
    db: Session,
    investor_id: uuid.UUID,
    portfolio_id: uuid.UUID,
    symbol: str,
    side: str,
    quantity: float,
    price_per_share: float | None = None,
) -> PaperPortfolio:
    portfolio = _get_owned(db, investor_id, portfolio_id)
    if not portfolio:
        raise HTTPException(status_code=404, detail="Paper portfolio not found.")
    if portfolio.status != PortfolioStatus.active:
        raise HTTPException(status_code=422, detail="Portfolio is not active.")

    symbol = symbol.upper()

    # Resolve execution price
    if price_per_share is None:
        snapshot = market_data.get_or_fetch(db, symbol)
        if snapshot is None:
            raise HTTPException(
                status_code=503,
                detail=f"Could not fetch live price for {symbol}. Enter price manually.",
            )
        price_per_share = snapshot.price

    total_value = round(quantity * price_per_share, 6)

    if side == "buy":
        if portfolio.cash_balance < total_value:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Insufficient cash: need {total_value:.2f}, "
                    f"have {portfolio.cash_balance:.2f} {portfolio.currency}."
                ),
            )
        _apply_buy(db, portfolio, symbol, quantity, price_per_share)
        portfolio.cash_balance = round(portfolio.cash_balance - total_value, 6)

    elif side == "sell":
        position = _get_position(db, portfolio_id, symbol)
        if not position or position.quantity < quantity:
            available = position.quantity if position else 0.0
            raise HTTPException(
                status_code=422,
                detail=f"Insufficient position: need {quantity}, have {available:.6f} {symbol}.",
            )
        _apply_sell(db, portfolio, position, quantity, price_per_share, total_value)
        portfolio.cash_balance = round(portfolio.cash_balance + total_value, 6)

    # Record the order
    order = PaperOrder(
        portfolio_id=portfolio_id,
        symbol=symbol,
        side=side,
        quantity=quantity,
        price_per_share=price_per_share,
        total_value=total_value,
    )
    db.add(order)

    # Recompute portfolio current_value = cash + sum of position market values
    # We do this lazily here; positions use the price of the current trade for the
    # updated symbol only. For the rest we keep avg_cost as a proxy.
    _recompute_value(db, portfolio, symbol, price_per_share)

    audit.log_event(
        db,
        event_type=f"paper_trading.order_{side}",
        description=(
            f"Paper {side.upper()} {quantity} × {symbol} @ {price_per_share:.4f} "
            f"(total {total_value:.2f} {portfolio.currency})."
        ),
        investor_profile_id=investor_id,
        metadata={
            "portfolio_id": str(portfolio_id),
            "symbol": symbol,
            "side": side,
            "quantity": quantity,
            "price_per_share": price_per_share,
            "total_value": total_value,
        },
    )
    db.commit()
    db.refresh(portfolio)
    return portfolio


def _apply_buy(
    db: Session,
    portfolio: PaperPortfolio,
    symbol: str,
    quantity: float,
    price: float,
) -> None:
    position = _get_position(db, portfolio.id, symbol)
    if position:
        old_cost = position.avg_cost_per_share * position.quantity
        new_cost = price * quantity
        position.quantity = round(position.quantity + quantity, 8)
        position.avg_cost_per_share = round((old_cost + new_cost) / position.quantity, 8)
        position.updated_at = datetime.now(timezone.utc)
    else:
        db.add(PaperPosition(
            portfolio_id=portfolio.id,
            symbol=symbol,
            quantity=quantity,
            avg_cost_per_share=price,
            currency="USD",  # market data prices are in the ticker's native currency
        ))


def _apply_sell(
    db: Session,
    portfolio: PaperPortfolio,
    position: PaperPosition,
    quantity: float,
    price: float,
    total_value: float,
) -> None:
    remaining = round(position.quantity - quantity, 8)
    if remaining <= 1e-9:
        db.delete(position)
    else:
        position.quantity = remaining
        position.updated_at = datetime.now(timezone.utc)


def _recompute_value(
    db: Session,
    portfolio: PaperPortfolio,
    updated_symbol: str,
    updated_price: float,
) -> None:
    positions = (
        db.query(PaperPosition)
        .filter(PaperPosition.portfolio_id == portfolio.id)
        .all()
    )
    positions_value = sum(
        (updated_price if p.symbol == updated_symbol else p.avg_cost_per_share) * p.quantity
        for p in positions
    )
    portfolio.current_value = round(portfolio.cash_balance + positions_value, 6)
    if portfolio.initial_capital > 0:
        portfolio.total_return_pct = round(
            (portfolio.current_value - portfolio.initial_capital) / portfolio.initial_capital * 100, 4
        )


def _get_position(db: Session, portfolio_id: uuid.UUID, symbol: str) -> PaperPosition | None:
    return (
        db.query(PaperPosition)
        .filter(
            PaperPosition.portfolio_id == portfolio_id,
            PaperPosition.symbol == symbol,
        )
        .first()
    )


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
    if not portfolio.template:
        return None  # tick simulation requires a strategy template

    strategy_type = (
        portfolio.template.strategy_type.value
        if hasattr(portfolio.template.strategy_type, "value")
        else str(portfolio.template.strategy_type)
    )

    tick_number = len(portfolio.ticks) + 1
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
            f"Paper portfolio closed. "
            f"Final return: {portfolio.total_return_pct:+.2f}%."
        ),
        investor_profile_id=investor_id,
        metadata={
            "portfolio_id": str(portfolio.id),
            "total_return_pct": portfolio.total_return_pct,
        },
    )
    db.commit()
    db.refresh(portfolio)
    return portfolio


def delete_portfolio(
    db: Session,
    investor_id: uuid.UUID,
    portfolio_id: uuid.UUID,
) -> bool:
    portfolio = _get_owned(db, investor_id, portfolio_id)
    if not portfolio:
        return False

    audit.log_event(
        db,
        event_type="paper_trading.portfolio_deleted",
        description=f"Paper portfolio deleted (return was {portfolio.total_return_pct:+.2f}%).",
        investor_profile_id=investor_id,
        metadata={"portfolio_id": str(portfolio_id)},
    )
    db.delete(portfolio)
    db.commit()
    return True


def get(
    db: Session, investor_id: uuid.UUID, portfolio_id: uuid.UUID
) -> PaperPortfolio | None:
    return _get_owned(db, investor_id, portfolio_id)


def list_for_investor(
    db: Session, investor_id: uuid.UUID, skip: int = 0, limit: int = 50
) -> list[PaperPortfolio]:
    return (
        db.query(PaperPortfolio)
        .filter(PaperPortfolio.investor_profile_id == investor_id)
        .order_by(PaperPortfolio.started_at.desc())
        .offset(skip)
        .limit(limit)
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

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.paper_trading import service
from app.schemas.paper_trade import (
    AdvanceTickRequest,
    PaperOrderCreate,
    PaperPortfolioCreate,
    PaperPortfolioOut,
    PaperPortfolioRename,
    PaperPortfolioSummaryOut,
)

router = APIRouter()


@router.post("", response_model=PaperPortfolioOut, status_code=status.HTTP_201_CREATED)
def create_portfolio(
    investor_id: uuid.UUID,
    body: PaperPortfolioCreate,
    db: Session = Depends(get_db),
):
    portfolio = service.create(
        db,
        investor_id=investor_id,
        initial_cash=body.initial_cash,
        currency=body.currency,
        strategy_template_id=body.strategy_template_id,
        backtest_run_id=body.backtest_run_id,
        name=body.name,
    )
    if portfolio is None:
        raise HTTPException(
            status_code=422,
            detail="Cannot create paper portfolio — investor not found or strategy template is inactive.",
        )
    return service.build_enriched_out(db, portfolio)


@router.get("", response_model=list[PaperPortfolioSummaryOut])
def list_portfolios(
    investor_id: uuid.UUID,
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    return service.list_for_investor(db, investor_id, skip=skip, limit=limit)


@router.get("/{portfolio_id}", response_model=PaperPortfolioOut)
def get_portfolio(
    investor_id: uuid.UUID, portfolio_id: uuid.UUID, db: Session = Depends(get_db)
):
    portfolio = service.get(db, investor_id, portfolio_id)
    if not portfolio:
        raise HTTPException(status_code=404, detail="Paper portfolio not found.")
    return service.build_enriched_out(db, portfolio)


@router.patch("/{portfolio_id}", response_model=PaperPortfolioSummaryOut)
def rename_portfolio(
    investor_id: uuid.UUID,
    portfolio_id: uuid.UUID,
    body: PaperPortfolioRename,
    db: Session = Depends(get_db),
):
    portfolio = service.rename_portfolio(db, investor_id, portfolio_id, body.name)
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Paper portfolio not found.")
    return portfolio


@router.post("/{portfolio_id}/orders", response_model=PaperPortfolioOut)
def place_order(
    investor_id: uuid.UUID,
    portfolio_id: uuid.UUID,
    body: PaperOrderCreate,
    db: Session = Depends(get_db),
):
    portfolio = service.place_order(
        db,
        investor_id=investor_id,
        portfolio_id=portfolio_id,
        symbol=body.symbol,
        side=body.side,
        quantity=body.quantity,
        price_per_share=body.price_per_share,
    )
    return service.build_enriched_out(db, portfolio)


@router.post("/{portfolio_id}/reprice", response_model=PaperPortfolioOut)
def reprice_positions(
    investor_id: uuid.UUID,
    portfolio_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """Fetch live market prices for all positions and recompute portfolio value."""
    portfolio = service.reprice_positions(db, investor_id=investor_id, portfolio_id=portfolio_id)
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Paper portfolio not found.")
    return service.build_enriched_out(db, portfolio)


@router.post("/{portfolio_id}/tick", response_model=PaperPortfolioOut)
def advance_tick(
    investor_id: uuid.UUID,
    portfolio_id: uuid.UUID,
    body: AdvanceTickRequest,
    db: Session = Depends(get_db),
):
    portfolio = service.advance_tick(
        db, investor_id=investor_id, portfolio_id=portfolio_id, seed=body.seed
    )
    if portfolio is None:
        raise HTTPException(
            status_code=422,
            detail="Cannot advance tick — portfolio not found, not active, or has no strategy template.",
        )
    return service.build_enriched_out(db, portfolio)


@router.post("/{portfolio_id}/close", response_model=PaperPortfolioOut)
def close_portfolio(
    investor_id: uuid.UUID,
    portfolio_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    portfolio = service.close_portfolio(db, investor_id=investor_id, portfolio_id=portfolio_id)
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Paper portfolio not found.")
    return service.build_enriched_out(db, portfolio)


@router.post(
    "/{portfolio_id}/positions/{position_id}/promote",
    status_code=status.HTTP_201_CREATED,
)
def promote_position(
    investor_id: uuid.UUID,
    portfolio_id: uuid.UUID,
    position_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """Create a real staged buy order from a paper position."""
    return service.promote_position_to_real(db, investor_id, portfolio_id, position_id)


@router.delete("/{portfolio_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_portfolio(
    investor_id: uuid.UUID,
    portfolio_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    deleted = service.delete_portfolio(db, investor_id=investor_id, portfolio_id=portfolio_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Paper portfolio not found.")

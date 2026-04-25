import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.paper_trading import service
from app.schemas.paper_trade import (
    AdvanceTickRequest,
    PaperPortfolioCreate,
    PaperPortfolioOut,
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
        strategy_template_id=body.strategy_template_id,
        backtest_run_id=body.backtest_run_id,
    )
    if portfolio is None:
        raise HTTPException(
            status_code=422,
            detail=(
                "Cannot create paper portfolio — investor profile, risk model, or strategy "
                "template not found. Ensure a risk model has been generated and the template is active."
            ),
        )
    return portfolio


@router.get("", response_model=list[PaperPortfolioSummaryOut])
def list_portfolios(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    return service.list_for_investor(db, investor_id)


@router.get("/{portfolio_id}", response_model=PaperPortfolioOut)
def get_portfolio(
    investor_id: uuid.UUID, portfolio_id: uuid.UUID, db: Session = Depends(get_db)
):
    portfolio = service.get(db, investor_id, portfolio_id)
    if not portfolio:
        raise HTTPException(status_code=404, detail="Paper portfolio not found.")
    return portfolio


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
            detail="Cannot advance tick — portfolio not found or is not active.",
        )
    return portfolio


@router.post("/{portfolio_id}/close", response_model=PaperPortfolioOut)
def close_portfolio(
    investor_id: uuid.UUID,
    portfolio_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    portfolio = service.close_portfolio(db, investor_id=investor_id, portfolio_id=portfolio_id)
    if portfolio is None:
        raise HTTPException(status_code=404, detail="Paper portfolio not found.")
    return portfolio

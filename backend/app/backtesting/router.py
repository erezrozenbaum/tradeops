import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.backtesting import service
from app.db.session import get_db
from app.risk_modeling import service as rm_service
from app.schemas.backtest import BacktestRequest, BacktestRunOut, BacktestRunSummaryOut

router = APIRouter()


@router.post("", response_model=BacktestRunOut, status_code=status.HTTP_201_CREATED)
def create_backtest(
    investor_id: uuid.UUID,
    body: BacktestRequest,
    db: Session = Depends(get_db),
):
    risk_model = rm_service.get_latest(db, investor_id)
    if risk_model and risk_model.investable_capital <= 0:
        raise HTTPException(
            status_code=422,
            detail=(
                "Investable capital is ₪0 — cannot run backtest. "
                "Go to Financial → set your savings and investable %, "
                "then regenerate your Risk Model."
            ),
        )

    run = service.create(
        db,
        investor_id=investor_id,
        strategy_template_id=body.strategy_template_id,
        period_months=body.period_months,
        seed=body.seed,
    )
    if run is None:
        raise HTTPException(
            status_code=422,
            detail=(
                "Cannot run backtest — investor profile, risk model, or strategy template not found. "
                "Ensure a risk model has been generated and the template is active."
            ),
        )
    return run


@router.get("", response_model=list[BacktestRunSummaryOut])
def list_backtests(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    return service.list_for_investor(db, investor_id)


@router.get("/{run_id}", response_model=BacktestRunOut)
def get_backtest(investor_id: uuid.UUID, run_id: uuid.UUID, db: Session = Depends(get_db)):
    run = service.get(db, investor_id, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Backtest run not found.")
    return run

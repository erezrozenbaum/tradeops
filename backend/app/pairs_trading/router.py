import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.audit_event import AuditEvent
from app.models.market_signal import MarketSignal
from app.pairs_trading import engine
from app.pairs_trading.schemas import PairAnalysis, PairSignalOut, PairSignalSave

router = APIRouter()


@router.get("/analyze", response_model=PairAnalysis)
def analyze_pair(
    investor_id: uuid.UUID,
    ticker1: str = Query(..., min_length=1, max_length=15),
    ticker2: str = Query(..., min_length=1, max_length=15),
    lookback: int = Query(252, ge=30, le=504),
):
    """Analyze a pairs trading candidate.

    Returns the OLS hedge ratio, Z-score, ADF cointegration test result,
    and the current trading signal. No DB writes — pure read/compute.
    """
    result = engine.analyze_pair(ticker1.upper(), ticker2.upper(), lookback)
    if result is None:
        raise HTTPException(
            status_code=422,
            detail=f"Could not fetch sufficient price history for {ticker1}/{ticker2}. "
                   "Ensure both tickers are valid and have at least 30 trading days of data.",
        )
    return result


@router.post("/signals", response_model=PairSignalOut, status_code=201)
def save_signal(
    investor_id: uuid.UUID,
    body: PairSignalSave,
    db: Session = Depends(get_db),
):
    """Run pair analysis and persist the signal to market_signals.

    - Approved if pair is cointegrated (ADF τ < -2.87).
    - Rejected if not cointegrated (spurious pair, do not trade).
    - Signal is always paper-mode — no live execution.
    """
    result = engine.analyze_pair(body.ticker1.upper(), body.ticker2.upper(), body.lookback_days)
    if result is None:
        raise HTTPException(
            status_code=422,
            detail="Could not fetch sufficient price history for this pair.",
        )

    guard_status = "APPROVED" if result.is_cointegrated else "REJECTED"
    mute_reason = None if result.is_cointegrated else (
        f"ADF statistic {result.adf_stat:.3f} > -2.87 critical value — pair is not cointegrated."
    )

    signal = MarketSignal(
        investor_id=investor_id,
        ticker=f"{result.ticker1}/{result.ticker2}",
        signal_type="PAIRS_ZSCORE",
        signal_date=date.today(),
        composite_score=min(100, max(0, int(abs(result.z_score) * 25))),
        rationale=result.signal_reason,
        guard_status=guard_status,
        mute_reason=mute_reason,
        personal_guard_metadata={
            "ticker1": result.ticker1,
            "ticker2": result.ticker2,
            "z_score": result.z_score,
            "hedge_ratio": result.hedge_ratio,
            "adf_stat": result.adf_stat,
            "is_cointegrated": result.is_cointegrated,
            "signal": result.signal,
            "lookback_days": result.lookback_days,
            "data_points": result.data_points,
        },
        whale_entities=[],
    )
    db.add(signal)

    db.add(AuditEvent(
        investor_profile_id=investor_id,
        event_type="pairs_signal_created",
        description=(
            f"Pairs signal {result.ticker1}/{result.ticker2}: {result.signal} "
            f"(Z={result.z_score:.2f}, cointegrated={result.is_cointegrated}, "
            f"guard={guard_status})"
        ),
        event_metadata={
            "ticker1": result.ticker1,
            "ticker2": result.ticker2,
            "z_score": result.z_score,
            "guard_status": guard_status,
        },
    ))

    db.commit()
    db.refresh(signal)

    return PairSignalOut(
        id=signal.id,
        investor_id=signal.investor_id,
        ticker1=result.ticker1,
        ticker2=result.ticker2,
        z_score=result.z_score,
        hedge_ratio=result.hedge_ratio,
        is_cointegrated=result.is_cointegrated,
        signal=result.signal,
        guard_status=signal.guard_status,
        signal_date=signal.signal_date,
        created_at=signal.created_at,
    )

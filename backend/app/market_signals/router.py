import uuid
from datetime import date, datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.market_signals.schemas import MarketSignalsResult, SentimentTick, TickerSignal

router = APIRouter()


@router.get("", response_model=MarketSignalsResult)
def get_market_signals(
    investor_id: uuid.UUID,
    include_muted: bool = Query(False, description="Include guard-muted signals"),
    days: int = Query(7, ge=1, le=30, description="Trend window in days"),
    db: Session = Depends(get_db),
):
    """Return today's Market Signal Monitor results for all held tickers.

    - Only APPROVED, non-dismissed signals are returned by default.
    - 7-day rolling sentiment history and trend direction included per ticker.
    - Connected insights (tax-loss harvest, rebalancing) attached where relevant.
    """
    from app.models.investor_profile import InvestorProfile
    from app.models.market_signal import MarketSignal
    from app.portfolio_analysis.service import get_portfolio
    from app.risk_modeling.service import get_latest as get_latest_risk_model
    from app.market_signals.guard import compute_trend_direction, build_connected_insight
    from sqlalchemy import and_

    investor = db.get(InvestorProfile, investor_id)
    if investor is None:
        raise HTTPException(status_code=404, detail="Investor not found")

    portfolio = get_portfolio(db, investor_id)
    if portfolio is None:
        raise HTTPException(status_code=404, detail="No portfolio found")

    currency = portfolio.base_currency
    total_value = portfolio.total_current_value

    # Build ticker→context map from current portfolio
    ticker_context: dict[str, dict] = {}
    for acc in portfolio.accounts:
        for h in acc.holdings:
            if not h.ticker:
                continue
            pct = h.current_value_base / total_value * 100 if total_value > 0 else 0.0
            holding_days = 0
            if h.purchase_date:
                holding_days = (date.today() - h.purchase_date).days
            if h.ticker not in ticker_context:
                ticker_context[h.ticker] = {
                    "value": h.current_value_base,
                    "pct": pct,
                    "pnl": h.unrealized_pnl,
                    "days": holding_days,
                }
            else:
                ticker_context[h.ticker]["value"] += h.current_value_base
                ticker_context[h.ticker]["pct"] += pct
                ticker_context[h.ticker]["pnl"] += h.unrealized_pnl

    # Fetch signals from last `days` days
    since = date.today() - timedelta(days=days - 1)
    all_signals = (
        db.query(MarketSignal)
        .filter(
            and_(
                MarketSignal.investor_id == investor_id,
                MarketSignal.signal_date >= since,
                MarketSignal.is_dismissed == False,  # noqa: E712
            )
        )
        .order_by(MarketSignal.ticker, MarketSignal.signal_date)
        .all()
    )

    # Group by ticker
    by_ticker: dict[str, list[MarketSignal]] = {}
    for sig in all_signals:
        by_ticker.setdefault(sig.ticker, []).append(sig)

    ticker_signals: list[TickerSignal] = []
    muted_count = 0
    whale_count = 0

    for ticker, ticker_records in by_ticker.items():
        # Latest signal for this ticker
        latest = ticker_records[-1]

        if latest.guard_status == "MUTED":
            muted_count += 1
            if not include_muted:
                continue

        if latest.signal_type == "WHALE_MENTION":
            whale_count += 1

        # 7-day trend from historical records
        history = [
            SentimentTick(
                signal_date=s.signal_date,
                sentiment_score=s.sentiment_score or 0.0,
                composite_score=s.composite_score or 50,
            )
            for s in ticker_records
            if s.sentiment_score is not None
        ]
        scores_ordered = [t.sentiment_score for t in history]
        trend = compute_trend_direction(scores_ordered)

        ctx = ticker_context.get(ticker, {})
        position_pct = ctx.get("pct", 0.0)
        position_value = ctx.get("value")
        unrealized_pnl = ctx.get("pnl")
        holding_days = ctx.get("days")

        insight = build_connected_insight(
            ticker=ticker,
            sentiment_score=latest.sentiment_score or 0.0,
            ticker_pct_of_portfolio=position_pct,
            unrealized_pnl=unrealized_pnl,
            holding_days=holding_days,
            currency=currency,
        )

        ticker_signals.append(TickerSignal(
            signal_id=latest.id,
            ticker=ticker,
            signal_type=latest.signal_type,
            signal_date=latest.signal_date,
            sentiment_score=latest.sentiment_score or 0.0,
            composite_score=latest.composite_score or 50,
            rationale=latest.rationale or "",
            whale_entities=latest.whale_entities or [],
            guard_status=latest.guard_status,
            mute_reason=latest.mute_reason,
            is_dismissed=latest.is_dismissed,
            position_value=position_value,
            position_pct=position_pct,
            unrealized_pnl=unrealized_pnl,
            holding_days=holding_days,
            trend_direction=trend,
            trend_history=history,
            connected_insight=insight,
        ))

    # Sort: whale mentions first, then by composite_score descending
    ticker_signals.sort(
        key=lambda s: (s.signal_type != "WHALE_MENTION", -(s.composite_score or 0))
    )

    approved_count = sum(1 for s in ticker_signals if s.guard_status == "APPROVED")

    return MarketSignalsResult(
        investor_id=investor_id,
        currency=currency,
        tickers_monitored=len(ticker_context),
        approved_count=approved_count,
        muted_count=muted_count,
        whale_mention_count=whale_count,
        signals=ticker_signals,
        computed_at=datetime.now(timezone.utc),
    )


@router.post("/{signal_id}/dismiss", status_code=204)
def dismiss_signal(
    investor_id: uuid.UUID,
    signal_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """Mark a signal as dismissed so it no longer appears in the monitor."""
    from app.models.market_signal import MarketSignal
    from sqlalchemy import and_

    signal = db.get(MarketSignal, signal_id)
    if not signal or signal.investor_id != investor_id:
        raise HTTPException(status_code=404, detail="Signal not found")
    signal.is_dismissed = True
    db.commit()

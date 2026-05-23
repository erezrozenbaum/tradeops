import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.recommendation_decision import RecommendationDecision
from app.provenance.schemas import DecisionDetail, DecisionListItem

router = APIRouter()


@router.get("", response_model=list[DecisionListItem])
def list_decisions(
    investor_id: uuid.UUID,
    decision_type: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    q = (
        db.query(RecommendationDecision)
        .filter(RecommendationDecision.investor_id == investor_id)
    )
    if decision_type:
        q = q.filter(RecommendationDecision.decision_type == decision_type)
    return q.order_by(RecommendationDecision.triggered_at.desc()).limit(limit).all()


@router.get("/{decision_id}", response_model=DecisionDetail)
def get_decision(
    investor_id: uuid.UUID,
    decision_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    row = db.query(RecommendationDecision).filter(
        RecommendationDecision.id == decision_id,
        RecommendationDecision.investor_id == investor_id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Decision not found")
    return row


class ReplayResult(BaseModel):
    original_decision_id: uuid.UUID
    original_triggered_at: datetime
    replayed_at: datetime
    decision_type: str
    original_output_summary: dict[str, Any] | None
    replayed_output_summary: dict[str, Any] | None
    input_tokens: int | None
    output_tokens: int | None
    diff_note: str


@router.post("/{decision_id}/replay", response_model=ReplayResult)
def replay_decision(
    investor_id: uuid.UUID,
    decision_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """
    Re-run the recommendation engine using the frozen inputs captured at the original
    decision time. Only ai_recommendation decisions can be replayed.

    Returns both the original output and the replayed output side-by-side.
    The re-run uses live AI but the same frozen market context (risk model, holdings,
    signals) that existed when the original recommendation was generated.
    """
    row = db.query(RecommendationDecision).filter(
        RecommendationDecision.id == decision_id,
        RecommendationDecision.investor_id == investor_id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Decision not found")

    if row.decision_type != "ai_recommendation":
        raise HTTPException(
            status_code=400,
            detail=f"Replay is only supported for ai_recommendation decisions (this is '{row.decision_type}')",
        )

    from app.core.config import settings
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(status_code=503, detail="AI key not configured")

    # Build a frozen context from stored snapshots
    frozen_context: dict[str, Any] = {
        "replay": True,
        "original_decision_id": str(row.id),
        "original_triggered_at": row.triggered_at.isoformat(),
        "risk_model": row.risk_model_snapshot or {},
        "holdings": row.holdings_summary or {},
        "market_signals": row.market_signals_snapshot or [],
        "note": (
            "This is a REPLAY using data frozen at the time of the original recommendation. "
            "Market prices, signals, and portfolio values reflect the state at the original time."
        ),
    }

    # Add original AI output as reference context
    if row.ai_output_summary:
        frozen_context["original_ai_guidance_snapshot"] = row.ai_output_summary[:500]

    from app.investment_recommendations.analyzer import generate_recommendations
    try:
        replayed_raw, in_tok, out_tok = generate_recommendations(
            frozen_context,
            api_key=settings.ANTHROPIC_API_KEY,
            investor_id=str(investor_id),
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI replay failed: {exc}") from exc

    replayed_summary = {
        "overall_guidance": replayed_raw.get("overall_guidance", "")[:300],
        "recommendation_tickers": [r.get("ticker") for r in replayed_raw.get("recommendations", [])[:6]],
        "portfolio_actions": replayed_raw.get("portfolio_actions", [])[:3],
    }

    # Record the replay decision for full auditability
    from app.provenance.recorder import record_decision
    record_decision(
        db,
        investor_id=investor_id,
        decision_type="ai_recommendation_replay",
        risk_model_snapshot=row.risk_model_snapshot,
        holdings_summary=row.holdings_summary,
        market_signals_snapshot=row.market_signals_snapshot,
        model_used="claude-sonnet-4-6",
        ai_output_summary=replayed_raw.get("overall_guidance", "")[:1000],
        input_tokens=in_tok,
        output_tokens=out_tok,
        output_summary=replayed_summary,
        recommendation_count=len(replayed_raw.get("recommendations", [])),
    )
    db.commit()

    original_count = row.recommendation_count or 0
    replayed_count = len(replayed_raw.get("recommendations", []))
    diff_note = (
        f"Original produced {original_count} recommendation(s); replay produced {replayed_count}. "
        "Differences reflect AI non-determinism applied to the same frozen market context."
    )

    return ReplayResult(
        original_decision_id=row.id,
        original_triggered_at=row.triggered_at,
        replayed_at=datetime.now(timezone.utc),
        decision_type=row.decision_type,
        original_output_summary=row.output_summary,
        replayed_output_summary=replayed_summary,
        input_tokens=in_tok,
        output_tokens=out_tok,
        diff_note=diff_note,
    )

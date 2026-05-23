"""
Provenance recorder — writes a RecommendationDecision row after each AI or
deterministic recommendation event so every output is fully traceable.

Call record_decision() fire-and-forget style; it never raises — failures are
logged but never propagate back to the caller.
"""
import hashlib
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

log = logging.getLogger(__name__)

PROMPT_VERSION = "v1"


def record_decision(
    db: Session,
    *,
    investor_id: uuid.UUID,
    decision_type: str,
    portfolio_snapshot_id: uuid.UUID | None = None,
    risk_model_snapshot: dict | None = None,
    holdings_summary: dict | None = None,
    fx_rate_snapshot: dict | None = None,
    price_snapshot: dict | None = None,
    market_signals_snapshot: list | None = None,
    rule_results: dict | None = None,
    model_used: str | None = None,
    ai_input_summary: str | None = None,
    ai_output_summary: str | None = None,
    input_tokens: int | None = None,
    output_tokens: int | None = None,
    output_summary: dict | None = None,
    recommendation_count: int | None = None,
) -> uuid.UUID | None:
    """
    Write one row to recommendation_decisions. Returns the new record ID,
    or None if writing fails (the caller should not care).
    """
    try:
        from app.models.recommendation_decision import RecommendationDecision

        # Deterministic hash: investor + type + risk model version + timestamp truncated to minute
        hash_basis = json.dumps({
            "investor_id": str(investor_id),
            "decision_type": decision_type,
            "risk_version": (risk_model_snapshot or {}).get("id"),
            "minute": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M"),
        }, sort_keys=True)
        decision_hash = hashlib.sha256(hash_basis.encode()).hexdigest()[:16]

        record = RecommendationDecision(
            investor_id=investor_id,
            decision_type=decision_type,
            triggered_at=datetime.now(timezone.utc),
            portfolio_snapshot_id=portfolio_snapshot_id,
            risk_model_snapshot=risk_model_snapshot,
            holdings_summary=holdings_summary,
            fx_rate_snapshot=fx_rate_snapshot,
            price_snapshot=price_snapshot,
            market_signals_snapshot=market_signals_snapshot,
            rule_results=rule_results,
            model_used=model_used,
            prompt_version=PROMPT_VERSION,
            ai_input_summary=ai_input_summary[:1000] if ai_input_summary else None,
            ai_output_summary=ai_output_summary[:1000] if ai_output_summary else None,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            output_summary=output_summary,
            recommendation_count=recommendation_count,
            decision_hash=decision_hash,
        )
        db.add(record)
        db.flush()
        return record.id
    except Exception:
        log.warning("provenance: failed to record decision", exc_info=True)
        return None


def snapshot_risk_model(risk_model: Any) -> dict | None:
    if risk_model is None:
        return None
    return {
        "id": str(risk_model.id),
        "low_risk_pct": getattr(risk_model, "low_risk_pct", None),
        "growth_pct": getattr(risk_model, "growth_pct", None),
        "high_risk_pct": getattr(risk_model, "high_risk_pct", None),
        "live_trading_allowed": getattr(risk_model, "live_trading_allowed", None),
    }


def snapshot_holdings(portfolio_summary: Any) -> dict | None:
    if portfolio_summary is None:
        return None
    try:
        return {
            "total_value": getattr(portfolio_summary, "total_value", None),
            "currency": getattr(portfolio_summary, "currency", None),
            "asset_allocation": getattr(portfolio_summary, "asset_allocation", None),
        }
    except Exception:
        return None


def snapshot_signals(live_signals: list) -> list | None:
    if not live_signals:
        return None
    try:
        return [
            {
                "ticker": getattr(s, "ticker", None),
                "signal_type": getattr(s, "signal_type", None),
                "current_price": getattr(s, "current_price", None),
            }
            for s in live_signals[:10]
        ]
    except Exception:
        return None

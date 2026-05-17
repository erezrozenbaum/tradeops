"""Utility for logging Claude API usage, computing cost, and budget enforcement."""
import uuid
import logging
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.session import get_db

log = logging.getLogger(__name__)

# Cost per token in USD (standard public pricing)
_COST_PER_INPUT_TOKEN: dict[str, float] = {
    "claude-haiku-4-5-20251001": 0.80 / 1_000_000,
    "claude-haiku-4-5": 0.80 / 1_000_000,
    "claude-sonnet-4-6": 3.00 / 1_000_000,
    "claude-sonnet-4-5": 3.00 / 1_000_000,
    "claude-opus-4-7": 15.00 / 1_000_000,
}
_COST_PER_OUTPUT_TOKEN: dict[str, float] = {
    "claude-haiku-4-5-20251001": 4.00 / 1_000_000,
    "claude-haiku-4-5": 4.00 / 1_000_000,
    "claude-sonnet-4-6": 15.00 / 1_000_000,
    "claude-sonnet-4-5": 15.00 / 1_000_000,
    "claude-opus-4-7": 75.00 / 1_000_000,
}
_FALLBACK_INPUT = 3.00 / 1_000_000
_FALLBACK_OUTPUT = 15.00 / 1_000_000


def compute_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    in_rate = _COST_PER_INPUT_TOKEN.get(model, _FALLBACK_INPUT)
    out_rate = _COST_PER_OUTPUT_TOKEN.get(model, _FALLBACK_OUTPUT)
    return round(in_rate * input_tokens + out_rate * output_tokens, 8)


def check_monthly_budget(db: Session, investor_id: uuid.UUID | None) -> None:
    """Raises HTTP 429 if the investor's rolling 30-day AI spend exceeds the configured limit."""
    from app.core.config import settings
    from app.models.ai_usage_log import AiUsageLog
    limit = settings.AI_MONTHLY_BUDGET_USD
    if limit <= 0:
        return
    since = datetime.now(timezone.utc) - timedelta(days=30)
    total = (
        db.query(func.sum(AiUsageLog.cost_usd))
        .filter(AiUsageLog.investor_id == investor_id, AiUsageLog.called_at >= since)
        .scalar()
    ) or 0.0
    if total >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Monthly AI usage limit reached (${total:.2f} / ${limit:.2f} USD). "
                "Contact an admin to increase your limit."
            ),
        )


def require_ai_budget(
    investor_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> None:
    """FastAPI dependency — blocks the request if the investor's AI budget is exhausted."""
    check_monthly_budget(db, investor_id)


def log_ai_call(
    db: Session,
    feature_name: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    user_id: uuid.UUID | None = None,
    investor_id: uuid.UUID | None = None,
) -> None:
    from app.models.ai_usage_log import AiUsageLog
    try:
        cost = compute_cost(model, input_tokens, output_tokens)
        entry = AiUsageLog(
            id=uuid.uuid4(),
            user_id=user_id,
            investor_id=investor_id,
            feature_name=feature_name,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost,
        )
        db.add(entry)
        # Caller is responsible for commit
    except Exception as exc:
        log.warning("[ai_usage] Failed to log usage for %s: %s", feature_name, exc)

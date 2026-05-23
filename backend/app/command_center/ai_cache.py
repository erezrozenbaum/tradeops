"""Redis cache for pre-computed Command Center AI summaries.

Key: cc_ai:{investor_id}:{verbosity}
TTL: 26 hours — always fresh by next evening pre-compute run.
Falls back to no-op when Redis is unavailable.
"""
from __future__ import annotations

import logging
import uuid

log = logging.getLogger(__name__)

_TTL = 26 * 3600
_PREFIX = "cc_ai"


def _redis():
    from app.core.config import settings
    if not settings.REDIS_URL:
        return None
    try:
        import redis
        r = redis.from_url(settings.REDIS_URL, decode_responses=True, socket_connect_timeout=1)
        r.ping()
        return r
    except Exception as exc:
        log.debug("[cc_ai_cache] Redis unavailable: %s", exc)
        return None


def get_cached(investor_id: uuid.UUID, verbosity: str) -> str | None:
    r = _redis()
    if not r:
        return None
    try:
        return r.get(f"{_PREFIX}:{investor_id}:{verbosity}") or None
    except Exception:
        return None


def set_cached(investor_id: uuid.UUID, verbosity: str, summary: str) -> None:
    r = _redis()
    if not r:
        return
    try:
        r.setex(f"{_PREFIX}:{investor_id}:{verbosity}", _TTL, summary)
    except Exception as exc:
        log.debug("[cc_ai_cache] write failed: %s", exc)


def invalidate(investor_id: uuid.UUID) -> None:
    """Remove all verbosity variants for an investor (e.g. after data refresh)."""
    r = _redis()
    if not r:
        return
    try:
        for v in ("beginner", "standard", "advanced"):
            r.delete(f"{_PREFIX}:{investor_id}:{v}")
    except Exception:
        pass

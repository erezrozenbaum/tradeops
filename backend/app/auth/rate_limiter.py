"""Sliding-window rate limiter for login attempts.

Uses Redis sorted sets when REDIS_URL is configured (distributed, survives
restarts, works across multiple workers/instances). Falls back to in-memory
state when Redis is unavailable or unconfigured — safe for single-process dev.

Key schema: ratelimit:{client_key}
  ZADD score=epoch_ms  member="{epoch_ms}-{random}"
  ZREMRANGEBYSCORE 0 (now - window_ms)   — prune stale entries
  ZCARD                                  — count recent attempts
  EXPIRE window_seconds * 2              — auto-cleanup idle keys
"""
import os
import threading
import time
import uuid
from collections import defaultdict

_WINDOW_SECONDS: int = 300   # 5-minute sliding window
_MAX_ATTEMPTS: int = 5

# ── In-memory fallback ────────────────────────────────────────────────────────

_lock = threading.Lock()
_attempts: dict[str, list[float]] = defaultdict(list)


def _in_memory_is_rate_limited(key: str) -> bool:
    now = time.time()
    cutoff = now - _WINDOW_SECONDS
    with _lock:
        _attempts[key] = [t for t in _attempts[key] if t > cutoff]
        if len(_attempts[key]) >= _MAX_ATTEMPTS:
            return True
        _attempts[key].append(now)
        return False


# ── Redis client (lazy init) ──────────────────────────────────────────────────

_redis_client = None
_redis_checked = False
_redis_lock = threading.Lock()


def _get_redis():
    global _redis_client, _redis_checked
    if _redis_checked:
        return _redis_client
    with _redis_lock:
        if _redis_checked:
            return _redis_client
        _redis_checked = True
        redis_url = os.environ.get("REDIS_URL", "")
        if not redis_url:
            # Also try settings to handle pydantic-settings loading order
            try:
                from app.core.config import settings
                redis_url = settings.REDIS_URL
            except Exception:
                pass
        if not redis_url:
            return None
        try:
            import redis as redis_lib
            client = redis_lib.from_url(redis_url, socket_connect_timeout=2, socket_timeout=2)
            client.ping()
            import logging
            logging.getLogger(__name__).info("[rate_limiter] Using Redis at %s", redis_url)
            _redis_client = client
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning(
                "[rate_limiter] Redis unavailable (%s) — falling back to in-memory", exc
            )
            _redis_client = None
        return _redis_client


def _redis_is_rate_limited(r, key: str) -> bool:
    """Sorted-set sliding window. Returns True if key is over the limit."""
    rkey = f"ratelimit:{key}"
    now_ms = int(time.time() * 1000)
    cutoff_ms = now_ms - (_WINDOW_SECONDS * 1000)
    member = f"{now_ms}-{uuid.uuid4().hex[:8]}"

    pipe = r.pipeline()
    pipe.zremrangebyscore(rkey, 0, cutoff_ms)
    pipe.zcard(rkey)
    pipe.zadd(rkey, {member: now_ms})
    pipe.expire(rkey, _WINDOW_SECONDS * 2)
    _, count, *_ = pipe.execute()

    return count >= _MAX_ATTEMPTS


# ── Public interface ──────────────────────────────────────────────────────────

def is_rate_limited(key: str) -> bool:
    """Record an attempt for `key`. Returns True if the key is now blocked."""
    r = _get_redis()
    if r is not None:
        try:
            return _redis_is_rate_limited(r, key)
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning(
                "[rate_limiter] Redis error, falling back to in-memory: %s", exc
            )
    return _in_memory_is_rate_limited(key)

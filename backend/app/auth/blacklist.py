"""JWT JTI blacklist — Redis primary, in-memory fallback per process.

Redis is the authoritative store; in-memory is used only when Redis is
unavailable. With multiple workers or pods, a revoked JTI may still
pass validation in other processes during a Redis outage — this is the
accepted degraded-mode behaviour.
"""
import logging
import time

log = logging.getLogger(__name__)

# {jti: expires_at_unix_float} — used only when Redis is unreachable
_memory: dict[str, float] = {}

_REDIS_KEY_PREFIX = "jwt_bl:"


def _get_redis():
    from app.core.config import settings
    if not settings.REDIS_URL:
        return None
    try:
        import redis
        client = redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=1,
        )
        client.ping()
        return client
    except Exception as exc:
        log.warning("[blacklist] Redis unavailable: %s", exc)
        return None


def blacklist_token(jti: str, ttl_seconds: int) -> None:
    """Revoke a JTI for ttl_seconds."""
    r = _get_redis()
    if r:
        try:
            r.setex(f"{_REDIS_KEY_PREFIX}{jti}", ttl_seconds, "1")
            return
        except Exception as exc:
            log.warning("[blacklist] Redis write failed, falling back to memory: %s", exc)

    # In-memory fallback
    _memory[jti] = time.time() + ttl_seconds
    _prune_memory()


def is_blacklisted(jti: str) -> bool:
    """Return True if the JTI has been revoked."""
    r = _get_redis()
    if r:
        try:
            return bool(r.get(f"{_REDIS_KEY_PREFIX}{jti}"))
        except Exception as exc:
            log.warning("[blacklist] Redis read failed, falling back to memory: %s", exc)

    # In-memory fallback
    entry = _memory.get(jti)
    if entry is None:
        return False
    if time.time() > entry:
        _memory.pop(jti, None)
        return False
    return True


def _prune_memory() -> None:
    now = time.time()
    expired = [k for k, v in _memory.items() if v < now]
    for k in expired:
        del _memory[k]

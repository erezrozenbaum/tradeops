"""Redis cache helper — thin wrapper with graceful degradation.

All public functions are safe to call even when Redis is unavailable:
they silently return None / do nothing rather than raising.

Keys:
  di:{investor_id}            Decision Intelligence report (TTL 900s)
  ba:{investor_id}            Behavioral Alpha report (TTL 900s)
  cal:{investor_id}           Outcome Calibration report (TTL 900s)
  rr:{investor_id}:{month}    Reflection Report for YYYY-MM (TTL 1800s)

Invalidation is investor-scoped: mutating any staged order deletes all
four key families for that investor.
"""
import json
import logging
import os
from typing import Any

log = logging.getLogger(__name__)

_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client
    url = os.getenv("REDIS_URL")
    if not url:
        return None
    try:
        import redis
        c = redis.from_url(url, decode_responses=True, socket_connect_timeout=2)
        c.ping()
        _client = c
        return _client
    except Exception as exc:
        log.debug("[cache] Redis unavailable: %s", exc)
        return None


def get(key: str) -> Any | None:
    client = _get_client()
    if client is None:
        return None
    try:
        raw = client.get(key)
        return json.loads(raw) if raw else None
    except Exception as exc:
        log.debug("[cache] get(%s) failed: %s", key, exc)
        return None


def set(key: str, value: Any, ttl: int = 900) -> None:
    client = _get_client()
    if client is None:
        return
    try:
        client.setex(key, ttl, json.dumps(value, default=str))
    except Exception as exc:
        log.debug("[cache] set(%s) failed: %s", key, exc)


def delete(*keys: str) -> None:
    client = _get_client()
    if client is None:
        return
    if not keys:
        return
    try:
        client.delete(*keys)
    except Exception as exc:
        log.debug("[cache] delete failed: %s", exc)


def invalidate_investor(investor_id: str) -> None:
    """Delete all cached keys for a given investor (called on any order mutation)."""
    client = _get_client()
    if client is None:
        return
    try:
        to_delete = [
            f"di:{investor_id}",
            f"ba:{investor_id}",
            f"cal:{investor_id}",
        ]
        # Reflection report keys have a month suffix — use scan_iter (non-blocking)
        for rr_key in client.scan_iter(f"rr:{investor_id}:*"):
            to_delete.append(rr_key)
        if to_delete:
            client.delete(*to_delete)
    except Exception as exc:
        log.debug("[cache] invalidate_investor(%s) failed: %s", investor_id, exc)

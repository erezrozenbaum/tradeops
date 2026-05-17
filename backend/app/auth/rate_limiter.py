"""Simple in-memory sliding-window rate limiter for login attempts.

Keyed by client IP. Thread-safe for single-process deployments (uvicorn
without multiple workers). Shared state is not persisted across restarts.
"""
import threading
import time
from collections import defaultdict

_lock = threading.Lock()
_attempts: dict[str, list[float]] = defaultdict(list)

_WINDOW_SECONDS: int = 300  # sliding 5-minute window
_MAX_ATTEMPTS: int = 5      # max attempts before block


def is_rate_limited(key: str) -> bool:
    """Record an attempt for `key`. Returns True if the key is now blocked."""
    now = time.time()
    cutoff = now - _WINDOW_SECONDS
    with _lock:
        _attempts[key] = [t for t in _attempts[key] if t > cutoff]
        if len(_attempts[key]) >= _MAX_ATTEMPTS:
            return True
        _attempts[key].append(now)
        return False

"""In-memory conversation history — last 5 turns per investor.

This is intentionally ephemeral (resets on restart). A DB-backed history
can be added later if persistence is required.
"""
from __future__ import annotations
import uuid
from collections import defaultdict

_MAX_TURNS = 5

# {investor_id: [{"role": "user"|"assistant", "content": str}, ...]}
_store: dict[uuid.UUID, list[dict]] = defaultdict(list)


def get_history(investor_id: uuid.UUID) -> list[dict]:
    return list(_store[investor_id])


def append(investor_id: uuid.UUID, role: str, content: str) -> None:
    history = _store[investor_id]
    history.append({"role": role, "content": content})
    if len(history) > _MAX_TURNS * 2:
        _store[investor_id] = history[-(  _MAX_TURNS * 2):]


def clear(investor_id: uuid.UUID) -> None:
    _store.pop(investor_id, None)

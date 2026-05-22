"""Langfuse AI observability wrapper.

All AI calls in TradeOps pass through `trace_ai_call()`.
When LANGFUSE_PUBLIC_KEY + LANGFUSE_SECRET_KEY are set, every call is recorded
with its feature name, model, token counts, input/output, and any metadata.
When keys are absent the context manager is a transparent no-op — no imports fail,
no behaviour changes.

Usage:
    from app.core.tracing import trace_ai_call

    with trace_ai_call("ai_report", model="claude-sonnet-4-6", input_data=ctx) as span:
        result = client.messages.create(...)
        span.set_output(result.content[0].text)
        span.set_tokens(result.usage.input_tokens, result.usage.output_tokens)
"""
from __future__ import annotations

import logging
from contextlib import contextmanager
from typing import Any, Generator

log = logging.getLogger(__name__)

_langfuse_client = None
_langfuse_tried = False


def _get_client():
    global _langfuse_client, _langfuse_tried
    if _langfuse_tried:
        return _langfuse_client
    _langfuse_tried = True
    try:
        from app.core.config import settings
        if not settings.langfuse_enabled:
            return None
        from langfuse import Langfuse
        _langfuse_client = Langfuse(
            public_key=settings.LANGFUSE_PUBLIC_KEY,
            secret_key=settings.LANGFUSE_SECRET_KEY,
            host=settings.LANGFUSE_HOST,
        )
        log.info("[tracing] Langfuse client initialised — host=%s", settings.LANGFUSE_HOST)
    except Exception as exc:
        log.warning("[tracing] Langfuse init failed (tracing disabled): %s", exc)
    return _langfuse_client


class _Span:
    """Thin wrapper around a Langfuse generation object (or a no-op when disabled)."""

    def __init__(self, generation=None):
        self._gen = generation

    def set_output(self, text: str) -> None:
        if self._gen:
            try:
                self._gen.update(output=text[:4000])
            except Exception:
                pass

    def set_tokens(self, input_tokens: int, output_tokens: int) -> None:
        if self._gen:
            try:
                self._gen.update(usage={"input": input_tokens, "output": output_tokens})
            except Exception:
                pass

    def set_error(self, exc: Exception) -> None:
        if self._gen:
            try:
                self._gen.update(level="ERROR", status_message=str(exc)[:500])
            except Exception:
                pass

    def end(self) -> None:
        if self._gen:
            try:
                self._gen.end()
            except Exception:
                pass


@contextmanager
def trace_ai_call(
    feature: str,
    *,
    model: str,
    input_data: Any = None,
    metadata: dict | None = None,
    investor_id: str | None = None,
) -> Generator[_Span, None, None]:
    """Context manager that opens a Langfuse generation span for one AI call.

    Args:
        feature: logical feature name, e.g. "ai_report", "market_research", "coach"
        model: model ID string
        input_data: serialisable context dict (truncated before sending)
        metadata: extra key/value pairs to record
        investor_id: used as Langfuse user_id for per-user filtering
    """
    client = _get_client()
    generation = None
    if client:
        try:
            import json
            raw_input = json.dumps(input_data, default=str)[:6000] if input_data else None
            trace = client.trace(name=feature, user_id=investor_id, metadata=metadata or {})
            generation = trace.generation(
                name=feature,
                model=model,
                input=raw_input,
                metadata=metadata or {},
            )
        except Exception as exc:
            log.debug("[tracing] Failed to start trace for %s: %s", feature, exc)
            generation = None

    span = _Span(generation)
    try:
        yield span
    except Exception as exc:
        span.set_error(exc)
        raise
    finally:
        span.end()
        if client:
            try:
                client.flush()
            except Exception:
                pass

"""OpenTelemetry + Prometheus instrumentation.

Wired into the FastAPI lifespan in main.py.

What this enables:
- FastAPI request traces (latency, status codes, endpoint breakdown)
- SQLAlchemy query traces (slow query detection)
- Prometheus /metrics endpoint (scrape-able by the Prometheus container)
- Optional OTLP gRPC export when OTEL_EXPORTER_OTLP_ENDPOINT is set

All instrumentation is opt-in via environment variables.
If dependencies are not installed the module degrades gracefully.
"""
from __future__ import annotations

import logging

log = logging.getLogger(__name__)


def setup_telemetry(app) -> None:
    """Instrument the FastAPI app. Call once during lifespan startup."""
    from app.core.config import settings
    _setup_prometheus(app)
    if settings.otel_enabled:
        _setup_otel(app, settings.OTEL_EXPORTER_OTLP_ENDPOINT)


def _setup_prometheus(app) -> None:
    try:
        from prometheus_fastapi_instrumentator import Instrumentator
        Instrumentator(
            should_group_status_codes=False,
            should_ignore_untemplated=True,
            should_respect_env_var=False,
            should_instrument_requests_inprogress=True,
            excluded_handlers=["/health", "/metrics"],
        ).instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)
        log.info("[telemetry] Prometheus /metrics endpoint registered")
    except ImportError:
        log.warning("[telemetry] prometheus_fastapi_instrumentator not installed — metrics disabled")
    except Exception as exc:
        log.warning("[telemetry] Prometheus setup failed: %s", exc)


def _setup_otel(app, endpoint: str) -> None:
    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor

        resource = Resource.create({"service.name": "tradeops-backend"})
        provider = TracerProvider(resource=resource)
        exporter = OTLPSpanExporter(endpoint=endpoint, insecure=True)
        provider.add_span_processor(BatchSpanProcessor(exporter))
        trace.set_tracer_provider(provider)

        FastAPIInstrumentor.instrument_app(app)
        SQLAlchemyInstrumentor().instrument(enable_commenter=True)

        log.info("[telemetry] OpenTelemetry OTLP export configured → %s", endpoint)
    except ImportError:
        log.warning("[telemetry] OpenTelemetry packages not installed — trace export disabled")
    except Exception as exc:
        log.warning("[telemetry] OpenTelemetry setup failed: %s", exc)

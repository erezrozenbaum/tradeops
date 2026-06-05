"""Pattern detection — identifies named behavioral anti-patterns from order history.

All detectors are pure functions: stateless, database-free, testable in isolation.
The caller fetches orders and passes them; this module only analyses.
"""
from __future__ import annotations

import statistics
from typing import TYPE_CHECKING

from pydantic import BaseModel

if TYPE_CHECKING:
    from app.models.staged_order import StagedOrder

_SEVERITY_RANK: dict[str, int] = {"high": 0, "medium": 1, "low": 2}


class DetectedPattern(BaseModel):
    key: str
    name: str
    severity: str  # "high" | "medium" | "low"
    description: str
    implication: str
    metric: str | None


# ── Internal helpers ──────────────────────────────────────────────────────────


def _executed(orders: list[StagedOrder]) -> list[StagedOrder]:
    return [o for o in orders if o.status == "executed"]


def _is_documented(o: StagedOrder) -> bool:
    return bool(o.rationale and o.rationale.strip())


def _kappa(o: StagedOrder) -> float | None:
    behavioral = (o.pre_flight_review or {}).get("behavioral") or {}
    v = behavioral.get("kappa_score")
    return float(v) if v is not None else None


def _is_override(o: StagedOrder) -> bool:
    return (o.pre_flight_review or {}).get("verdict") == "reconsider"


# ── Detectors ─────────────────────────────────────────────────────────────────


def _detect_blind_override(orders: list[StagedOrder]) -> DetectedPattern | None:
    overrides = [o for o in _executed(orders) if _is_override(o)]
    if len(overrides) < 2:
        return None
    blind = [o for o in overrides if not _is_documented(o)]
    rate = len(blind) / len(overrides)
    if rate < 0.5:
        return None
    return DetectedPattern(
        key="blind_override_habit",
        name="Blind Override Habit",
        severity="high",
        description=(
            f"{len(blind)} of your {len(overrides)} risk overrides were executed "
            "with no written rationale — the behavioural system issued a warning "
            "and you proceeded without documenting why."
        ),
        implication=(
            "Overriding pre-flight warnings can be correct, but without a documented "
            "thesis there is no feedback loop. You cannot distinguish good judgment "
            "from impulsive risk-taking after the fact."
        ),
        metric=f"{rate * 100:.0f}% of overrides undocumented",
    )


def _detect_confidence_collapse(orders: list[StagedOrder]) -> DetectedPattern | None:
    executed = sorted(_executed(orders), key=lambda o: o.created_at)
    kappa_pairs = [(o, _kappa(o)) for o in executed if _kappa(o) is not None]
    if len(kappa_pairs) < 5:
        return None
    last5 = kappa_pairs[-5:]
    low = [k for _, k in last5 if k < 0.65]
    if len(low) < 5:
        return None
    avg_k = statistics.mean(k for _, k in last5)
    return DetectedPattern(
        key="confidence_collapse",
        name="Confidence Collapse",
        severity="high",
        description=(
            f"Your last 5 consecutive executed orders all scored below κ=0.65 "
            f"(avg κ={avg_k:.2f}), indicating a sustained period of low "
            "behavioral confidence at the time of execution."
        ),
        implication=(
            "Sustained low κ often reflects reactive or emotionally-driven trading. "
            "Review your last 5 decisions: were they thesis-driven or market-reactive?"
        ),
        metric=f"avg κ={avg_k:.2f} — last 5 orders",
    )


def _detect_override_acceleration(orders: list[StagedOrder]) -> DetectedPattern | None:
    executed = sorted(_executed(orders), key=lambda o: o.created_at)
    if len(executed) < 6:
        return None
    split = len(executed) * 2 // 3
    older = executed[:split]
    recent = executed[split:]
    if len(recent) < 2:
        return None
    old_rate = sum(1 for o in older if _is_override(o)) / len(older)
    new_rate = sum(1 for o in recent if _is_override(o)) / len(recent)
    if new_rate <= old_rate + 0.10 or new_rate < 0.15:
        return None
    return DetectedPattern(
        key="override_acceleration",
        name="Override Acceleration",
        severity="medium",
        description=(
            f"Your recent override rate ({new_rate * 100:.0f}%) is meaningfully "
            f"higher than your earlier rate ({old_rate * 100:.0f}%), based on "
            "the temporal split of your order history in this period."
        ),
        implication=(
            "Rising override frequency may indicate growing overconfidence, "
            "market stress response, or eroding pre-flight discipline. "
            "Review whether your recent overrides were justified by outcome."
        ),
        metric=f"{old_rate * 100:.0f}% → {new_rate * 100:.0f}% override rate",
    )


def _detect_documentation_decay(orders: list[StagedOrder]) -> DetectedPattern | None:
    executed = sorted(_executed(orders), key=lambda o: o.created_at)
    if len(executed) < 6:
        return None
    split = len(executed) // 2
    older = executed[:split]
    recent = executed[split:]
    old_rate = sum(1 for o in older if _is_documented(o)) / len(older)
    new_rate = sum(1 for o in recent if _is_documented(o)) / len(recent)
    drop = old_rate - new_rate
    if drop < 0.15:
        return None
    return DetectedPattern(
        key="documentation_decay",
        name="Documentation Decay",
        severity="medium",
        description=(
            f"Your recent documentation rate ({new_rate * 100:.0f}%) has fallen "
            f"from {old_rate * 100:.0f}% in your earlier orders — "
            f"a {drop * 100:.0f}pp decline."
        ),
        implication=(
            "Documentation quality typically declines during high-activity or "
            "high-emotion periods. This erodes your outcome correlation signal "
            "and reduces the system's ability to give you accurate feedback."
        ),
        metric=f"{old_rate * 100:.0f}% → {new_rate * 100:.0f}% doc rate",
    )


def _detect_thesis_absent(orders: list[StagedOrder]) -> DetectedPattern | None:
    executed = _executed(orders)
    if len(executed) < 5:
        return None
    undoc = [o for o in executed if not _is_documented(o)]
    rate = len(undoc) / len(executed)
    if rate < 0.4:
        return None
    return DetectedPattern(
        key="thesis_absent_execution",
        name="Thesis-Absent Execution",
        severity="low",
        description=(
            f"{len(undoc)} of your {len(executed)} executed orders "
            f"({rate * 100:.0f}%) have no written rationale."
        ),
        implication=(
            "Without a thesis you cannot learn from outcomes. Undocumented trades "
            "are the primary driver of capital leakage and the main gap in "
            "your Decision Quality Score."
        ),
        metric=f"{rate * 100:.0f}% undocumented",
    )


# ── Public API ────────────────────────────────────────────────────────────────


def detect_patterns(orders: list[StagedOrder]) -> list[DetectedPattern]:
    """Return all firing behavioral patterns for the given order set.

    Patterns are ordered by severity (high → medium → low).
    Returns an empty list if the data is insufficient for any pattern.
    """
    detectors = [
        _detect_blind_override,
        _detect_confidence_collapse,
        _detect_override_acceleration,
        _detect_documentation_decay,
        _detect_thesis_absent,
    ]
    results = [p for d in detectors if (p := d(orders)) is not None]
    return sorted(results, key=lambda p: _SEVERITY_RANK.get(p.severity, 9))

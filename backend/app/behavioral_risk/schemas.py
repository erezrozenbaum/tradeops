import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel

EVENT_TYPE_LABELS: dict[str, str] = {
    "panic_selling": "Panic Selling",
    "performance_chasing": "Performance Chasing",
    "revenge_trading": "Revenge Trading",
    "overtrading_spike": "Overtrading Spike",
    "concentration_addiction": "Concentration Risk",
    "risk_creep": "Risk Creep",
    "strategy_abandonment": "Strategy Abandonment",
}

SEVERITY_ORDER: dict[str, int] = {
    "critical": 0,
    "high": 1,
    "medium": 2,
    "low": 3,
}


class BehavioralRiskEventResponse(BaseModel):
    id: uuid.UUID
    investor_id: uuid.UUID
    event_type: str
    event_label: str
    severity: str
    status: str
    detected_at: datetime
    resolved_at: Optional[datetime]
    description: str
    evidence: dict[str, Any]
    recommendation: str
    decision_id: Optional[uuid.UUID]

    @classmethod
    def from_orm_row(cls, row: Any) -> "BehavioralRiskEventResponse":
        return cls(
            id=row.id,
            investor_id=row.investor_id,
            event_type=row.event_type,
            event_label=EVENT_TYPE_LABELS.get(row.event_type, row.event_type),
            severity=row.severity,
            status=row.status,
            detected_at=row.detected_at,
            resolved_at=row.resolved_at,
            description=row.description,
            evidence=row.evidence or {},
            recommendation=row.recommendation,
            decision_id=row.decision_id,
        )

    class Config:
        from_attributes = True


class BehavioralRiskListResponse(BaseModel):
    investor_id: uuid.UUID
    events: list[BehavioralRiskEventResponse]
    active_count: int
    resolved_count: int
    generated_at: datetime

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.command_center.schemas import CommandCenterReport


class AdvisorShareOut(BaseModel):
    token: str
    created_at: datetime
    expires_at: datetime

    model_config = {"from_attributes": True}


class AdvisorShareListOut(BaseModel):
    tokens: list[AdvisorShareOut]


class AdvisorShareSnapshot(BaseModel):
    investor_name: str
    report: CommandCenterReport
    expires_at: datetime

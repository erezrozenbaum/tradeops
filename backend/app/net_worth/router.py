import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.net_worth import service

router = APIRouter()


class AssetBreakdownOut(BaseModel):
    asset_type: str
    name: str
    value: float
    currency: str


class LiabilityBreakdownOut(BaseModel):
    liability_type: str
    name: str
    balance: float
    monthly_payment: float
    interest_rate_pct: float | None
    currency: str


class NetWorthSummaryOut(BaseModel):
    portfolio_value: float
    financial_assets_value: float
    total_liabilities: float
    net_worth: float
    currency: str
    assets_breakdown: list[AssetBreakdownOut]
    liabilities_breakdown: list[LiabilityBreakdownOut]
    fi_projection: dict | None


class NetWorthHistoryPointOut(BaseModel):
    snapshot_at: datetime
    net_worth: float
    portfolio_value: float
    financial_assets_value: float
    total_liabilities: float


@router.get("", response_model=NetWorthSummaryOut)
def get_net_worth(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    summary = service.get_summary(db, investor_id)
    return NetWorthSummaryOut(
        portfolio_value=summary.portfolio_value,
        financial_assets_value=summary.financial_assets_value,
        total_liabilities=summary.total_liabilities,
        net_worth=summary.net_worth,
        currency=summary.currency,
        assets_breakdown=[AssetBreakdownOut(**vars(a)) for a in summary.assets_breakdown],
        liabilities_breakdown=[LiabilityBreakdownOut(**vars(li)) for li in summary.liabilities_breakdown],
        fi_projection=summary.fi_projection,
    )


@router.get("/history", response_model=list[NetWorthHistoryPointOut])
def get_history(investor_id: uuid.UUID, months: int = 12, db: Session = Depends(get_db)):
    points = service.get_history(db, investor_id, months=months)
    return [NetWorthHistoryPointOut(**vars(p)) for p in points]

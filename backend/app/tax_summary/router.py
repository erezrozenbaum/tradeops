import uuid
from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.tax_summary import service

router = APIRouter()


class RealizedGainRowOut(BaseModel):
    ticker: str
    asset_name: str
    sell_date: date
    proceeds: float
    cost_basis: float
    gain: float
    holding_days: int
    is_long_term: bool
    currency: str


class DividendRowOut(BaseModel):
    ticker: str
    asset_name: str
    pay_date: date
    amount: float
    currency: str


class TaxYearSummaryOut(BaseModel):
    year: int
    total_gains: float
    total_losses: float
    net_realized: float
    total_dividends: float
    estimated_tax: float
    realized_rows: list[RealizedGainRowOut]
    dividend_rows: list[DividendRowOut]


class TaxSummaryOut(BaseModel):
    available_years: list[int]
    selected_year: int | None
    summary: TaxYearSummaryOut | None


@router.get("", response_model=TaxSummaryOut)
def get_tax_summary(investor_id: uuid.UUID, year: int | None = None, db: Session = Depends(get_db)):
    result = service.get_summary(db, investor_id, year=year)

    summary_out = None
    if result.summary:
        s = result.summary
        summary_out = TaxYearSummaryOut(
            year=s.year,
            total_gains=s.total_gains,
            total_losses=s.total_losses,
            net_realized=s.net_realized,
            total_dividends=s.total_dividends,
            estimated_tax=s.estimated_tax,
            realized_rows=[RealizedGainRowOut(**vars(r)) for r in s.realized_rows],
            dividend_rows=[DividendRowOut(**vars(d)) for d in s.dividend_rows],
        )

    return TaxSummaryOut(
        available_years=result.available_years,
        selected_year=result.selected_year,
        summary=summary_out,
    )

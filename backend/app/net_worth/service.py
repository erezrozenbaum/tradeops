"""Net Worth service.

Aggregates:
  - portfolio_value  : from latest PortfolioSnapshot (or computed live)
  - financial_assets : sum of FinancialAsset.current_value (manual entries)
  - liabilities      : sum of FinancialLiability.outstanding_balance
  - net_worth        : portfolio_value + financial_assets - liabilities

Currency: uses investor's financial profile currency; portfolio value assumed
already normalised to same base currency by portfolio_analysis.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy.orm import Session


@dataclass
class AssetBreakdown:
    asset_type: str
    name: str
    value: float
    currency: str


@dataclass
class LiabilityBreakdown:
    liability_type: str
    name: str
    balance: float
    monthly_payment: float
    interest_rate_pct: float | None
    currency: str


@dataclass
class NetWorthSummary:
    portfolio_value: float
    financial_assets_value: float
    total_liabilities: float
    net_worth: float
    currency: str
    assets_breakdown: list[AssetBreakdown] = field(default_factory=list)
    liabilities_breakdown: list[LiabilityBreakdown] = field(default_factory=list)
    fi_projection: dict | None = None  # financial independence projection


@dataclass
class NetWorthHistoryPoint:
    snapshot_at: datetime
    net_worth: float
    portfolio_value: float
    financial_assets_value: float
    total_liabilities: float


def get_summary(db: Session, investor_id: uuid.UUID) -> NetWorthSummary:
    from app.models.financial_profile import FinancialProfile
    from app.models.portfolio_snapshot import PortfolioSnapshot

    fp = db.query(FinancialProfile).filter(
        FinancialProfile.investor_profile_id == investor_id
    ).first()

    currency = fp.currency if fp else "USD"

    # Portfolio value from latest snapshot
    snap = (
        db.query(PortfolioSnapshot)
        .filter(PortfolioSnapshot.investor_id == investor_id)
        .order_by(PortfolioSnapshot.snapshot_at.desc())
        .first()
    )
    portfolio_value = snap.total_value if snap else 0.0

    # Financial assets and liabilities
    assets_breakdown: list[AssetBreakdown] = []
    liabilities_breakdown: list[LiabilityBreakdown] = []
    financial_assets_total = 0.0
    liabilities_total = 0.0

    if fp:
        for a in fp.assets:
            financial_assets_total += a.current_value
            assets_breakdown.append(AssetBreakdown(
                asset_type=a.asset_type.value,
                name=a.name,
                value=a.current_value,
                currency=a.currency,
            ))
        for li in fp.liabilities:
            liabilities_total += li.outstanding_balance
            liabilities_breakdown.append(LiabilityBreakdown(
                liability_type=li.liability_type.value,
                name=li.name,
                balance=li.outstanding_balance,
                monthly_payment=li.monthly_payment,
                interest_rate_pct=li.interest_rate_pct,
                currency=li.currency,
            ))

    net_worth = portfolio_value + financial_assets_total - liabilities_total

    fi_projection = _compute_fi_projection(fp, portfolio_value, financial_assets_total)

    return NetWorthSummary(
        portfolio_value=round(portfolio_value, 2),
        financial_assets_value=round(financial_assets_total, 2),
        total_liabilities=round(liabilities_total, 2),
        net_worth=round(net_worth, 2),
        currency=currency,
        assets_breakdown=assets_breakdown,
        liabilities_breakdown=liabilities_breakdown,
        fi_projection=fi_projection,
    )


def get_history(db: Session, investor_id: uuid.UUID, months: int = 12) -> list[NetWorthHistoryPoint]:
    from app.models.net_worth import NetWorthSnapshot
    from datetime import timedelta

    cutoff = datetime.now(timezone.utc) - timedelta(days=months * 30)
    rows = (
        db.query(NetWorthSnapshot)
        .filter(
            NetWorthSnapshot.investor_id == investor_id,
            NetWorthSnapshot.snapshot_at >= cutoff,
        )
        .order_by(NetWorthSnapshot.snapshot_at.asc())
        .all()
    )
    return [
        NetWorthHistoryPoint(
            snapshot_at=r.snapshot_at,
            net_worth=r.net_worth,
            portfolio_value=r.portfolio_value,
            financial_assets_value=r.financial_assets_value,
            total_liabilities=r.total_liabilities,
        )
        for r in rows
    ]


def save_snapshot(db: Session, investor_id: uuid.UUID) -> None:
    """Write a net worth snapshot for today (idempotent — skips if one exists today)."""
    from app.models.net_worth import NetWorthSnapshot
    from datetime import date

    today = date.today()
    existing = (
        db.query(NetWorthSnapshot)
        .filter(NetWorthSnapshot.investor_id == investor_id)
        .order_by(NetWorthSnapshot.snapshot_at.desc())
        .first()
    )
    if existing and existing.snapshot_at.date() == today:
        return

    summary = get_summary(db, investor_id)
    snap = NetWorthSnapshot(
        investor_id=investor_id,
        portfolio_value=summary.portfolio_value,
        financial_assets_value=summary.financial_assets_value,
        total_liabilities=summary.total_liabilities,
        net_worth=summary.net_worth,
        currency=summary.currency,
    )
    db.add(snap)
    db.commit()


def _compute_fi_projection(fp, portfolio_value: float, financial_assets: float) -> dict | None:
    """Rough FI projection: years until net investable assets = 25× annual expenses (4% rule)."""
    if not fp or fp.monthly_expenses <= 0:
        return None

    annual_expenses = fp.monthly_expenses * 12
    fi_target = annual_expenses * 25  # 4% safe withdrawal rate

    current_investable = portfolio_value + financial_assets
    monthly_surplus = (fp.monthly_income or 0) - fp.monthly_expenses
    if (fp.spouse_income or 0) > 0:
        monthly_surplus += fp.spouse_income  # type: ignore[operator]

    monthly_savings = monthly_surplus * (fp.investable_capital_pct / 100.0)
    annual_savings = monthly_savings * 12
    assumed_return = 0.07  # 7% nominal annual return

    if current_investable >= fi_target:
        years_to_fi = 0.0
    elif annual_savings <= 0 and current_investable <= 0:
        return {
            "fi_target": round(fi_target, 2),
            "current_investable": round(current_investable, 2),
            "gap": round(max(fi_target - current_investable, 0), 2),
            "years_to_fi": None,
            "note": "No savings rate — FI date cannot be projected.",
        }
    else:
        # FV = PV*(1+r)^n + PMT*((1+r)^n - 1)/r — solve for n numerically
        pmt = annual_savings
        pv = current_investable
        r = assumed_return
        fv_target = fi_target

        if r == 0:
            years_to_fi = (fv_target - pv) / pmt if pmt > 0 else None
        else:
            import math
            try:
                # Binary search for n
                lo, hi = 0.0, 200.0
                for _ in range(60):
                    mid = (lo + hi) / 2
                    fv = pv * (1 + r) ** mid + pmt * ((1 + r) ** mid - 1) / r
                    if fv < fv_target:
                        lo = mid
                    else:
                        hi = mid
                years_to_fi = round(hi, 1)
            except Exception:
                years_to_fi = None

    return {
        "fi_target": round(fi_target, 2),
        "current_investable": round(current_investable, 2),
        "gap": round(max(fi_target - current_investable, 0), 2),
        "years_to_fi": years_to_fi,
        "annual_expenses": round(annual_expenses, 2),
        "assumed_return_pct": assumed_return * 100,
    }

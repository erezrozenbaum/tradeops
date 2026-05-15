"""Family portfolio aggregation — groups investor accounts by family member."""
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.family_portfolio.schemas import (
    FamilyMemberPortfolio,
    FamilyPortfolioSummary,
    OverlapHolding,
)

# Maps relationship_type → generation bucket label
_GENERATION_MAP: dict[str, str] = {
    "self": "primary",
    "spouse": "partners",
    "partner": "partners",
    "child": "children",
    "son": "children",
    "daughter": "children",
    "parent": "parents",
    "grandparent": "grandparents",
    "sibling": "siblings",
}


def generation_for(relationship_type: str) -> str:
    """Map a relationship_type string to a generation bucket label."""
    return _GENERATION_MAP.get(relationship_type.lower(), "other")


def is_minor(age: int | None) -> bool:
    """Return True if age is known and under 18."""
    return age is not None and age < 18


def build_family_summary(
    family: Any,                         # FamilyProfile ORM or duck-typed
    portfolio: Any,                      # PortfolioSummary Pydantic
    acct_to_member: dict[str, Any],      # account_id_str → family_member_id (UUID | None)
) -> FamilyPortfolioSummary:
    """Pure aggregation — no DB calls. Accepts pre-fetched data."""

    member_map = {m.id: m for m in family.members}

    member_value: dict[Any, float] = defaultdict(float)
    member_cost: dict[Any, float] = defaultdict(float)
    member_pnl: dict[Any, float] = defaultdict(float)
    member_acct_count: dict[Any, int] = defaultdict(int)
    member_alloc: dict[Any, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    ticker_members: dict[str, dict[Any, tuple[str, float]]] = defaultdict(dict)

    for acc in portfolio.accounts:
        mid = acct_to_member.get(str(acc.id))
        member_value[mid] += acc.total_current_value
        member_cost[mid] += acc.total_cost_basis
        member_pnl[mid] += acc.unrealized_pnl
        member_acct_count[mid] += 1
        for h in acc.holdings:
            member_alloc[mid][h.asset_type] += h.current_value_base
            if h.ticker:
                ticker_members[h.ticker][mid] = (h.name, h.current_value_base)

    all_member_ids: set[Any] = set(acct_to_member.values())
    all_member_ids.add(None)

    members: list[FamilyMemberPortfolio] = []
    for mid in sorted(all_member_ids, key=lambda x: (x is not None, str(x) if x else "")):
        if member_value[mid] == 0 and member_acct_count[mid] == 0:
            continue

        fm = member_map.get(mid) if mid is not None else None

        if fm is not None:
            name = fm.name
            rel = fm.relationship_type
            age = getattr(fm, "age", None)
            is_primary = getattr(fm, "is_primary", False)
            rt = getattr(fm, "individual_risk_tolerance", None)
            risk_tol = rt.value if hasattr(rt, "value") and rt is not None else (str(rt) if rt else None)
        else:
            primary_member = next((m for m in family.members if getattr(m, "is_primary", False)), None)
            name = primary_member.name if primary_member else "Primary"
            rel = "self"
            age = getattr(primary_member, "age", None) if primary_member else None
            is_primary = True
            risk_tol = None

        minor = is_minor(age)
        cost = member_cost[mid]
        value = member_value[mid]
        pnl = member_pnl[mid]
        pnl_pct = round((pnl / cost * 100) if cost > 0 else 0.0, 2)
        alloc = {k: round(v, 2) for k, v in member_alloc[mid].items()}

        members.append(FamilyMemberPortfolio(
            member_id=mid if mid is not None else uuid.UUID(int=0),
            member_name=name,
            relationship_type=rel,
            generation=generation_for(rel),
            age=age,
            is_minor=minor,
            is_primary=is_primary,
            individual_risk_tolerance=risk_tol,
            total_cost_basis=round(cost, 2),
            total_current_value=round(value, 2),
            unrealized_pnl=round(pnl, 2),
            unrealized_pnl_pct=pnl_pct,
            account_count=member_acct_count[mid],
            asset_allocation=alloc,
            education_mode=minor,
        ))

    by_gen: dict[str, float] = defaultdict(float)
    for m in members:
        by_gen[m.generation] += m.total_current_value

    hh_alloc: dict[str, float] = defaultdict(float)
    for m in members:
        for asset, val in m.asset_allocation.items():
            hh_alloc[asset] += val

    overlap: list[OverlapHolding] = []
    for ticker, mdict in ticker_members.items():
        if len(mdict) >= 2:
            combined = sum(v for _, v in mdict.values())
            mnames = [n for n, _ in mdict.values()]
            overlap.append(OverlapHolding(
                ticker=ticker,
                name=list(mdict.values())[0][0],
                member_names=mnames,
                combined_value=round(combined, 2),
            ))
    overlap.sort(key=lambda x: x.combined_value, reverse=True)

    total_value = portfolio.total_current_value
    total_cost = portfolio.total_cost_basis
    total_pnl = portfolio.unrealized_pnl
    total_pnl_pct = round((total_pnl / total_cost * 100) if total_cost > 0 else 0.0, 2)

    return FamilyPortfolioSummary(
        family_id=family.id,
        family_name=family.name,
        currency=portfolio.base_currency,
        primary_investor_id=family.primary_investor_id,
        total_current_value=round(total_value, 2),
        total_cost_basis=round(total_cost, 2),
        total_unrealized_pnl=round(total_pnl, 2),
        total_unrealized_pnl_pct=total_pnl_pct,
        member_count=len(family.members),
        members=members,
        by_generation={k: round(v, 2) for k, v in by_gen.items()},
        household_asset_allocation={k: round(v, 2) for k, v in hh_alloc.items()},
        cross_member_overlap=overlap,
        has_minors=any(m.is_minor for m in members),
        computed_at=datetime.now(timezone.utc),
    )


def compute_family_portfolio(
    db: Session,
    investor_id: uuid.UUID,
) -> FamilyPortfolioSummary | None:
    from app.family_profiles.service import get_by_investor
    from app.models.investment_account import InvestmentAccount
    from app.portfolio_analysis.service import get_portfolio

    families = get_by_investor(db, investor_id)
    if not families:
        return None

    family = families[0]
    portfolio = get_portfolio(db, investor_id)
    if portfolio is None:
        return None

    raw_accounts = (
        db.query(InvestmentAccount)
        .filter(InvestmentAccount.investor_id == investor_id)
        .all()
    )
    acct_to_member: dict[str, uuid.UUID | None] = {
        str(a.id): a.family_member_id for a in raw_accounts
    }

    return build_family_summary(family, portfolio, acct_to_member)

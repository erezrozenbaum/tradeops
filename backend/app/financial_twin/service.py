from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.financial_twin.schemas import (
    HealthRadarDimensions,
    HealthRadarSnapshot,
    TwinDimensions,
    TwinSnapshot,
)
from app.models.financial_twin_snapshot import FinancialHealthScore, FinancialTwinSnapshot


# ─── Shared component helpers ─────────────────────────────────────────────────

def _stability(db: Session, investor_id: uuid.UUID) -> float:
    from app.financial_profiles.service import get_by_investor
    from app.financial_scoring.engine import calculate_stability_score
    from app.financial_scoring.schemas import FinancialScoringInput

    fp = get_by_investor(db, investor_id)
    if not fp:
        return 0.0
    ef = fp.liquid_savings / fp.monthly_expenses if fp.monthly_expenses > 0 else 0.0
    inp = FinancialScoringInput(
        monthly_income=fp.monthly_income,
        monthly_expenses=fp.monthly_expenses,
        emergency_fund_months=ef,
        total_monthly_debt_payments=sum(l.monthly_payment for l in fp.liabilities),
        total_assets=sum(a.current_value for a in fp.assets),
        total_liabilities=sum(l.current_value for l in fp.liabilities),
        job_stability=fp.job_stability,
        income_trend=fp.income_trend,
        dependents_count=fp.dependents_count,
    )
    return float(calculate_stability_score(inp).score)


def _behavioral_and_emotional(db: Session, investor_id: uuid.UUID) -> tuple[float, float, float]:
    """Returns (behavioral_discipline, emotional_risk, long_term_discipline)."""
    from app.behavioral_patterns.service import compute_behavioral_metrics

    try:
        m = compute_behavioral_metrics(db, investor_id)
    except Exception:
        m = None

    if m is None:
        return 50.0, 50.0, 50.0

    behavioral_discipline = float(m.behavioral_score)

    total = m.short_term_count + m.medium_term_count + m.long_term_count
    if total > 0:
        short_pct = m.short_term_count / total
        # High short-term pct → high emotional risk score (bad)
        emotional_risk = round(max(0.0, 100.0 - short_pct * 150), 2)
        emotional_risk = min(emotional_risk, 100.0)
    else:
        emotional_risk = 50.0

    avg = m.avg_days_held or 0.0
    if avg >= 365:
        long_term_discipline = 100.0
    elif avg >= 180:
        long_term_discipline = 80.0
    elif avg >= 90:
        long_term_discipline = 60.0
    elif avg >= 30:
        long_term_discipline = 40.0
    else:
        long_term_discipline = 20.0

    return behavioral_discipline, emotional_risk, long_term_discipline


def _portfolio_consistency(db: Session, investor_id: uuid.UUID) -> float:
    from app.strategy_drift.service import compute_drift

    try:
        r = compute_drift(db, investor_id)
        return float(r.alignment_score) if r else 50.0
    except Exception:
        return 50.0


def _financial_resilience(db: Session, investor_id: uuid.UUID) -> float:
    from app.financial_profiles.service import get_by_investor

    fp = get_by_investor(db, investor_id)
    if not fp:
        return 0.0

    ef = fp.liquid_savings / fp.monthly_expenses if fp.monthly_expenses > 0 else 0.0
    ef_pts = 50.0 if ef >= 6 else 35.0 if ef >= 3 else 20.0 if ef >= 1 else 0.0

    total_assets = sum(a.current_value for a in fp.assets)
    total_liabilities = sum(l.current_value for l in fp.liabilities)
    net_worth = total_assets - total_liabilities
    nw_pts = (
        50.0 if net_worth > fp.monthly_income * 12
        else 30.0 if net_worth > 0
        else 0.0
    )
    return min(ef_pts + nw_pts, 100.0)


def _risk_alignment(db: Session, investor_id: uuid.UUID) -> float:
    from app.strategy_drift.service import compute_drift

    try:
        r = compute_drift(db, investor_id)
        if r is None:
            return 50.0
        top = r.top_concern
        if top is None:
            return 95.0
        from app.strategy_drift.schemas import DriftStatus
        worst = max((item.drift_pct for item in r.drift_items), default=0.0)
        if worst <= 3.0:
            return 90.0
        if worst <= 8.0:
            return 65.0
        return 35.0
    except Exception:
        return 50.0


def _contribution_momentum(db: Session, investor_id: uuid.UUID) -> float:
    from app.models.holding_transaction import HoldingTransaction
    from app.models.investment_account import InvestmentAccount

    account_ids = [
        row[0]
        for row in db.query(InvestmentAccount.id)
        .filter(InvestmentAccount.investor_id == investor_id)
        .all()
    ]
    if not account_ids:
        return 0.0

    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    txns = (
        db.query(HoldingTransaction.transaction_date)
        .filter(
            HoldingTransaction.account_id.in_(account_ids),
            HoldingTransaction.transaction_date >= cutoff,
            HoldingTransaction.transaction_type.in_(["buy", "deposit"]),
        )
        .all()
    )
    active_months: set[tuple[int, int]] = set()
    for (d,) in txns:
        active_months.add((d.year, d.month))

    ratio = len(active_months) / 3.0
    return min(round(ratio * 100), 100)


def _liquidity(db: Session, investor_id: uuid.UUID) -> float:
    from app.financial_profiles.service import get_by_investor

    fp = get_by_investor(db, investor_id)
    if not fp or fp.monthly_expenses <= 0:
        return 0.0
    ef = fp.liquid_savings / fp.monthly_expenses
    if ef >= 6:
        return 100.0
    if ef >= 3:
        return 75.0
    if ef >= 1:
        return 45.0
    return 15.0


def _diversification(db: Session, investor_id: uuid.UUID) -> float:
    from app.models.investment_account import InvestmentAccount, InvestmentHolding

    account_ids = [
        row[0]
        for row in db.query(InvestmentAccount.id)
        .filter(InvestmentAccount.investor_id == investor_id)
        .all()
    ]
    if not account_ids:
        return 0.0

    unique = (
        db.query(InvestmentHolding.ticker)
        .filter(
            InvestmentHolding.account_id.in_(account_ids),
            InvestmentHolding.ticker.isnot(None),
        )
        .distinct()
        .count()
    )
    if unique >= 10:
        return 100.0
    if unique >= 5:
        return 75.0
    if unique >= 3:
        return 50.0
    if unique >= 2:
        return 30.0
    return max(unique * 10.0, 0.0)


def _tax_efficiency(db: Session, investor_id: uuid.UUID) -> float:
    """Proxy: long-term holdings as % of total holdings (longer = more tax-efficient)."""
    from app.behavioral_patterns.service import compute_behavioral_metrics

    try:
        m = compute_behavioral_metrics(db, investor_id)
    except Exception:
        return 50.0

    if m is None:
        return 50.0

    total = m.short_term_count + m.medium_term_count + m.long_term_count
    if total == 0:
        return 50.0

    long_pct = m.long_term_count / total
    medium_pct = m.medium_term_count / total
    return round(min((long_pct * 100 + medium_pct * 40), 100.0), 2)


# ─── Compute + persist ────────────────────────────────────────────────────────

def compute_twin_and_health(
    db: Session, investor_id: uuid.UUID
) -> tuple[FinancialTwinSnapshot, FinancialHealthScore]:
    stab = _stability(db, investor_id)
    behav, emot, lt = _behavioral_and_emotional(db, investor_id)
    p_cons = _portfolio_consistency(db, investor_id)
    resilience = _financial_resilience(db, investor_id)
    risk_al = _risk_alignment(db, investor_id)
    momentum = _contribution_momentum(db, investor_id)
    liquidity = _liquidity(db, investor_id)
    diversif = _diversification(db, investor_id)
    tax_eff = _tax_efficiency(db, investor_id)

    twin_dims = [stab, behav, emot, p_cons, resilience, risk_al, lt, momentum]
    twin_overall = round(sum(twin_dims) / len(twin_dims), 2)

    twin = FinancialTwinSnapshot(
        investor_id=investor_id,
        financial_stability=round(stab, 2),
        behavioral_discipline=round(behav, 2),
        emotional_risk=round(emot, 2),
        portfolio_consistency=round(p_cons, 2),
        financial_resilience=round(resilience, 2),
        risk_alignment=round(risk_al, 2),
        long_term_discipline=round(lt, 2),
        contribution_momentum=round(momentum, 2),
        overall_score=twin_overall,
    )
    db.add(twin)

    health_dims = [stab, liquidity, behav, diversif, emot, momentum, tax_eff, risk_al, resilience]
    health_overall = round(sum(health_dims) / len(health_dims), 2)

    health = FinancialHealthScore(
        investor_id=investor_id,
        stability=round(stab, 2),
        liquidity=round(liquidity, 2),
        discipline=round(behav, 2),
        diversification=round(diversif, 2),
        emotional_control=round(emot, 2),
        contribution_consistency=round(momentum, 2),
        tax_efficiency=round(tax_eff, 2),
        risk_alignment=round(risk_al, 2),
        financial_resilience=round(resilience, 2),
        overall_score=health_overall,
    )
    db.add(health)
    db.commit()
    db.refresh(twin)
    db.refresh(health)
    return twin, health


# ─── Query helpers ────────────────────────────────────────────────────────────

def get_latest_twin(db: Session, investor_id: uuid.UUID) -> FinancialTwinSnapshot | None:
    return (
        db.query(FinancialTwinSnapshot)
        .filter(FinancialTwinSnapshot.investor_id == investor_id)
        .order_by(FinancialTwinSnapshot.computed_at.desc())
        .first()
    )


def get_twin_history(
    db: Session, investor_id: uuid.UUID, limit: int = 30
) -> list[FinancialTwinSnapshot]:
    return (
        db.query(FinancialTwinSnapshot)
        .filter(FinancialTwinSnapshot.investor_id == investor_id)
        .order_by(FinancialTwinSnapshot.computed_at.desc())
        .limit(limit)
        .all()
    )


def get_latest_health(db: Session, investor_id: uuid.UUID) -> FinancialHealthScore | None:
    return (
        db.query(FinancialHealthScore)
        .filter(FinancialHealthScore.investor_id == investor_id)
        .order_by(FinancialHealthScore.computed_at.desc())
        .first()
    )


# ─── Response builders ────────────────────────────────────────────────────────

def _twin_to_response(
    snap: FinancialTwinSnapshot, prev_overall: float | None
) -> TwinSnapshot:
    return TwinSnapshot(
        id=str(snap.id),
        computed_at=snap.computed_at,
        dimensions=TwinDimensions(
            financial_stability=snap.financial_stability,
            behavioral_discipline=snap.behavioral_discipline,
            emotional_risk=snap.emotional_risk,
            portfolio_consistency=snap.portfolio_consistency,
            financial_resilience=snap.financial_resilience,
            risk_alignment=snap.risk_alignment,
            long_term_discipline=snap.long_term_discipline,
            contribution_momentum=snap.contribution_momentum,
        ),
        overall_score=snap.overall_score,
        previous_overall=prev_overall,
    )


def _health_to_response(
    snap: FinancialHealthScore, prev_overall: float | None
) -> HealthRadarSnapshot:
    return HealthRadarSnapshot(
        id=str(snap.id),
        computed_at=snap.computed_at,
        dimensions=HealthRadarDimensions(
            stability=snap.stability,
            liquidity=snap.liquidity,
            discipline=snap.discipline,
            diversification=snap.diversification,
            emotional_control=snap.emotional_control,
            contribution_consistency=snap.contribution_consistency,
            tax_efficiency=snap.tax_efficiency,
            risk_alignment=snap.risk_alignment,
            financial_resilience=snap.financial_resilience,
        ),
        overall_score=snap.overall_score,
        previous_overall=prev_overall,
    )


def get_or_compute_twin_response(db: Session, investor_id: uuid.UUID) -> TwinSnapshot:
    history = get_twin_history(db, investor_id, limit=2)
    if not history:
        twin, _ = compute_twin_and_health(db, investor_id)
        return _twin_to_response(twin, None)
    prev = history[1].overall_score if len(history) >= 2 else None
    return _twin_to_response(history[0], prev)


def get_twin_history_response(
    db: Session, investor_id: uuid.UUID, limit: int = 30
) -> list[TwinSnapshot]:
    snaps = get_twin_history(db, investor_id, limit=limit + 1)
    result = []
    for i, snap in enumerate(snaps[:-1]):
        prev = snaps[i + 1].overall_score if i + 1 < len(snaps) else None
        result.append(_twin_to_response(snap, prev))
    if snaps and len(snaps) <= limit:
        result.append(_twin_to_response(snaps[-1], None))
    return result[:limit]


def refresh_and_respond(db: Session, investor_id: uuid.UUID) -> tuple[TwinSnapshot, HealthRadarSnapshot]:
    twin, health = compute_twin_and_health(db, investor_id)
    prev_twin = (
        db.query(FinancialTwinSnapshot)
        .filter(FinancialTwinSnapshot.investor_id == investor_id)
        .order_by(FinancialTwinSnapshot.computed_at.desc())
        .offset(1)
        .first()
    )
    prev_health = (
        db.query(FinancialHealthScore)
        .filter(FinancialHealthScore.investor_id == investor_id)
        .order_by(FinancialHealthScore.computed_at.desc())
        .offset(1)
        .first()
    )
    return (
        _twin_to_response(twin, prev_twin.overall_score if prev_twin else None),
        _health_to_response(health, prev_health.overall_score if prev_health else None),
    )


def get_or_compute_health_response(db: Session, investor_id: uuid.UUID) -> HealthRadarSnapshot:
    health = get_latest_health(db, investor_id)
    if not health:
        _, health = compute_twin_and_health(db, investor_id)
        return _health_to_response(health, None)
    prev = (
        db.query(FinancialHealthScore)
        .filter(FinancialHealthScore.investor_id == investor_id)
        .order_by(FinancialHealthScore.computed_at.desc())
        .offset(1)
        .first()
    )
    return _health_to_response(health, prev.overall_score if prev else None)

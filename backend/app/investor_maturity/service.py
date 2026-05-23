from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.investor_maturity.schemas import (
    FEATURES_BY_STAGE,
    ComponentScores,
    MaturitySnapshot,
    STAGE_LABELS,
)
from app.models.investor_maturity_snapshot import InvestorMaturitySnapshot

# Component weights — must sum to 1.0
_WEIGHTS = {
    "financial_stability": 0.20,
    "debt_discipline": 0.15,
    "savings_consistency": 0.15,
    "emotional_discipline": 0.15,
    "strategy_consistency": 0.15,
    "contribution_regularity": 0.10,
    "data_maturity": 0.05,
    "portfolio_complexity": 0.05,
}


def _stage_from_score(score: float) -> str:
    if score >= 75:
        return "advanced_cognition"
    if score >= 50:
        return "optimization"
    if score >= 25:
        return "discipline"
    return "foundation"


def _financial_stability_score(db: Session, investor_id: uuid.UUID) -> tuple[float, list[str]]:
    from app.financial_profiles.service import get_by_investor
    from app.financial_scoring.engine import calculate_stability_score
    from app.financial_scoring.schemas import FinancialScoringInput

    notes: list[str] = []
    fp = get_by_investor(db, investor_id)
    if not fp:
        notes.append("Complete your financial profile to improve your maturity score.")
        return 0.0, notes

    total_assets = sum(a.current_value for a in fp.assets)
    total_liabilities = sum(l.current_value for l in fp.liabilities)

    scoring_input = FinancialScoringInput(
        monthly_income=fp.monthly_income,
        monthly_expenses=fp.monthly_expenses,
        emergency_fund_months=fp.liquid_savings / fp.monthly_expenses if fp.monthly_expenses > 0 else 0.0,
        total_monthly_debt_payments=sum(l.monthly_payment for l in fp.liabilities),
        total_assets=total_assets,
        total_liabilities=total_liabilities,
        job_stability=fp.job_stability,
        income_trend=fp.income_trend,
        dependents_count=fp.dependents_count,
    )
    result = calculate_stability_score(scoring_input)
    if result.score < 40:
        notes.append("Strengthen your financial foundation — focus on income, emergency fund, and debt reduction.")
    return float(result.score), notes


def _debt_discipline_score(db: Session, investor_id: uuid.UUID) -> tuple[float, list[str]]:
    from app.financial_profiles.service import get_by_investor

    notes: list[str] = []
    fp = get_by_investor(db, investor_id)
    if not fp:
        return 0.0, notes

    if fp.monthly_income <= 0:
        return 50.0, notes  # no income data — neutral

    total_debt_payment = sum(l.monthly_payment for l in fp.liabilities)
    dti = total_debt_payment / fp.monthly_income

    if dti == 0:
        return 100.0, notes
    if dti < 0.15:
        return 90.0, notes
    if dti < 0.25:
        return 75.0, notes
    if dti < 0.35:
        score = 55.0
    elif dti < 0.50:
        score = 35.0
        notes.append("High debt-to-income ratio — prioritise debt reduction to unlock higher maturity levels.")
    else:
        score = 15.0
        notes.append("Debt payments exceed 50% of income — maturity is limited until debt is controlled.")
    return score, notes


def _savings_consistency_score(db: Session, investor_id: uuid.UUID) -> tuple[float, list[str]]:
    from app.financial_profiles.service import get_by_investor

    notes: list[str] = []
    fp = get_by_investor(db, investor_id)
    if not fp:
        return 0.0, notes

    if fp.monthly_income <= 0:
        return 0.0, notes

    surplus = fp.monthly_income - fp.monthly_expenses
    savings_rate = surplus / fp.monthly_income

    if savings_rate >= 0.20:
        return 100.0, notes
    if savings_rate >= 0.15:
        return 80.0, notes
    if savings_rate >= 0.10:
        return 60.0, notes
    if savings_rate >= 0.05:
        return 40.0, notes
    if savings_rate > 0:
        notes.append("Aim to save at least 10% of monthly income to build financial resilience.")
        return 20.0, notes
    notes.append("Achieve a positive monthly savings rate before focusing on investment growth.")
    return 0.0, notes


def _emotional_discipline_score(db: Session, investor_id: uuid.UUID) -> tuple[float, list[str]]:
    from app.behavioral_patterns.service import compute_behavioral_metrics

    notes: list[str] = []
    try:
        metrics = compute_behavioral_metrics(db, investor_id)
        if metrics is None:
            return 50.0, notes  # no data — neutral
        score = float(metrics.behavioral_score)
        if score < 40:
            notes.append("Your behavioral patterns show emotional trading tendencies — try holding positions longer.")
        return score, notes
    except Exception:
        return 50.0, notes


def _strategy_consistency_score(db: Session, investor_id: uuid.UUID) -> tuple[float, list[str]]:
    from app.strategy_drift.service import compute_drift

    notes: list[str] = []
    try:
        report = compute_drift(db, investor_id)
        if report is None:
            return 50.0, notes  # no risk model — neutral
        score = float(report.alignment_score)
        if score < 50:
            notes.append("Your portfolio is drifting from target allocation — consider rebalancing.")
        return score, notes
    except Exception:
        return 50.0, notes


def _contribution_regularity_score(db: Session, investor_id: uuid.UUID) -> tuple[float, list[str]]:
    from app.models.holding_transaction import HoldingTransaction
    from app.models.investment_account import InvestmentAccount

    notes: list[str] = []
    cutoff = datetime.now(timezone.utc) - timedelta(days=180)

    account_ids = [
        row[0]
        for row in db.query(InvestmentAccount.id)
        .filter(InvestmentAccount.investor_id == investor_id)
        .all()
    ]
    if not account_ids:
        return 0.0, notes

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
    for (txn_date,) in txns:
        active_months.add((txn_date.year, txn_date.month))

    ratio = len(active_months) / 6.0
    score = min(round(ratio * 100), 100)
    if score < 50:
        notes.append("Contribute or invest in at least 4 out of every 6 months to build habit consistency.")
    return float(score), notes


def _data_maturity_score(db: Session, investor_id: uuid.UUID) -> tuple[float, list[str]]:
    from app.financial_profiles.service import get_by_investor
    from app.risk_modeling.service import get_latest as get_latest_risk_model
    from app.models.investment_account import InvestmentAccount, InvestmentHolding
    from app.models.holding_transaction import HoldingTransaction

    notes: list[str] = []
    points = 0

    if get_by_investor(db, investor_id):
        points += 25

    if get_latest_risk_model(db, investor_id):
        points += 25

    account_ids = [
        row[0]
        for row in db.query(InvestmentAccount.id)
        .filter(InvestmentAccount.investor_id == investor_id)
        .all()
    ]
    holding_count = (
        db.query(InvestmentHolding)
        .filter(InvestmentHolding.account_id.in_(account_ids))
        .count()
        if account_ids
        else 0
    )
    if holding_count > 0:
        points += 25

    txn_count = (
        db.query(HoldingTransaction)
        .filter(HoldingTransaction.account_id.in_(account_ids))
        .count()
        if account_ids
        else 0
    )
    if txn_count >= 30:
        points += 25
    elif txn_count > 0:
        points += 10
        notes.append("Log more transactions to improve data quality and maturity scoring accuracy.")

    if points < 50:
        notes.append("Fill in your financial profile and risk model to build a stronger data foundation.")

    return float(points), notes


def _portfolio_complexity_score(db: Session, investor_id: uuid.UUID) -> tuple[float, list[str]]:
    from app.models.investment_account import InvestmentAccount, InvestmentHolding

    notes: list[str] = []
    account_ids = [
        row[0]
        for row in db.query(InvestmentAccount.id)
        .filter(InvestmentAccount.investor_id == investor_id)
        .all()
    ]
    if not account_ids:
        notes.append("Add holdings to your portfolio to improve diversification scoring.")
        return 0.0, notes

    unique_tickers = (
        db.query(InvestmentHolding.ticker)
        .filter(
            InvestmentHolding.account_id.in_(account_ids),
            InvestmentHolding.ticker.isnot(None),
        )
        .distinct()
        .count()
    )

    if unique_tickers >= 10:
        return 100.0, notes
    if unique_tickers >= 5:
        return 75.0, notes
    if unique_tickers >= 3:
        return 50.0, notes
    if unique_tickers >= 2:
        return 30.0, notes
    if unique_tickers == 1:
        notes.append("Diversify your portfolio across multiple assets to reduce concentration risk.")
        return 10.0, notes
    notes.append("Add holdings to your portfolio to improve diversification scoring.")
    return 0.0, notes


def compute_maturity(db: Session, investor_id: uuid.UUID) -> InvestorMaturitySnapshot:
    all_notes: list[str] = []

    fs, fs_notes = _financial_stability_score(db, investor_id)
    dd, dd_notes = _debt_discipline_score(db, investor_id)
    sc, sc_notes = _savings_consistency_score(db, investor_id)
    ed, ed_notes = _emotional_discipline_score(db, investor_id)
    stc, stc_notes = _strategy_consistency_score(db, investor_id)
    cr, cr_notes = _contribution_regularity_score(db, investor_id)
    dm, dm_notes = _data_maturity_score(db, investor_id)
    pc, pc_notes = _portfolio_complexity_score(db, investor_id)

    all_notes = fs_notes + dd_notes + sc_notes + ed_notes + stc_notes + cr_notes + dm_notes + pc_notes

    composite = round(
        fs * _WEIGHTS["financial_stability"]
        + dd * _WEIGHTS["debt_discipline"]
        + sc * _WEIGHTS["savings_consistency"]
        + ed * _WEIGHTS["emotional_discipline"]
        + stc * _WEIGHTS["strategy_consistency"]
        + cr * _WEIGHTS["contribution_regularity"]
        + dm * _WEIGHTS["data_maturity"]
        + pc * _WEIGHTS["portfolio_complexity"],
        2,
    )

    stage = _stage_from_score(composite)

    snapshot = InvestorMaturitySnapshot(
        investor_id=investor_id,
        composite_score=composite,
        stage=stage,
        component_scores={
            "financial_stability": round(fs, 2),
            "debt_discipline": round(dd, 2),
            "savings_consistency": round(sc, 2),
            "emotional_discipline": round(ed, 2),
            "strategy_consistency": round(stc, 2),
            "contribution_regularity": round(cr, 2),
            "data_maturity": round(dm, 2),
            "portfolio_complexity": round(pc, 2),
        },
        features_unlocked=FEATURES_BY_STAGE[stage],
        notes=all_notes[:5],  # cap to 5 most actionable notes
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot


def get_latest(db: Session, investor_id: uuid.UUID) -> InvestorMaturitySnapshot | None:
    return (
        db.query(InvestorMaturitySnapshot)
        .filter(InvestorMaturitySnapshot.investor_id == investor_id)
        .order_by(InvestorMaturitySnapshot.computed_at.desc())
        .first()
    )


def get_history(
    db: Session,
    investor_id: uuid.UUID,
    limit: int = 52,
) -> list[InvestorMaturitySnapshot]:
    return (
        db.query(InvestorMaturitySnapshot)
        .filter(InvestorMaturitySnapshot.investor_id == investor_id)
        .order_by(InvestorMaturitySnapshot.computed_at.desc())
        .limit(limit)
        .all()
    )


def _to_response(snap: InvestorMaturitySnapshot) -> MaturitySnapshot:
    return MaturitySnapshot(
        id=str(snap.id),
        computed_at=snap.computed_at,
        composite_score=snap.composite_score,
        stage=snap.stage,
        stage_label=STAGE_LABELS[snap.stage],
        component_scores=ComponentScores(**snap.component_scores),
        features_unlocked=snap.features_unlocked,
        notes=snap.notes,
    )


def get_latest_response(db: Session, investor_id: uuid.UUID) -> MaturitySnapshot | None:
    snap = get_latest(db, investor_id)
    return _to_response(snap) if snap else None


def get_history_response(db: Session, investor_id: uuid.UUID, limit: int = 52) -> list[MaturitySnapshot]:
    return [_to_response(s) for s in get_history(db, investor_id, limit)]


def compute_and_respond(db: Session, investor_id: uuid.UUID) -> MaturitySnapshot:
    snap = compute_maturity(db, investor_id)
    return _to_response(snap)

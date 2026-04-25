import uuid

from sqlalchemy.orm import Session

from app.audit import service as audit
from app.financial_profiles import service as fp_service
from app.financial_scoring.engine import calculate_stability_score
from app.financial_scoring.schemas import FinancialScoringInput
from app.models.investor_profile import ExperienceLevel, InvestorProfile
from app.models.risk_model import RiskModel

# Allocation table: (risk_modifier, experience_level) → (low_pct, growth_pct, high_pct, max_drawdown_pct)
_ALLOCATION_TABLE: dict[tuple[str, str], tuple[float, float, float, float]] = {
    ("reduce",       "beginner"):     (85.0, 15.0,  0.0,  5.0),
    ("reduce",       "intermediate"): (85.0, 15.0,  0.0,  5.0),
    ("reduce",       "advanced"):     (85.0, 15.0,  0.0,  5.0),
    ("neutral",      "beginner"):     (70.0, 25.0,  5.0, 10.0),
    ("neutral",      "intermediate"): (60.0, 30.0, 10.0, 15.0),
    ("neutral",      "advanced"):     (50.0, 35.0, 15.0, 20.0),
    ("allow_growth", "beginner"):     (50.0, 35.0, 15.0, 15.0),
    ("allow_growth", "intermediate"): (40.0, 40.0, 20.0, 20.0),
    ("allow_growth", "advanced"):     (30.0, 45.0, 25.0, 25.0),
}

_MINOR_ALLOCATION: tuple[float, float, float, float] = (100.0, 0.0, 0.0, 0.0)


def _compute_allocation(
    risk_modifier: str,
    experience_level: ExperienceLevel,
    is_minor: bool,
) -> tuple[float, float, float, float]:
    if is_minor:
        return _MINOR_ALLOCATION
    return _ALLOCATION_TABLE[(risk_modifier, experience_level.value)]


def get_latest(db: Session, investor_id: uuid.UUID) -> RiskModel | None:
    return (
        db.query(RiskModel)
        .filter(RiskModel.investor_profile_id == investor_id)
        .order_by(RiskModel.generated_at.desc())
        .first()
    )


def get_history(db: Session, investor_id: uuid.UUID) -> list[RiskModel]:
    return (
        db.query(RiskModel)
        .filter(RiskModel.investor_profile_id == investor_id)
        .order_by(RiskModel.generated_at.desc())
        .all()
    )


def generate(db: Session, investor_id: uuid.UUID) -> RiskModel | None:
    investor = db.get(InvestorProfile, investor_id)
    if not investor:
        return None

    fp = fp_service.get_by_investor(db, investor_id)
    if not fp:
        return None

    total_assets = sum(a.current_value for a in fp.assets)
    total_liabilities = sum(l.outstanding_balance for l in fp.liabilities)
    total_net_worth = total_assets - total_liabilities
    liquid_capital = fp.liquid_savings + sum(
        a.current_value for a in fp.assets if a.is_liquid
    )
    investable_capital = round(liquid_capital * fp.investable_capital_pct / 100, 2)

    scoring_input = FinancialScoringInput(
        monthly_income=fp.monthly_income,
        monthly_expenses=fp.monthly_expenses,
        emergency_fund_months=fp.emergency_fund_months,
        total_monthly_debt_payments=sum(l.monthly_payment for l in fp.liabilities),
        total_assets=total_assets,
        total_liabilities=total_liabilities,
        job_stability=fp.job_stability,
        income_trend=fp.income_trend,
        dependents_count=fp.dependents_count,
    )
    score_result = calculate_stability_score(scoring_input)

    low_risk_pct, growth_pct, high_risk_pct, max_drawdown_pct = _compute_allocation(
        risk_modifier=score_result.risk_modifier,
        experience_level=investor.experience_level,
        is_minor=investor.is_minor,
    )

    rm = RiskModel(
        investor_profile_id=investor_id,
        stability_score=score_result.score,
        stability_classification=score_result.classification,
        total_net_worth=total_net_worth,
        liquid_capital=liquid_capital,
        investable_capital=investable_capital,
        low_risk_pct=low_risk_pct,
        growth_pct=growth_pct,
        high_risk_pct=high_risk_pct,
        max_drawdown_pct=max_drawdown_pct,
        currency=fp.currency,
    )
    db.add(rm)
    db.flush()
    audit.log_event(
        db,
        event_type="risk_model.generated",
        description=(
            f"Risk model generated: score={score_result.score} "
            f"({score_result.classification}), "
            f"investable={investable_capital} {fp.currency}"
        ),
        investor_profile_id=investor_id,
        metadata={
            "risk_model_id": str(rm.id),
            "stability_score": score_result.score,
            "risk_modifier": score_result.risk_modifier,
            "low_risk_pct": low_risk_pct,
            "growth_pct": growth_pct,
            "high_risk_pct": high_risk_pct,
        },
    )
    db.commit()
    db.refresh(rm)
    return rm

import uuid
from datetime import date

from sqlalchemy.orm import Session

from app.audit import service as audit
from app.financial_profiles import service as fp_service
from app.financial_scoring.engine import calculate_stability_score
from app.financial_scoring.schemas import FinancialScoringInput
from app.models.investment_account import InvestmentAccount, InvestmentHolding
from app.models.investor_profile import ExperienceLevel, InvestorProfile
from app.models.risk_model import RiskModel
from app.portfolio_analysis import service as portfolio_service

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


def _get_age_tier(dob: date) -> tuple[int, str]:
    today = date.today()
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    if age < 18:
        return age, "minor"
    if age <= 25:
        return age, "young_adult"
    if age <= 45:
        return age, "adult"
    if age <= 60:
        return age, "pre_retirement"
    return age, "retirement"


def _compute_allocation(
    risk_modifier: str,
    experience_level: ExperienceLevel,
    age_tier: str,
) -> tuple[float, float, float, float]:
    if age_tier == "minor":
        return _MINOR_ALLOCATION

    low_pct, growth_pct, high_pct, max_drawdown_pct = _ALLOCATION_TABLE[
        (risk_modifier, experience_level.value)
    ]

    # Age 60+ bias: shift 10% from growth/high-risk to low-risk
    if age_tier == "retirement":
        shift = min(10.0, growth_pct + high_pct)
        growth_reduction = min(shift, growth_pct)
        high_reduction = min(shift - growth_reduction, high_pct)
        low_pct += growth_reduction + high_reduction
        growth_pct -= growth_reduction
        high_pct -= high_reduction
        max_drawdown_pct = max(5.0, max_drawdown_pct - 5.0)

    # Age 46-60: moderate conservative tilt
    elif age_tier == "pre_retirement":
        shift = min(5.0, high_pct)
        low_pct += shift
        high_pct -= shift

    return (low_pct, growth_pct, high_pct, max_drawdown_pct)


def _compute_enforcement(
    stability_score: int,
    risk_modifier: str,
    experience_level: ExperienceLevel,
    age_tier: str,
) -> dict:
    if age_tier == "minor":
        return {
            "allowed_strategy_families": ["education"],
            "blocked_strategy_families": ["conservative", "balanced", "growth", "aggressive", "crypto"],
            "live_trading_allowed": False,
            "requires_paper_trading": True,
            "max_trade_size_pct": 0.0,
            "max_open_positions": 0,
        }

    if risk_modifier == "reduce" or stability_score < 30:
        allowed = ["conservative", "education"]
        blocked = ["growth", "aggressive", "crypto"]
    elif risk_modifier == "neutral":
        if age_tier in ("retirement", "pre_retirement"):
            allowed = ["conservative", "balanced"]
            blocked = ["aggressive", "crypto"]
        else:
            allowed = ["conservative", "balanced", "growth"]
            blocked = ["aggressive", "crypto"]
    else:  # allow_growth
        if age_tier in ("retirement", "pre_retirement"):
            allowed = ["conservative", "balanced", "growth"]
            blocked = ["aggressive", "crypto"]
        elif experience_level == ExperienceLevel.advanced:
            allowed = ["conservative", "balanced", "growth", "aggressive"]
            blocked = ["crypto"]
        else:
            allowed = ["conservative", "balanced", "growth"]
            blocked = ["aggressive", "crypto"]

    live_trading_allowed = (
        age_tier != "minor"
        and stability_score >= 50
        and experience_level != ExperienceLevel.beginner
        and risk_modifier != "reduce"
    )

    requires_paper_trading = (
        experience_level == ExperienceLevel.beginner
        or stability_score < 60
        or risk_modifier == "reduce"
    )

    if stability_score >= 70:
        max_trade_size_pct = 10.0
    elif stability_score >= 50:
        max_trade_size_pct = 5.0
    else:
        max_trade_size_pct = 2.0

    if experience_level == ExperienceLevel.advanced and stability_score >= 60:
        max_open_positions = 10
    elif experience_level == ExperienceLevel.intermediate and stability_score >= 50:
        max_open_positions = 5
    else:
        max_open_positions = 3

    return {
        "allowed_strategy_families": allowed,
        "blocked_strategy_families": blocked,
        "live_trading_allowed": live_trading_allowed,
        "requires_paper_trading": requires_paper_trading,
        "max_trade_size_pct": max_trade_size_pct,
        "max_open_positions": max_open_positions,
    }


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

    age, age_tier = _get_age_tier(investor.date_of_birth)

    manual_assets = sum(a.current_value for a in fp.assets)
    total_liabilities = sum(l.outstanding_balance for l in fp.liabilities)

    # Use the portfolio service (live prices + FX conversion) for an accurate
    # investment total in base currency. Falls back to 0 if portfolio is empty.
    portfolio = portfolio_service.get_portfolio(db, investor_id)
    investment_total = portfolio.total_current_value if portfolio else 0.0

    total_assets = manual_assets + investment_total
    total_net_worth = total_assets - total_liabilities
    _LOCKED_TYPES = {"pension", "vehicle"}
    liquid_capital = fp.liquid_savings + sum(
        a.current_value for a in fp.assets
        if a.is_liquid and a.asset_type.value not in _LOCKED_TYPES
    )
    investable_capital = round(liquid_capital * fp.investable_capital_pct / 100, 2)

    # Emergency fund: sum holding-level flags first (more granular), then fall back
    # to account-level flags if no individual holdings are marked.
    # Takes the higher of computed vs manually entered emergency_fund_months.
    ef_months = fp.emergency_fund_months

    ef_holdings = (
        db.query(InvestmentHolding)
        .join(InvestmentAccount, InvestmentHolding.account_id == InvestmentAccount.id)
        .filter(
            InvestmentAccount.investor_id == investor_id,
            InvestmentHolding.is_emergency_fund.is_(True),
        )
        .all()
    )

    if not ef_holdings:
        # Fallback: account-level flag
        ef_accounts = (
            db.query(InvestmentAccount)
            .filter(
                InvestmentAccount.investor_id == investor_id,
                InvestmentAccount.is_emergency_fund.is_(True),
            )
            .all()
        )
        ef_holdings = [h for acc in ef_accounts for h in acc.holdings]

    if ef_holdings and fp.monthly_expenses > 0:
        ef_total = 0.0
        for h in ef_holdings:
            # Use portfolio analysis value if available (live price), else stored values
            if portfolio:
                for acc_analysis in portfolio.accounts:
                    ha = next((ha for ha in acc_analysis.holdings if str(ha.id) == str(h.id)), None)
                    if ha:
                        ef_total += ha.current_value_base
                        break
            else:
                val = h.current_balance or h.current_value or 0.0
                ef_total += val
        computed = ef_total / fp.monthly_expenses
        ef_months = max(ef_months, computed)

    scoring_input = FinancialScoringInput(
        monthly_income=fp.monthly_income,
        monthly_expenses=fp.monthly_expenses,
        emergency_fund_months=ef_months,
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
        age_tier=age_tier,
    )

    enforcement = _compute_enforcement(
        stability_score=score_result.score,
        risk_modifier=score_result.risk_modifier,
        experience_level=investor.experience_level,
        age_tier=age_tier,
    )

    rm = RiskModel(
        investor_profile_id=investor_id,
        stability_score=score_result.score,
        stability_classification=score_result.classification,
        age_tier=age_tier,
        total_net_worth=total_net_worth,
        liquid_capital=liquid_capital,
        investable_capital=investable_capital,
        low_risk_pct=low_risk_pct,
        growth_pct=growth_pct,
        high_risk_pct=high_risk_pct,
        max_drawdown_pct=max_drawdown_pct,
        currency=fp.currency,
        **enforcement,
    )
    db.add(rm)
    db.flush()
    audit.log_event(
        db,
        event_type="risk_model.generated",
        description=(
            f"Risk model generated: score={score_result.score} "
            f"({score_result.classification}), age_tier={age_tier}, "
            f"investable={investable_capital} {fp.currency}"
        ),
        investor_profile_id=investor_id,
        metadata={
            "risk_model_id": str(rm.id),
            "stability_score": score_result.score,
            "risk_modifier": score_result.risk_modifier,
            "age_tier": age_tier,
            "low_risk_pct": low_risk_pct,
            "growth_pct": growth_pct,
            "high_risk_pct": high_risk_pct,
            "live_trading_allowed": enforcement["live_trading_allowed"],
            "requires_paper_trading": enforcement["requires_paper_trading"],
        },
    )
    db.commit()
    db.refresh(rm)
    return rm

from app.financial_decision.schemas import InvestmentDecision
from app.models.financial_profile import FinancialProfile
from app.models.financial_goal import FinancialGoal
from app.models.investor_profile import InvestorProfile
from app.models.risk_model import RiskModel


def evaluate(
    investor: InvestorProfile,
    financial_profile: FinancialProfile | None,
    risk_model: RiskModel | None,
    goals: list[FinancialGoal],
) -> InvestmentDecision:
    blocked_actions: list[str] = []
    required_actions: list[str] = []
    warnings: list[str] = []

    # ── No financial profile → cannot invest ─────────────────────────────────
    if financial_profile is None:
        return InvestmentDecision(
            can_invest=False,
            readiness_classification="not_ready",
            recommended_investment_pct=0.0,
            max_high_risk_pct=0.0,
            blocked_actions=["all_investing"],
            required_actions=["complete_financial_profile"],
            warnings=[],
            explanation=(
                "No financial profile found. Complete your income, expenses, and savings "
                "data before the system can evaluate your investment readiness."
            ),
        )

    fp = financial_profile
    total_liabilities = sum(l.outstanding_balance for l in fp.liabilities)
    total_monthly_debt = sum(l.monthly_payment for l in fp.liabilities)
    debt_to_income_pct = (
        (total_monthly_debt / fp.monthly_income * 100) if fp.monthly_income > 0 else 0.0
    )

    # ── Minor / education-only ────────────────────────────────────────────────
    is_minor = investor.is_minor or (risk_model and risk_model.age_tier == "minor")
    is_education_goal = investor.investment_goal == "education"

    if is_minor or is_education_goal:
        reason = "You are in education-only mode" if is_minor else "Your goal is set to education"
        return InvestmentDecision(
            can_invest=True,
            readiness_classification="education_only",
            recommended_investment_pct=0.0,
            max_high_risk_pct=0.0,
            blocked_actions=["live_trading", "real_money_strategies"],
            required_actions=[],
            warnings=[],
            explanation=(
                f"{reason}. Only educational content and paper trading simulations are available. "
                "No real investment actions are permitted."
            ),
        )

    # ── Stability-based gates ─────────────────────────────────────────────────
    stability_score = risk_model.stability_score if risk_model else 0

    if stability_score < 30:
        required_actions.append("improve_financial_stability")
        if fp.emergency_fund_months < 1:
            required_actions.append("build_emergency_fund")
        return InvestmentDecision(
            can_invest=False,
            readiness_classification="not_ready",
            recommended_investment_pct=0.0,
            max_high_risk_pct=0.0,
            blocked_actions=["all_investing"],
            required_actions=required_actions,
            warnings=[f"Financial stability score is very low ({stability_score}/100)"],
            explanation=(
                f"Your financial stability score ({stability_score}/100) is too low to invest safely. "
                "Focus on building an emergency fund, reducing debt, and stabilizing income first."
            ),
        )

    if fp.emergency_fund_months < 1:
        return InvestmentDecision(
            can_invest=False,
            readiness_classification="not_ready",
            recommended_investment_pct=0.0,
            max_high_risk_pct=0.0,
            blocked_actions=["all_investing"],
            required_actions=["build_emergency_fund"],
            warnings=["No emergency fund — investing is not safe at this stage"],
            explanation=(
                "You have less than 1 month of emergency savings. Building an emergency fund "
                "is a prerequisite before any investment activity."
            ),
        )

    # ── Compute recommended allocation ────────────────────────────────────────
    if risk_model:
        recommended_investment_pct = risk_model.investable_capital / max(
            (fp.liquid_savings + sum(a.current_value for a in fp.assets if a.is_liquid)), 1
        ) * 100
        recommended_investment_pct = min(round(recommended_investment_pct, 1), 100.0)
        max_high_risk_pct = risk_model.high_risk_pct
    else:
        # Conservative default when no risk model exists yet
        recommended_investment_pct = 10.0
        max_high_risk_pct = 0.0
        warnings.append("No risk model generated yet — using conservative defaults")

    # ── Readiness classification ──────────────────────────────────────────────
    has_limits = (
        stability_score < 60
        or debt_to_income_pct > 40.0
        or fp.emergency_fund_months < 3
    )

    if has_limits:
        readiness_classification = "ready_with_limits"
        if debt_to_income_pct > 40.0:
            warnings.append(f"High debt-to-income ratio ({debt_to_income_pct:.0f}%)")
            required_actions.append("reduce_debt")
        if fp.emergency_fund_months < 3:
            warnings.append(
                f"Emergency fund is only {fp.emergency_fund_months:.1f} months (target: 3+)"
            )
            required_actions.append("grow_emergency_fund")
        if stability_score < 60:
            warnings.append(f"Stability score is moderate ({stability_score}/100)")
    else:
        readiness_classification = "ready"

    # ── Blocked actions from risk model enforcement ───────────────────────────
    if risk_model:
        if not risk_model.live_trading_allowed:
            blocked_actions.append("live_trading")
        if "aggressive" in risk_model.blocked_strategy_families:
            blocked_actions.append("aggressive_strategies")
        if "crypto" in risk_model.blocked_strategy_families:
            blocked_actions.append("crypto_strategies")
        if risk_model.requires_paper_trading:
            required_actions.append("complete_paper_trading_first")

    # ── Explanation ───────────────────────────────────────────────────────────
    tier_label = {
        "ready": "You are ready to invest",
        "ready_with_limits": "You can invest with certain limits in place",
    }[readiness_classification]

    explanation_parts = [
        f"{tier_label}. Stability score: {stability_score}/100.",
    ]
    if warnings:
        explanation_parts.append("Warnings: " + "; ".join(warnings) + ".")
    if blocked_actions:
        explanation_parts.append(
            "Blocked: " + ", ".join(blocked_actions).replace("_", " ") + "."
        )
    if required_actions:
        explanation_parts.append(
            "Required next steps: " + ", ".join(required_actions).replace("_", " ") + "."
        )

    return InvestmentDecision(
        can_invest=True,
        readiness_classification=readiness_classification,
        recommended_investment_pct=recommended_investment_pct,
        max_high_risk_pct=max_high_risk_pct,
        blocked_actions=blocked_actions,
        required_actions=required_actions,
        warnings=warnings,
        explanation=" ".join(explanation_parts),
    )

from app.models.financial_profile import IncomeTrend, JobStability
from app.financial_scoring.schemas import FinancialScoringInput, FinancialStabilityScore

_JOB_STABILITY_POINTS: dict[JobStability, int] = {
    JobStability.stable: 10,
    JobStability.freelance: 6,
    JobStability.unstable: 3,
    JobStability.unemployed: 0,
}

_INCOME_TREND_POINTS: dict[IncomeTrend, int] = {
    IncomeTrend.growing: 5,
    IncomeTrend.stable: 3,
    IncomeTrend.declining: 0,
}


def calculate_stability_score(data: FinancialScoringInput) -> FinancialStabilityScore:
    points = 0
    recommendations: list[str] = []

    # 1. Income / Expense ratio (0–25 pts)
    if data.monthly_expenses > 0 and data.monthly_income > 0:
        ratio = data.monthly_income / data.monthly_expenses
        if ratio >= 2.0:
            points += 25
        elif ratio >= 1.5:
            points += 20
        elif ratio >= 1.2:
            points += 15
        elif ratio >= 1.0:
            points += 10
        else:
            recommendations.append(
                "Achieve positive monthly cash flow before starting any investment plan."
            )
    elif data.monthly_income == 0:
        recommendations.append(
            "Establish a stable income source before investing."
        )

    # 2. Emergency fund (0–20 pts)
    efm = data.emergency_fund_months
    if efm >= 6:
        points += 20
    elif efm >= 3:
        points += 15
    elif efm >= 1:
        points += 8
    else:
        recommendations.append(
            "Build an emergency fund covering at least 3–6 months of expenses before investing."
        )

    # 3. Debt-to-income ratio (0–20 pts)
    if data.monthly_income > 0:
        dti = data.total_monthly_debt_payments / data.monthly_income
        if dti < 0.15:
            points += 20
        elif dti < 0.25:
            points += 15
        elif dti < 0.35:
            points += 10
        elif dti < 0.50:
            points += 5
        else:
            recommendations.append(
                "Your debt payments exceed 50% of income — prioritize debt reduction before aggressive investments."
            )

    # 4. Net worth position (0–15 pts)
    net_worth = data.total_assets - data.total_liabilities
    if net_worth > data.monthly_income * 12:
        points += 15
    elif net_worth > 0:
        points += 8
    elif net_worth == 0:
        points += 3
    else:
        recommendations.append(
            "Focus on building positive net worth; liabilities exceed assets."
        )

    # 5. Job stability (0–10 pts)
    job_pts = _JOB_STABILITY_POINTS[data.job_stability]
    points += job_pts
    if job_pts < 5:
        recommendations.append(
            "Unstable income increases financial risk — consider stabilizing your income before increasing exposure."
        )

    # 6. Income trend (0–5 pts)
    trend_pts = _INCOME_TREND_POINTS[data.income_trend]
    points += trend_pts
    if trend_pts == 0:
        recommendations.append(
            "Declining income trend detected — address this before increasing financial commitments."
        )

    # 7. Savings rate (0–5 pts)
    if data.monthly_income > 0:
        savings_rate = (data.monthly_income - data.monthly_expenses) / data.monthly_income
        if savings_rate >= 0.20:
            points += 5
        elif savings_rate >= 0.10:
            points += 3
        elif savings_rate >= 0.05:
            points += 1

    score = min(points, 100)

    # Classification
    if score <= 30:
        classification = "unstable"
        risk_modifier = "reduce"
    elif score <= 55:
        classification = "fragile"
        risk_modifier = "reduce"
    elif score <= 75:
        classification = "stable"
        risk_modifier = "neutral"
    else:
        classification = "strong"
        risk_modifier = "allow_growth"

    # Dependents override: downgrade risk modifier if family obligations are high
    if data.dependents_count >= 3 and data.emergency_fund_months < 3:
        recommendations.append(
            "With multiple dependents, a 6-month emergency fund is strongly recommended before any investment."
        )
        if risk_modifier in ("neutral", "allow_growth"):
            risk_modifier = "reduce"

    return FinancialStabilityScore(
        score=score,
        classification=classification,
        risk_modifier=risk_modifier,
        recommendations=recommendations,
    )

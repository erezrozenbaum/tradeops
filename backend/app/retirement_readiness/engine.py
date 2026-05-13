"""Pure retirement readiness scoring engine — no DB access."""
import math
import uuid
from datetime import datetime, timezone

from app.retirement_readiness.schemas import ReadinessScore

_SWR = 0.04          # 4% safe withdrawal rate
_GROWTH_RATE = 0.07  # 7% assumed annual portfolio growth for years_to_close_gap


def compute_score(
    investor_id: uuid.UUID,
    pension_projected: float,
    portfolio_mc_p50: float,
    monthly_expenses: float,
    years_to_retirement: float,
    currency: str,
) -> ReadinessScore:
    total_at_retirement = pension_projected + portfolio_mc_p50

    projected_monthly_income = (total_at_retirement * _SWR) / 12.0
    gap_monthly = projected_monthly_income - monthly_expenses

    # Score 0-100 based on income coverage ratio
    if monthly_expenses > 0:
        ratio = projected_monthly_income / monthly_expenses
    elif projected_monthly_income > 0:
        ratio = 1.5  # income exists, no expense baseline → assume comfortable
    else:
        ratio = 0.0

    if ratio >= 1.5:
        score = 100
    elif ratio >= 1.0:
        score = int(75 + (ratio - 1.0) / 0.5 * 25)
    elif ratio >= 0.5:
        score = int(25 + (ratio - 0.5) / 0.5 * 50)
    else:
        score = int(ratio / 0.5 * 25)

    score = max(0, min(100, score))

    if score >= 80:
        verdict = "On track"
    elif score >= 60:
        verdict = "Mostly on track"
    elif score >= 40:
        verdict = "At risk"
    elif score >= 20:
        verdict = "Significant gap"
    else:
        verdict = "Critical shortfall"

    # Extra years at 7% growth needed to cover shortfall
    years_to_close_gap: int | None = None
    if gap_monthly < 0 and total_at_retirement > 0 and monthly_expenses > 0:
        target_corpus = monthly_expenses * 12.0 / _SWR  # = expenses * 300
        if target_corpus > total_at_retirement:
            years_to_close_gap = math.ceil(
                math.log(target_corpus / total_at_retirement) / math.log(1.0 + _GROWTH_RATE)
            )

    return ReadinessScore(
        investor_id=investor_id,
        score=score,
        verdict=verdict,
        projected_monthly_income=round(projected_monthly_income, 2),
        monthly_expenses=round(monthly_expenses, 2),
        gap_monthly=round(gap_monthly, 2),
        total_at_retirement=round(total_at_retirement, 2),
        pension_projected=round(pension_projected, 2),
        portfolio_mc_p50=round(portfolio_mc_p50, 2),
        years_to_retirement=round(years_to_retirement, 1),
        years_to_close_gap=years_to_close_gap,
        swr_pct=_SWR * 100,
        currency=currency,
        computed_at=datetime.now(timezone.utc),
    )

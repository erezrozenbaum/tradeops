"""Pure monthly income distribution logic — no external dependencies."""
from app.income_projection.schemas import DividendHolding


def monthly_distribution(holdings: list[DividendHolding]) -> dict[int, float]:
    """
    Distribute each holding's annual income across 12 calendar months.

    Quarterly: 4 equal payments every 3 months starting from ex-date month.
    Monthly: equal 1/12 slice every month.
    Annual: full payment in ex-date month.
    Unknown: treated as quarterly.
    """
    monthly: dict[int, float] = {m: 0.0 for m in range(1, 13)}
    for h in holdings:
        if h.annual_income <= 0:
            continue
        freq = h.pay_frequency
        ex_month = h.next_ex_date.month if h.next_ex_date else None

        if freq == "monthly":
            per_month = h.annual_income / 12
            for m in range(1, 13):
                monthly[m] += per_month
        elif freq == "annual":
            m = ex_month or 6
            monthly[m] += h.annual_income
        else:
            # Quarterly (default for "unknown" as well)
            start = ex_month or 3
            per_payment = h.annual_income / 4
            for i in range(4):
                m = ((start - 1 + i * 3) % 12) + 1
                monthly[m] += per_payment

    return {k: round(v, 2) for k, v in monthly.items()}

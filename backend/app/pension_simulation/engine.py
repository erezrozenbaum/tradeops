"""
Pension fund projection engine — pure math, no DB access.

Uses standard future-value formula with monthly compounding:
  FV_balance      = current_balance × (1 + r)^n
  FV_contributions = monthly_contribution × ((1+r)^n - 1) / r   [if r > 0]
                   = monthly_contribution × n                     [if r == 0]
  projected_balance = FV_balance + FV_contributions
  monthly_pension   = projected_balance / (withdrawal_years × 12)
"""


def simulate(
    current_balance: float,
    current_age: float,
    retirement_age: int,
    monthly_contribution: float,
    annual_return_rate_pct: float,
    withdrawal_years: int = 25,
    management_fee_balance_pct: float = 0.0,
    management_fee_contribution_pct: float = 0.0,
) -> dict:
    years = max(0.0, retirement_age - current_age)
    months = years * 12
    net_rate = annual_return_rate_pct - management_fee_balance_pct
    monthly_after_fee = monthly_contribution * (1.0 - management_fee_contribution_pct / 100.0)
    r = net_rate / 100 / 12  # monthly rate

    if r > 0:
        growth = (1 + r) ** months
        fv_balance = current_balance * growth
        fv_contributions = monthly_after_fee * (growth - 1) / r
    else:
        fv_balance = current_balance
        fv_contributions = monthly_after_fee * months

    projected = fv_balance + fv_contributions
    contributions_added = monthly_after_fee * months
    gains = projected - current_balance - contributions_added
    monthly_pension = projected / (withdrawal_years * 12) if withdrawal_years > 0 else 0.0

    return {
        "years_to_retirement": round(years, 1),
        "months_to_retirement": int(months),
        "projected_balance": round(projected, 2),
        "projected_from_current_balance": round(fv_balance, 2),
        "projected_from_contributions": round(fv_contributions, 2),
        "total_contributions_added": round(contributions_added, 2),
        "total_gains": round(gains, 2),
        "monthly_pension_estimate": round(monthly_pension, 2),
    }

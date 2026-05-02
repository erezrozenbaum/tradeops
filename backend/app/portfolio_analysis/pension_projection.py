"""Pure pension/study-fund projection engine — no DB access."""
from app.models.investment_account import InvestmentAccount

RETIREMENT_AGE = 67
_PENSION_TYPES = {"pension_fund", "study_fund"}
_DEFAULT_RETURN_PCT = 5.0


def _fv(balance: float, monthly: float, annual_rate_pct: float, months: int) -> float:
    if months <= 0:
        return balance
    if annual_rate_pct <= 0:
        return round(balance + monthly * months, 2)
    r = annual_rate_pct / 100.0 / 12.0
    growth = (1 + r) ** months
    return round(balance * growth + monthly * ((growth - 1) / r), 2)


def project(
    investor_age: float,
    accounts: list[InvestmentAccount],
    base_currency: str,
    convert_fn,
) -> dict:
    months = max(0, int((RETIREMENT_AGE - investor_age) * 12))
    years = round(months / 12, 1)

    funds = []
    for account in accounts:
        for h in account.holdings:
            if h.asset_type not in _PENSION_TYPES:
                continue

            balance = h.current_balance or (h.quantity * h.avg_buy_price)

            if h.asset_type == "study_fund":
                monthly = (h.monthly_contribution_employee or 0.0) + (h.monthly_contribution_employer or 0.0)
            else:
                monthly = h.monthly_contribution or 0.0

            rate = h.annual_return_rate if h.annual_return_rate is not None else _DEFAULT_RETURN_PCT
            projected = _fv(balance, monthly, rate, months)

            def _cvt(amount: float, ccy: str) -> float:
                if ccy == base_currency or amount == 0:
                    return amount
                try:
                    return convert_fn(amount, ccy, base_currency)
                except Exception:
                    return amount

            funds.append({
                "name": h.name,
                "asset_type": h.asset_type,
                "current_balance": round(_cvt(balance, h.currency), 2),
                "monthly_contribution": round(_cvt(monthly, h.currency), 2),
                "annual_return_pct": rate,
                "projected_value": round(_cvt(projected, h.currency), 2),
                "currency": base_currency,
            })

    return {
        "funds": funds,
        "total_projected_value": round(sum(f["projected_value"] for f in funds), 2),
        "total_monthly_contribution": round(sum(f["monthly_contribution"] for f in funds), 2),
        "currency": base_currency,
        "years_to_retirement": years,
        "retirement_age": RETIREMENT_AGE,
        "has_data": len(funds) > 0,
    }

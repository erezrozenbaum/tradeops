"""Debt payoff planner — avalanche (highest rate first) or snowball (lowest balance first)."""
import uuid
from datetime import date, timedelta
from typing import Literal

from app.debt_planner.schemas import DebtItem, DebtPlanResult
from app.models.financial_profile import FinancialLiability


def compute_plan(
    liabilities: list[FinancialLiability],
    strategy: Literal["avalanche", "snowball"],
    extra_monthly: float,
    base_currency: str,
) -> DebtPlanResult:
    if not liabilities:
        return DebtPlanResult(
            strategy=strategy,
            total_debt=0.0,
            currency=base_currency,
            monthly_minimum=0.0,
            extra_monthly=extra_monthly,
            effective_monthly=extra_monthly,
            months_to_debt_free=0,
            debt_free_date=date.today(),
            total_interest_paid=0.0,
            total_paid=0.0,
            debts=[],
            no_debts=True,
        )

    # Normalise: treat missing interest rate as 0
    debts = [
        {
            "id": lib.id,
            "name": lib.name,
            "type": lib.liability_type.value if hasattr(lib.liability_type, "value") else lib.liability_type,
            "balance": float(lib.outstanding_balance),
            "payment": float(lib.monthly_payment) if lib.monthly_payment else 0.0,
            "rate": float(lib.interest_rate_pct or 0.0),
            "currency": lib.currency,
            "interest_paid": 0.0,
            "payoff_month": None,
        }
        for lib in liabilities
        if lib.outstanding_balance > 0
    ]

    if not debts:
        return DebtPlanResult(
            strategy=strategy,
            total_debt=0.0,
            currency=base_currency,
            monthly_minimum=0.0,
            extra_monthly=extra_monthly,
            effective_monthly=extra_monthly,
            months_to_debt_free=0,
            debt_free_date=date.today(),
            total_interest_paid=0.0,
            total_paid=0.0,
            debts=[],
            no_debts=True,
        )

    total_debt = sum(d["balance"] for d in debts)
    monthly_minimum = sum(d["payment"] for d in debts)
    effective_monthly = monthly_minimum + extra_monthly

    # Sort by strategy: avalanche = highest rate first; snowball = lowest balance first
    if strategy == "avalanche":
        priority_order = sorted(range(len(debts)), key=lambda i: -debts[i]["rate"])
    else:
        priority_order = sorted(range(len(debts)), key=lambda i: debts[i]["balance"])

    # Simulate month-by-month payoff
    balances = [d["balance"] for d in debts]
    interest_paid = [0.0] * len(debts)
    month = 0
    max_months = 600  # 50-year cap

    while any(b > 0.001 for b in balances) and month < max_months:
        month += 1
        # Accrue interest and apply minimum payments
        for i, d in enumerate(debts):
            if balances[i] <= 0:
                continue
            monthly_rate = d["rate"] / 100 / 12
            interest = balances[i] * monthly_rate
            interest_paid[i] += interest
            balances[i] += interest
            payment = min(d["payment"], balances[i])
            balances[i] -= payment
            balances[i] = max(balances[i], 0.0)

        # Apply extra payment to the priority debt
        extra = extra_monthly
        for i in priority_order:
            if balances[i] <= 0:
                continue
            applied = min(extra, balances[i])
            balances[i] -= applied
            balances[i] = max(balances[i], 0.0)
            extra -= applied
            if extra <= 0:
                break

        # Mark debts paid off this month
        for i, d in enumerate(debts):
            if d["payoff_month"] is None and balances[i] <= 0.001:
                d["payoff_month"] = month

    # Build result
    today = date.today()
    result_debts = []
    for rank, i in enumerate(priority_order):
        d = debts[i]
        payoff_months = d["payoff_month"] or month
        payoff_date = today + timedelta(days=payoff_months * 30)
        result_debts.append(
            DebtItem(
                id=d["id"],
                name=d["name"],
                liability_type=d["type"],
                outstanding_balance=d["balance_orig"] if "balance_orig" in d else liabilities[i].outstanding_balance,
                monthly_payment=d["payment"],
                interest_rate_pct=d["rate"],
                currency=d["currency"],
                priority=rank + 1,
                payoff_months=payoff_months,
                payoff_date=payoff_date,
                total_interest=round(interest_paid[i], 2),
            )
        )
    # Sort result by priority
    result_debts.sort(key=lambda x: x.priority)

    # Fix outstanding_balance from original liabilities
    for item in result_debts:
        orig = next((lib for lib in liabilities if lib.id == item.id), None)
        if orig:
            item.outstanding_balance = float(orig.outstanding_balance)

    total_interest = sum(interest_paid)
    debt_free = today + timedelta(days=month * 30)

    return DebtPlanResult(
        strategy=strategy,
        total_debt=total_debt,
        currency=base_currency,
        monthly_minimum=monthly_minimum,
        extra_monthly=extra_monthly,
        effective_monthly=effective_monthly,
        months_to_debt_free=month,
        debt_free_date=debt_free,
        total_interest_paid=round(total_interest, 2),
        total_paid=round(total_debt + total_interest, 2),
        debts=result_debts,
        no_debts=False,
    )

"""
Simulation engine — pure math, no DB access.

Deterministic scenarios (debt_payoff, savings_increase, job_loss):
  p10 = p50 = p90 (single trajectory, no variance)

Monte Carlo scenarios (market_crash, retirement, custom):
  1 000 seeded iterations → p10 / p50 / p90 at each month
  random_seed stored on the run for full reproducibility
"""
from __future__ import annotations

import math
import random
from typing import Any

DISCLAIMER = (
    "This simulation is for educational and illustrative purposes only. "
    "It does not constitute financial advice or a projection of future returns. "
    "Past performance is not indicative of future results. "
    "All values are hypothetical and based on simplified mathematical models."
)

_N_ITER = 1000


# ─── Shared helpers ───────────────────────────────────────────────────────────

def _percentiles(values: list[float]) -> tuple[float, float, float]:
    s = sorted(values)
    n = len(s)
    return (
        s[max(0, int(n * 0.10) - 1)],
        s[int(n * 0.50)],
        s[min(n - 1, int(n * 0.90))],
    )


def _det_point(month: int, value: float) -> dict[str, Any]:
    v = round(value, 2)
    return {"month": month, "p10": v, "p50": v, "p90": v}


# ─── Deterministic scenarios ──────────────────────────────────────────────────

def run_debt_payoff(
    initial_portfolio: float,
    liquid_savings: float,
    debt_balance: float,
    interest_rate_pct: float,
    current_monthly_payment: float,
    extra_monthly_payment: float,
    horizon_months: int,
    annual_return_rate_pct: float = 5.0,
) -> dict[str, Any]:
    """Net worth trajectory with accelerated debt payoff.

    After debt clears, freed monthly payment compounds as portfolio savings.
    """
    r_debt = interest_rate_pct / 100 / 12
    r_inv = annual_return_rate_pct / 100 / 12
    total_payment = current_monthly_payment + extra_monthly_payment

    debt = debt_balance
    savings = liquid_savings + initial_portfolio
    traj = []

    for m in range(horizon_months + 1):
        traj.append(_det_point(m, savings - debt))
        if m < horizon_months:
            if debt > 0:
                interest = debt * r_debt
                principal = min(total_payment - interest, debt)
                debt = max(0.0, debt - principal)
            else:
                savings = (savings * (1 + r_inv) + total_payment) if r_inv > 0 else (savings + total_payment)

    start, final = traj[0]["p50"], traj[-1]["p50"]
    return {
        "trajectory": traj,
        "final_p10": final,
        "final_p50": final,
        "final_p90": final,
        "probability_positive": 1.0 if final > start else 0.0,
        "is_monte_carlo": False,
        "iterations": 1,
    }


def run_savings_increase(
    initial: float,
    monthly_savings_increase: float,
    annual_return_rate_pct: float,
    horizon_months: int,
) -> dict[str, Any]:
    """FV trajectory with a fixed additional monthly savings contribution."""
    r = annual_return_rate_pct / 100 / 12
    v = initial
    traj = []
    for m in range(horizon_months + 1):
        traj.append(_det_point(m, v))
        v = (v * (1 + r) + monthly_savings_increase) if r > 0 else (v + monthly_savings_increase)

    final = traj[-1]["p50"]
    return {
        "trajectory": traj,
        "final_p10": final,
        "final_p50": final,
        "final_p90": final,
        "probability_positive": 1.0 if final > initial else 0.0,
        "is_monte_carlo": False,
        "iterations": 1,
    }


def run_job_loss(
    monthly_income: float,
    monthly_expenses: float,
    liquid_savings: float,
    income_replacement_pct: float,
    expense_reduction_pct: float,
    horizon_months: int,
) -> dict[str, Any]:
    """Liquid savings drawdown trajectory under reduced income."""
    effective_income = monthly_income * max(0.0, income_replacement_pct)
    effective_expenses = monthly_expenses * max(0.0, 1.0 - expense_reduction_pct)
    monthly_delta = effective_income - effective_expenses

    v = liquid_savings
    traj = []
    for m in range(horizon_months + 1):
        traj.append(_det_point(m, v))
        v += monthly_delta

    final = traj[-1]["p50"]
    return {
        "trajectory": traj,
        "final_p10": final,
        "final_p50": final,
        "final_p90": final,
        "probability_positive": 1.0 if final >= 0 else 0.0,
        "is_monte_carlo": False,
        "iterations": 1,
    }


# ─── Monte Carlo scenarios ────────────────────────────────────────────────────

def run_market_crash(
    initial: float,
    annual_return_rate_pct: float,
    annual_volatility_pct: float,
    crash_drawdown_pct: float,
    crash_probability_pct: float,
    horizon_months: int,
    random_seed: int,
) -> dict[str, Any]:
    """1 000-iteration MC: compound growth with random crash events."""
    rng = random.Random(random_seed)
    r_mean = annual_return_rate_pct / 100 / 12
    r_sigma = annual_volatility_pct / 100 / math.sqrt(12)
    monthly_crash_prob = 1.0 - (1.0 - crash_probability_pct / 100.0) ** (1.0 / 12.0)

    month_values: list[list[float]] = [[initial] * _N_ITER] + [[] for _ in range(horizon_months)]

    for _ in range(_N_ITER):
        v = initial
        for m in range(1, horizon_months + 1):
            v = v * (1 + rng.gauss(r_mean, r_sigma))
            if rng.random() < monthly_crash_prob:
                depth = max(0.0, min(0.8, rng.gauss(crash_drawdown_pct / 100.0, 0.05)))
                v *= (1.0 - depth)
            month_values[m].append(round(max(0.0, v), 2))

    return _mc_result(initial, month_values, horizon_months)


def run_monte_carlo_growth(
    initial: float,
    annual_return_rate_pct: float,
    annual_volatility_pct: float,
    monthly_contribution: float,
    horizon_months: int,
    random_seed: int,
) -> dict[str, Any]:
    """1 000-iteration MC: compound growth with return variance (retirement / custom)."""
    rng = random.Random(random_seed)
    r_mean = annual_return_rate_pct / 100 / 12
    r_sigma = annual_volatility_pct / 100 / math.sqrt(12)

    month_values: list[list[float]] = [[initial] * _N_ITER] + [[] for _ in range(horizon_months)]

    for _ in range(_N_ITER):
        v = initial
        for m in range(1, horizon_months + 1):
            v = v * (1 + rng.gauss(r_mean, r_sigma)) + monthly_contribution
            month_values[m].append(round(v, 2))

    return _mc_result(initial, month_values, horizon_months)


def _mc_result(
    initial: float,
    month_values: list[list[float]],
    horizon_months: int,
) -> dict[str, Any]:
    traj = []
    for m in range(horizon_months + 1):
        p10, p50, p90 = _percentiles(month_values[m])
        traj.append({"month": m, "p10": round(p10, 2), "p50": round(p50, 2), "p90": round(p90, 2)})

    final_vals = month_values[horizon_months]
    prob_pos = round(sum(1 for v in final_vals if v >= initial) / _N_ITER, 3)

    return {
        "trajectory": traj,
        "final_p10": traj[-1]["p10"],
        "final_p50": traj[-1]["p50"],
        "final_p90": traj[-1]["p90"],
        "probability_positive": prob_pos,
        "is_monte_carlo": True,
        "iterations": _N_ITER,
    }

"""Unit tests for the simulation engine — pure math, no DB."""
from app.simulation.engine import (
    run_debt_payoff,
    run_job_loss,
    run_market_crash,
    run_monte_carlo_growth,
    run_savings_increase,
)


def _check_trajectory(traj: list, horizon: int) -> None:
    assert len(traj) == horizon + 1
    assert traj[0]["month"] == 0
    assert traj[-1]["month"] == horizon
    for pt in traj:
        assert pt["p10"] <= pt["p50"] <= pt["p90"] or pt["p10"] == pt["p50"] == pt["p90"]


class TestRunSavingsIncrease:
    def test_basic_growth(self):
        r = run_savings_increase(
            initial=10_000,
            monthly_savings_increase=500,
            annual_return_rate_pct=7.0,
            horizon_months=12,
        )
        _check_trajectory(r["trajectory"], 12)
        assert r["final_p50"] > 10_000
        assert not r["is_monte_carlo"]
        assert r["probability_positive"] == 1.0

    def test_zero_return_rate(self):
        r = run_savings_increase(10_000, 1_000, 0.0, 12)
        assert abs(r["final_p50"] - 22_000) < 1  # 10k + 12×1k

    def test_trajectory_monotone(self):
        r = run_savings_increase(0, 100, 5.0, 24)
        vals = [p["p50"] for p in r["trajectory"]]
        assert all(v2 >= v1 for v1, v2 in zip(vals, vals[1:]))


class TestRunJobLoss:
    def test_full_income_loss_draws_down_savings(self):
        r = run_job_loss(
            monthly_income=5_000,
            monthly_expenses=4_000,
            liquid_savings=20_000,
            income_replacement_pct=0.0,
            expense_reduction_pct=0.0,
            horizon_months=12,
        )
        _check_trajectory(r["trajectory"], 12)
        assert r["final_p50"] < 20_000
        assert not r["is_monte_carlo"]

    def test_partial_replacement_slows_drawdown(self):
        full_loss = run_job_loss(5_000, 4_000, 20_000, 0.0, 0.0, 12)
        partial = run_job_loss(5_000, 4_000, 20_000, 0.5, 0.0, 12)
        assert partial["final_p50"] > full_loss["final_p50"]

    def test_expense_cut_helps(self):
        no_cut = run_job_loss(5_000, 4_000, 20_000, 0.0, 0.0, 12)
        with_cut = run_job_loss(5_000, 4_000, 20_000, 0.0, 0.25, 12)
        assert with_cut["final_p50"] > no_cut["final_p50"]

    def test_negative_outcome_flagged(self):
        r = run_job_loss(0, 5_000, 10_000, 0.0, 0.0, 6)
        assert r["probability_positive"] == 0.0


class TestRunDebtPayoff:
    def test_extra_payment_improves_net_worth(self):
        r = run_debt_payoff(
            initial_portfolio=50_000,
            liquid_savings=10_000,
            debt_balance=20_000,
            interest_rate_pct=5.0,
            current_monthly_payment=400,
            extra_monthly_payment=400,
            horizon_months=60,
        )
        _check_trajectory(r["trajectory"], 60)
        # Net worth should grow over 5 years
        assert r["final_p50"] > r["trajectory"][0]["p50"]
        assert not r["is_monte_carlo"]

    def test_no_debt_free_savings_compound(self):
        r = run_debt_payoff(50_000, 10_000, 0.0, 5.0, 0.0, 500, 24, 7.0)
        vals = [p["p50"] for p in r["trajectory"]]
        assert vals[-1] > vals[0]


class TestMonteCarlo:
    def test_reproducibility(self):
        kwargs = dict(
            initial=100_000,
            annual_return_rate_pct=7.0,
            annual_volatility_pct=15.0,
            monthly_contribution=0,
            horizon_months=12,
            random_seed=42,
        )
        r1 = run_monte_carlo_growth(**kwargs)
        r2 = run_monte_carlo_growth(**kwargs)
        assert r1["final_p50"] == r2["final_p50"]
        assert r1["trajectory"][6]["p10"] == r2["trajectory"][6]["p10"]

    def test_p10_lt_p50_lt_p90(self):
        r = run_monte_carlo_growth(100_000, 7.0, 15.0, 0, 24, random_seed=7)
        assert r["final_p10"] < r["final_p50"] < r["final_p90"]
        assert r["is_monte_carlo"]
        assert r["iterations"] == 1000

    def test_probability_positive_range(self):
        r = run_monte_carlo_growth(100_000, 10.0, 5.0, 0, 12, random_seed=1)
        assert 0.0 <= r["probability_positive"] <= 1.0

    def test_market_crash_lower_p50_than_growth(self):
        base = run_monte_carlo_growth(100_000, 7.0, 10.0, 0, 60, random_seed=99)
        crash = run_market_crash(100_000, 7.0, 10.0, 40.0, 30.0, 60, random_seed=99)
        assert crash["final_p50"] < base["final_p50"]

    def test_market_crash_trajectory_length(self):
        r = run_market_crash(50_000, 5.0, 15.0, 25.0, 10.0, 36, random_seed=42)
        _check_trajectory(r["trajectory"], 36)

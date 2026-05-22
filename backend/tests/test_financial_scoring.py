
from app.models.financial_profile import IncomeTrend, JobStability
from app.financial_scoring.engine import calculate_stability_score
from tests.conftest import make_input


class TestClassification:
    def test_strong_profile_scores_high(self):
        result = calculate_stability_score(make_input(
            monthly_income=20_000,
            monthly_expenses=8_000,
            emergency_fund_months=8,
            total_monthly_debt_payments=200,
            total_assets=500_000,
            total_liabilities=50_000,
            job_stability=JobStability.stable,
            income_trend=IncomeTrend.growing,
        ))
        assert result.classification == "strong"
        assert result.risk_modifier == "allow_growth"
        assert result.score >= 76

    def test_stable_profile(self):
        result = calculate_stability_score(make_input())
        assert result.classification in ("stable", "strong")
        assert result.risk_modifier in ("neutral", "allow_growth")

    def test_fragile_profile(self):
        result = calculate_stability_score(make_input(
            monthly_income=5_000,
            monthly_expenses=4_500,
            emergency_fund_months=1,
            total_monthly_debt_payments=1_000,
            total_assets=10_000,
            total_liabilities=20_000,
            job_stability=JobStability.freelance,
            income_trend=IncomeTrend.stable,
        ))
        assert result.classification in ("fragile", "unstable")
        assert result.risk_modifier == "reduce"

    def test_unstable_profile(self):
        result = calculate_stability_score(make_input(
            monthly_income=3_000,
            monthly_expenses=4_000,
            emergency_fund_months=0,
            total_monthly_debt_payments=1_500,
            total_assets=5_000,
            total_liabilities=30_000,
            job_stability=JobStability.unemployed,
            income_trend=IncomeTrend.declining,
        ))
        assert result.classification == "unstable"
        assert result.risk_modifier == "reduce"
        assert result.score <= 30


class TestRecommendations:
    def test_no_emergency_fund_triggers_recommendation(self):
        result = calculate_stability_score(make_input(emergency_fund_months=0))
        assert any("emergency fund" in r.lower() for r in result.recommendations)

    def test_high_dti_triggers_recommendation(self):
        result = calculate_stability_score(make_input(
            monthly_income=5_000,
            total_monthly_debt_payments=3_000,
        ))
        assert any("debt" in r.lower() for r in result.recommendations)

    def test_negative_cashflow_triggers_recommendation(self):
        result = calculate_stability_score(make_input(
            monthly_income=4_000,
            monthly_expenses=5_000,
        ))
        assert any("cash flow" in r.lower() for r in result.recommendations)

    def test_declining_income_triggers_recommendation(self):
        result = calculate_stability_score(make_input(income_trend=IncomeTrend.declining))
        assert any("declining" in r.lower() for r in result.recommendations)

    def test_unstable_job_triggers_recommendation(self):
        result = calculate_stability_score(make_input(job_stability=JobStability.unemployed))
        assert any("income" in r.lower() or "unstable" in r.lower() for r in result.recommendations)

    def test_many_dependents_no_emergency_fund_downgrades_modifier(self):
        result = calculate_stability_score(make_input(
            monthly_income=15_000,
            monthly_expenses=7_000,
            emergency_fund_months=1,
            dependents_count=4,
            job_stability=JobStability.stable,
            income_trend=IncomeTrend.stable,
        ))
        assert result.risk_modifier == "reduce"
        assert any("dependents" in r.lower() or "family" in r.lower() for r in result.recommendations)


class TestScoreBoundaries:
    def test_score_never_exceeds_100(self):
        result = calculate_stability_score(make_input(
            monthly_income=100_000,
            monthly_expenses=10_000,
            emergency_fund_months=24,
            total_monthly_debt_payments=0,
            total_assets=10_000_000,
            total_liabilities=0,
            job_stability=JobStability.stable,
            income_trend=IncomeTrend.growing,
        ))
        assert result.score <= 100

    def test_score_never_below_zero(self):
        result = calculate_stability_score(make_input(
            monthly_income=0,
            monthly_expenses=5_000,
            emergency_fund_months=0,
            total_monthly_debt_payments=0,
            total_assets=0,
            total_liabilities=0,
            job_stability=JobStability.unemployed,
            income_trend=IncomeTrend.declining,
        ))
        assert result.score >= 0

    def test_deterministic_same_input_same_output(self):
        data = make_input()
        r1 = calculate_stability_score(data)
        r2 = calculate_stability_score(data)
        assert r1.score == r2.score
        assert r1.classification == r2.classification
        assert r1.risk_modifier == r2.risk_modifier

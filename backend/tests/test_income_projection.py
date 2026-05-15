"""Unit tests for income_projection.monthly_distribution — no DB required."""
import uuid
from datetime import date

import pytest

from app.income_projection.distribution import monthly_distribution
from app.income_projection.schemas import DividendHolding

HOLDING_ID = uuid.uuid4()


def _holding(annual_income, frequency, ex_month=None):
    ex_date = date(2025, ex_month, 1) if ex_month else None
    return DividendHolding(
        holding_id=HOLDING_ID,
        name="Test",
        ticker="TST",
        quantity=100,
        annual_dividend_per_share=annual_income / 100,
        annual_income=annual_income,
        yield_on_cost=2.0,
        yield_on_value=2.0,
        next_ex_date=ex_date,
        pay_frequency=frequency,
    )


class TestMonthlyDistribution:
    def test_empty_returns_all_zeros(self):
        result = monthly_distribution([])
        assert set(result.keys()) == set(range(1, 13))
        assert all(v == 0.0 for v in result.values())

    def test_always_returns_12_months(self):
        result = monthly_distribution([_holding(120.0, "monthly")])
        assert len(result) == 12
        assert set(result.keys()) == set(range(1, 13))

    def test_monthly_distributes_evenly(self):
        result = monthly_distribution([_holding(120.0, "monthly")])
        for m in range(1, 13):
            assert result[m] == pytest.approx(10.0, rel=1e-3)

    def test_monthly_sum_equals_annual_income(self):
        result = monthly_distribution([_holding(1200.0, "monthly")])
        assert sum(result.values()) == pytest.approx(1200.0, rel=1e-3)

    def test_annual_places_income_in_ex_month(self):
        result = monthly_distribution([_holding(1200.0, "annual", ex_month=6)])
        assert result[6] == pytest.approx(1200.0, rel=1e-3)
        # All other months are zero
        for m in range(1, 13):
            if m != 6:
                assert result[m] == 0.0

    def test_annual_defaults_to_june_if_no_ex_date(self):
        result = monthly_distribution([_holding(600.0, "annual", ex_month=None)])
        assert result[6] == pytest.approx(600.0, rel=1e-3)

    def test_quarterly_sum_equals_annual_income(self):
        result = monthly_distribution([_holding(400.0, "quarterly", ex_month=3)])
        assert sum(result.values()) == pytest.approx(400.0, rel=1e-3)

    def test_quarterly_has_exactly_4_nonzero_months(self):
        result = monthly_distribution([_holding(400.0, "quarterly", ex_month=3)])
        nonzero = [m for m, v in result.items() if v > 0]
        assert len(nonzero) == 4

    def test_quarterly_payments_are_equal(self):
        result = monthly_distribution([_holding(400.0, "quarterly", ex_month=3)])
        nonzero = [v for v in result.values() if v > 0]
        assert all(abs(v - 100.0) < 0.01 for v in nonzero)

    def test_quarterly_months_spaced_by_three(self):
        result = monthly_distribution([_holding(400.0, "quarterly", ex_month=3)])
        nonzero_months = sorted(m for m, v in result.items() if v > 0)
        # Starting at March (3): 3, 6, 9, 12
        assert nonzero_months == [3, 6, 9, 12]

    def test_quarterly_wraps_year_boundary(self):
        # Start month 11 → 11, 2, 5, 8
        result = monthly_distribution([_holding(400.0, "quarterly", ex_month=11)])
        nonzero_months = sorted(m for m, v in result.items() if v > 0)
        assert nonzero_months == [2, 5, 8, 11]

    def test_unknown_frequency_treated_as_quarterly(self):
        r_unknown = monthly_distribution([_holding(400.0, "unknown", ex_month=3)])
        r_quarterly = monthly_distribution([_holding(400.0, "quarterly", ex_month=3)])
        assert r_unknown == r_quarterly

    def test_multiple_holdings_sum_correctly(self):
        holdings = [
            _holding(120.0, "monthly"),         # 10/month
            _holding(400.0, "quarterly", ex_month=3),  # 100 in months 3,6,9,12
        ]
        result = monthly_distribution(holdings)
        # Month 3 should be: 10 (monthly) + 100 (quarterly) = 110
        assert result[3] == pytest.approx(110.0, rel=1e-3)
        # Month 1 should be just 10 (monthly only)
        assert result[1] == pytest.approx(10.0, rel=1e-3)
        # Total sum
        assert sum(result.values()) == pytest.approx(520.0, rel=1e-3)

    def test_zero_income_holding_excluded(self):
        holdings = [
            _holding(0.0, "quarterly", ex_month=3),
            _holding(120.0, "monthly"),
        ]
        result = monthly_distribution(holdings)
        assert sum(result.values()) == pytest.approx(120.0, rel=1e-3)

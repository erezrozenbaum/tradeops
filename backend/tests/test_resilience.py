"""Tests for resilience engine (pure logic — no DB, no Claude API)."""
import uuid
from types import SimpleNamespace

import pytest

from app.resilience.engine import (
    _survival_score,
    _survival_verdict,
    simulate_depletion,
    compute_resilience,
)
from app.resilience.schemas import LifeEventRequest, ResilienceResult
from app.liquidity_runway.schemas import LiquidityHolding


# ── Helpers ───────────────────────────────────────────────────────────────────

def _holding(
    *,
    name="VTI",
    ticker="VTI",
    asset_type="etf",
    gross=10_000.0,
    tax=250.0,
    impact=50.0,
    tier=1,
    tier_label="T+2 Settlement",
    hid=None,
):
    net = max(0.0, gross - tax - impact)
    return LiquidityHolding(
        holding_id=hid or uuid.uuid4(),
        name=name,
        ticker=ticker,
        asset_type=asset_type,
        account_name="Brokerage",
        gross_value=gross,
        estimated_tax=tax,
        market_impact=impact,
        net_to_pocket=net,
        tier=tier,
        tier_label=tier_label,
        selected_for_target=False,
    )


def _portfolio_ns(accounts, *, currency="USD", total=None):
    t = total or sum(a.total_current_value for a in accounts)
    return SimpleNamespace(base_currency=currency, total_current_value=t, accounts=accounts)


def _financial_profile(*, income=5_000.0, expenses=3_000.0, savings=10_000.0):
    return SimpleNamespace(
        monthly_income=income,
        monthly_expenses=expenses,
        liquid_savings=savings,
    )


def _req(**kwargs):
    defaults = dict(duration_months=6, monthly_expense_increase=0.0, monthly_income_loss=0.0)
    defaults.update(kwargs)
    return LifeEventRequest(**defaults)


# ── _survival_score ────────────────────────────────────────────────────────────

class TestSurvivalScore:
    def test_no_breach_returns_100(self):
        assert _survival_score(6, 6, False) == 100

    def test_full_breach_from_month_0_returns_0(self):
        assert _survival_score(0, 6, True) == 0

    def test_half_months_covered_returns_50(self):
        assert _survival_score(3, 6, True) == 50

    def test_five_of_six_months_returns_83(self):
        assert _survival_score(5, 6, True) == 83

    def test_max_capped_at_99_when_breached(self):
        # 6/6 breach should still be capped at 99 (not 100)
        score = _survival_score(6, 6, True)
        assert score <= 99

    def test_zero_duration_returns_100(self):
        assert _survival_score(0, 0, False) == 100


# ── _survival_verdict ─────────────────────────────────────────────────────────

class TestSurvivalVerdict:
    def test_100_is_safe(self):
        assert _survival_verdict(100) == "Safe"

    def test_80_is_safe(self):
        assert _survival_verdict(80) == "Safe"

    def test_79_is_at_risk(self):
        assert _survival_verdict(79) == "At Risk"

    def test_50_is_at_risk(self):
        assert _survival_verdict(50) == "At Risk"

    def test_49_is_critical(self):
        assert _survival_verdict(49) == "Critical"

    def test_0_is_critical(self):
        assert _survival_verdict(0) == "Critical"


# ── simulate_depletion ─────────────────────────────────────────────────────────

class TestSimulateDepletion:
    def test_zero_burn_requires_no_liquidation(self):
        holdings = [_holding(gross=50_000.0, tax=0.0, impact=0.0)]
        steps, months, breach = simulate_depletion(0.0, 12, 10_000.0, holdings)
        assert steps == []
        assert months == 12
        assert breach is False

    def test_cash_reserve_covers_full_duration(self):
        # monthly_burn=1000, duration=6, cash=10000 → no liquidation needed
        steps, months, breach = simulate_depletion(1_000.0, 6, 10_000.0, [])
        assert steps == []
        assert months == 6
        assert breach is False

    def test_liquidates_holding_when_cash_exhausted(self):
        # cash=0, one holding with net=5000, burn=1000/mo for 3 months
        h = _holding(gross=5_000.0, tax=0.0, impact=0.0)
        h.net_to_pocket = 5_000.0
        steps, months, breach = simulate_depletion(1_000.0, 3, 0.0, [h])
        assert len(steps) == 1
        assert steps[0].month == 1  # holding pulled in month 1 when cash depletes
        assert breach is False

    def test_tier3_breach_when_all_liquidatable_exhausted(self):
        # cash=0, no holdings, burn=1000 for 6 months → breach at month 1
        steps, months, breach = simulate_depletion(1_000.0, 6, 0.0, [])
        assert breach is True
        assert months == 0

    def test_months_covered_equals_duration_when_survived(self):
        h = _holding(gross=100_000.0, tax=0.0, impact=0.0)
        h.net_to_pocket = 100_000.0
        _, months, breach = simulate_depletion(2_000.0, 12, 5_000.0, [h])
        assert months == 12
        assert breach is False

    def test_breach_mid_scenario_records_correct_months_covered(self):
        # cash=3000 covers months 1-3 (burn=1000/mo), then breaches at month 4
        steps, months, breach = simulate_depletion(1_000.0, 6, 3_000.0, [])
        assert breach is True
        assert months == 3

    def test_cumulative_net_raised_includes_initial_cash(self):
        h = _holding(gross=5_000.0, tax=0.0, impact=0.0)
        h.net_to_pocket = 5_000.0
        # cash=0, holding covers burn=6000 for 1 month
        steps, _, _ = simulate_depletion(6_000.0, 1, 0.0, [h])
        assert len(steps) == 1
        assert steps[0].cumulative_net_raised == pytest.approx(5_000.0)

    def test_multiple_holdings_drained_in_order(self):
        h1 = _holding(name="Cheap", gross=2_000.0, tax=0.0, impact=0.0)
        h1.net_to_pocket = 2_000.0
        h2 = _holding(name="Expensive", gross=3_000.0, tax=500.0, impact=0.0)
        h2.net_to_pocket = 2_500.0
        # burn=4000, total net=4500 → both liquidated, no breach
        steps, months, breach = simulate_depletion(4_000.0, 1, 0.0, [h1, h2])
        assert len(steps) == 2
        assert steps[0].holding_name == "Cheap"
        assert steps[1].holding_name == "Expensive"
        assert breach is False

    def test_depletion_step_fields_populated(self):
        h = _holding(name="VTI", ticker="VTI", gross=10_000.0, tax=250.0, impact=50.0, tier_label="T+2 Settlement")
        h.net_to_pocket = 9_700.0
        steps, _, _ = simulate_depletion(10_000.0, 1, 0.0, [h])
        assert len(steps) == 1
        s = steps[0]
        assert s.month == 1
        assert s.holding_name == "VTI"
        assert s.holding_ticker == "VTI"
        assert s.source_label == "T+2 Settlement"
        assert s.gross_sold == pytest.approx(10_000.0)
        assert s.tax_paid == pytest.approx(250.0)
        assert s.net_received == pytest.approx(9_700.0)

    def test_negative_burn_treated_as_zero(self):
        # Monthly income > expenses → no burn
        steps, months, breach = simulate_depletion(-500.0, 6, 0.0, [])
        assert steps == []
        assert months == 6
        assert breach is False


# ── compute_resilience ────────────────────────────────────────────────────────

class TestComputeResilience:

    def _make_portfolio(self, *, tier1_value=50_000.0, tier3_value=0.0, currency="USD"):
        """Build a minimal PortfolioSummary-like namespace.

        Uses separate accounts so tier1 (brokerage) and tier3 (pension) don't cross-contaminate.
        """
        accounts = []

        if tier1_value > 0:
            h1 = SimpleNamespace(
                id=uuid.uuid4(), name="VTI", ticker="VTI",
                asset_type="etf", current_value_base=tier1_value,
                unrealized_pnl=5_000.0, currency="USD",
            )
            accounts.append(SimpleNamespace(
                id=uuid.uuid4(), provider_name="Broker", account_name="Brokerage",
                account_type="brokerage",
                total_current_value=tier1_value,
                total_cost_basis=tier1_value - 5_000.0,
                unrealized_pnl=5_000.0,
                holdings=[h1],
            ))

        if tier3_value > 0:
            h3 = SimpleNamespace(
                id=uuid.uuid4(), name="Pension", ticker=None,
                asset_type="pension_fund", current_value_base=tier3_value,
                unrealized_pnl=20_000.0, currency="USD",
            )
            accounts.append(SimpleNamespace(
                id=uuid.uuid4(), provider_name="PensionCo", account_name="Pension",
                account_type="pension",
                total_current_value=tier3_value,
                total_cost_basis=tier3_value - 20_000.0,
                unrealized_pnl=20_000.0,
                holdings=[h3],
            ))

        return SimpleNamespace(
            base_currency=currency,
            total_current_value=tier1_value + tier3_value,
            accounts=accounts,
        )

    def test_result_is_resilience_result(self):
        fp = _financial_profile(income=5_000.0, expenses=3_000.0, savings=10_000.0)
        portfolio = self._make_portfolio(tier1_value=50_000.0)
        req = _req(duration_months=6, monthly_income_loss=5_000.0)
        result = compute_resilience(portfolio, fp, uuid.uuid4(), "US", req)
        assert isinstance(result, ResilienceResult)

    def test_income_covers_expenses_no_breach(self):
        # Income=5000, expenses=3000, no loss/increase → monthly_burn=0 → score=100
        fp = _financial_profile(income=5_000.0, expenses=3_000.0, savings=0.0)
        portfolio = self._make_portfolio(tier1_value=1_000.0)
        req = _req(duration_months=6)
        result = compute_resilience(portfolio, fp, uuid.uuid4(), "US", req)
        assert result.monthly_burn == 0.0
        assert result.survival_score == 100
        assert result.tier3_breach is False

    def test_full_income_loss_uses_correct_burn(self):
        fp = _financial_profile(income=5_000.0, expenses=4_000.0, savings=0.0)
        portfolio = self._make_portfolio(tier1_value=200_000.0)
        # Lose full income → burn = 4000/mo
        req = _req(duration_months=3, monthly_income_loss=5_000.0)
        result = compute_resilience(portfolio, fp, uuid.uuid4(), "US", req)
        assert result.monthly_burn == pytest.approx(4_000.0)
        assert result.total_cash_needed == pytest.approx(12_000.0)

    def test_expense_increase_adds_to_burn(self):
        fp = _financial_profile(income=5_000.0, expenses=3_000.0, savings=0.0)
        portfolio = self._make_portfolio(tier1_value=100_000.0)
        req = _req(duration_months=3, monthly_expense_increase=2_000.0)
        result = compute_resilience(portfolio, fp, uuid.uuid4(), "US", req)
        # burn = (3000 + 2000) - 5000 = 0  → income still covers
        assert result.monthly_burn == 0.0

    def test_expense_increase_exceeds_income_creates_burn(self):
        fp = _financial_profile(income=5_000.0, expenses=3_000.0, savings=0.0)
        portfolio = self._make_portfolio(tier1_value=100_000.0)
        req = _req(duration_months=6, monthly_expense_increase=4_000.0)
        result = compute_resilience(portfolio, fp, uuid.uuid4(), "US", req)
        # burn = (3000 + 4000) - 5000 = 2000
        assert result.monthly_burn == pytest.approx(2_000.0)

    def test_tier3_total_reflects_locked_assets(self):
        fp = _financial_profile(income=0.0, expenses=1_000.0, savings=0.0)
        portfolio = self._make_portfolio(tier1_value=10_000.0, tier3_value=200_000.0)
        req = _req(duration_months=6, monthly_income_loss=0.0)
        result = compute_resilience(portfolio, fp, uuid.uuid4(), "US", req)
        assert result.tier3_total_gross == pytest.approx(200_000.0)

    def test_survival_score_100_when_assets_cover_full_duration(self):
        fp = _financial_profile(income=0.0, expenses=2_000.0, savings=100_000.0)
        portfolio = self._make_portfolio(tier1_value=200_000.0)
        req = _req(duration_months=6)
        result = compute_resilience(portfolio, fp, uuid.uuid4(), "US", req)
        assert result.survival_score == 100
        assert result.tier3_breach is False

    def test_tier3_breach_sets_breach_flag(self):
        # burn=3000, cash=0, tier1 only has 5000 → covers ~1 month then breaches
        fp = _financial_profile(income=0.0, expenses=3_000.0, savings=0.0)
        portfolio = self._make_portfolio(tier1_value=5_000.0)
        req = _req(duration_months=6)
        result = compute_resilience(portfolio, fp, uuid.uuid4(), "US", req)
        assert result.tier3_breach is True
        assert result.survival_score < 100

    def test_no_api_key_returns_no_ai_recommendation(self):
        fp = _financial_profile()
        portfolio = self._make_portfolio()
        req = _req(duration_months=3)
        result = compute_resilience(portfolio, fp, uuid.uuid4(), "US", req, api_key=None)
        assert result.ai_recommendation is None

    def test_scenario_label_defaults_when_not_provided(self):
        fp = _financial_profile()
        portfolio = self._make_portfolio()
        req = _req(duration_months=9)
        result = compute_resilience(portfolio, fp, uuid.uuid4(), "US", req)
        assert "9" in result.scenario_label

    def test_custom_scenario_label_preserved(self):
        fp = _financial_profile()
        portfolio = self._make_portfolio()
        req = _req(duration_months=3, scenario_label="Job Loss Test")
        result = compute_resilience(portfolio, fp, uuid.uuid4(), "US", req)
        assert result.scenario_label == "Job Loss Test"

    def test_currency_from_portfolio(self):
        fp = _financial_profile()
        portfolio = self._make_portfolio(currency="ILS")
        req = _req(duration_months=3)
        result = compute_resilience(portfolio, fp, uuid.uuid4(), "IL", req)
        assert result.currency == "ILS"

    def test_cash_reserve_from_financial_profile(self):
        fp = _financial_profile(savings=15_000.0)
        portfolio = self._make_portfolio()
        req = _req(duration_months=3)
        result = compute_resilience(portfolio, fp, uuid.uuid4(), "US", req)
        assert result.cash_reserve == pytest.approx(15_000.0)

    def test_no_financial_profile_uses_zero_defaults(self):
        portfolio = self._make_portfolio(tier1_value=100_000.0)
        req = _req(duration_months=3, monthly_income_loss=0.0, monthly_expense_increase=1_000.0)
        # No financial_profile → income=0, expenses=0, savings=0 → burn = max(0, 1000-0) = 1000
        result = compute_resilience(portfolio, None, uuid.uuid4(), "US", req)
        assert result.monthly_burn == pytest.approx(1_000.0)

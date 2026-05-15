"""Tests for the lazy portfolio complexity premium (pure build_comparison function — no yfinance)."""
import uuid

from app.performance_analytics.lazy_portfolio import build_comparison


def _base(**overrides):
    defaults = dict(
        investor_id=uuid.uuid4(),
        currency="USD",
        snapshot_days=90,
        portfolio_return_pct=12.0,
        portfolio_sharpe=0.8,
        vt_return_pct=10.0,
        agg_return_pct=3.0,
    )
    defaults.update(overrides)
    return defaults


class TestDataGate:
    def test_gate_passes_at_30_days(self):
        result = build_comparison(**_base(snapshot_days=30))
        assert result.data_gate_passed is True

    def test_gate_fails_below_30_days(self):
        result = build_comparison(**_base(snapshot_days=29))
        assert result.data_gate_passed is False

    def test_gate_failed_returns_none_premium(self):
        result = build_comparison(**_base(snapshot_days=15))
        assert result.complexity_premium_pct is None
        assert result.lazy_return_pct is None

    def test_gate_failed_verdict_mentions_days(self):
        result = build_comparison(**_base(snapshot_days=10))
        assert "30" in result.verdict


class TestComplexityPremium:
    def test_premium_is_portfolio_minus_lazy(self):
        # VT=10%, AGG=3% → lazy = 0.6*10 + 0.4*3 = 7.2%
        # portfolio = 12% → premium = 12 - 7.2 = 4.8%
        result = build_comparison(**_base(vt_return_pct=10.0, agg_return_pct=3.0))
        assert result.lazy_return_pct == 7.2
        assert abs(result.complexity_premium_pct - 4.8) < 0.01

    def test_positive_premium_positive_verdict(self):
        result = build_comparison(**_base(portfolio_return_pct=15.0, vt_return_pct=10.0, agg_return_pct=3.0))
        assert "paying off" in result.verdict or "+" in result.verdict

    def test_negative_premium_negative_verdict(self):
        result = build_comparison(**_base(portfolio_return_pct=3.0, vt_return_pct=10.0, agg_return_pct=5.0))
        # lazy = 0.6*10 + 0.4*5 = 8.0 → premium = 3-8 = -5
        assert result.complexity_premium_pct < 0
        assert "simplif" in result.verdict.lower() or "index" in result.verdict.lower()

    def test_nil_when_benchmark_unavailable(self):
        result = build_comparison(**_base(vt_return_pct=None, agg_return_pct=None))
        assert result.lazy_return_pct is None
        assert result.complexity_premium_pct is None

    def test_composition_string(self):
        result = build_comparison(**_base())
        assert "VT" in result.lazy_composition
        assert "AGG" in result.lazy_composition

    def test_risk_adjusted_premium_computed_when_sharpe_available(self):
        result = build_comparison(**_base(portfolio_sharpe=1.2))
        if result.lazy_sharpe is not None:
            assert result.risk_adjusted_premium is not None
            assert abs(result.risk_adjusted_premium - (1.2 - result.lazy_sharpe)) < 0.01

    def test_risk_adjusted_premium_none_when_no_portfolio_sharpe(self):
        result = build_comparison(**_base(portfolio_sharpe=None))
        assert result.risk_adjusted_premium is None

    def test_snapshot_days_reflected(self):
        result = build_comparison(**_base(snapshot_days=180))
        assert result.snapshot_days == 180

    def test_currency_reflected(self):
        result = build_comparison(**_base(currency="ILS"))
        assert result.currency == "ILS"

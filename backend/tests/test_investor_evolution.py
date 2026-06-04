"""Unit tests for investor_evolution service — pure helpers, no DB required."""
from datetime import datetime, timezone
from types import SimpleNamespace

from app.investor_evolution.service import (
    _behavioral_alpha,
    _delta_direction,
    _doc_rate,
    _filter_window,
    _risk_overrides,
)


def _order(**kw) -> SimpleNamespace:
    defaults = dict(
        status="pending",
        rationale=None,
        pre_flight_review=None,
        action="buy",
        ticker="AAPL",
        unit_price=100.0,
        currency="USD",
        created_at=datetime(2026, 3, 15, tzinfo=timezone.utc),
        outcome_snapshots=None,
    )
    defaults.update(kw)
    return SimpleNamespace(**defaults)


# ── _delta_direction ──────────────────────────────────────────────────────────

class TestDeltaDirection:
    def test_none_returns_insufficient(self):
        assert _delta_direction(None) == "insufficient_data"

    def test_positive_above_threshold_is_improving(self):
        assert _delta_direction(1.0) == "improving"
        assert _delta_direction(10.0) == "improving"

    def test_negative_below_threshold_is_declining(self):
        assert _delta_direction(-1.0) == "declining"
        assert _delta_direction(-10.0) == "declining"

    def test_within_threshold_is_stable(self):
        assert _delta_direction(0.0) == "stable"
        assert _delta_direction(0.3) == "stable"
        assert _delta_direction(-0.3) == "stable"

    def test_invert_flips_direction(self):
        # fewer overrides (delta < 0) should be "improving" when invert=True
        assert _delta_direction(-2.0, invert=True) == "improving"
        assert _delta_direction(2.0, invert=True) == "declining"

    def test_invert_with_stable_stays_stable(self):
        assert _delta_direction(0.3, invert=True) == "stable"


# ── _risk_overrides ───────────────────────────────────────────────────────────

class TestRiskOverrides:
    def test_empty_returns_zero(self):
        assert _risk_overrides([]) == 0

    def test_pending_orders_not_counted(self):
        o = _order(status="pending", pre_flight_review={"verdict": "reconsider"})
        assert _risk_overrides([o]) == 0

    def test_executed_proceed_not_counted(self):
        o = _order(status="executed", pre_flight_review={"verdict": "proceed"})
        assert _risk_overrides([o]) == 0

    def test_executed_reconsider_counted(self):
        o = _order(status="executed", pre_flight_review={"verdict": "reconsider"})
        assert _risk_overrides([o]) == 1

    def test_multiple_reconsider_counted(self):
        orders = [
            _order(status="executed", pre_flight_review={"verdict": "reconsider"}),
            _order(status="executed", pre_flight_review={"verdict": "reconsider"}),
            _order(status="executed", pre_flight_review={"verdict": "proceed"}),
        ]
        assert _risk_overrides(orders) == 2

    def test_no_pre_flight_review_not_counted(self):
        o = _order(status="executed", pre_flight_review=None)
        assert _risk_overrides([o]) == 0


# ── _doc_rate ─────────────────────────────────────────────────────────────────

class TestDocRate:
    def test_empty_returns_none(self):
        assert _doc_rate([]) is None

    def test_all_documented(self):
        orders = [_order(rationale="reason") for _ in range(4)]
        assert _doc_rate(orders) == 100.0

    def test_none_documented(self):
        orders = [_order(rationale=None) for _ in range(3)]
        assert _doc_rate(orders) == 0.0

    def test_half_documented(self):
        orders = [_order(rationale="x"), _order(rationale=None)]
        assert _doc_rate(orders) == 50.0

    def test_blank_rationale_not_counted(self):
        orders = [_order(rationale="  "), _order(rationale="valid")]
        assert _doc_rate(orders) == 50.0


# ── _filter_window ────────────────────────────────────────────────────────────

class TestFilterWindow:
    def _t(self, y: int, m: int, d: int) -> datetime:
        return datetime(y, m, d, tzinfo=timezone.utc)

    def test_empty_returns_empty(self):
        assert _filter_window([], self._t(2026, 1, 1), self._t(2026, 4, 1)) == []

    def test_order_within_window_included(self):
        o = _order(created_at=self._t(2026, 2, 1))
        result = _filter_window([o], self._t(2026, 1, 1), self._t(2026, 4, 1))
        assert result == [o]

    def test_order_before_window_excluded(self):
        o = _order(created_at=self._t(2025, 12, 31))
        result = _filter_window([o], self._t(2026, 1, 1), self._t(2026, 4, 1))
        assert result == []

    def test_order_at_window_start_included(self):
        o = _order(created_at=self._t(2026, 1, 1))
        result = _filter_window([o], self._t(2026, 1, 1), self._t(2026, 4, 1))
        assert result == [o]

    def test_order_at_window_end_excluded(self):
        o = _order(created_at=self._t(2026, 4, 1))
        result = _filter_window([o], self._t(2026, 1, 1), self._t(2026, 4, 1))
        assert result == []

    def test_filters_correctly_from_mixed_set(self):
        inside = _order(created_at=self._t(2026, 2, 15))
        before = _order(created_at=self._t(2025, 12, 1))
        after = _order(created_at=self._t(2026, 5, 1))
        result = _filter_window([before, inside, after], self._t(2026, 1, 1), self._t(2026, 4, 1))
        assert result == [inside]


# ── _behavioral_alpha (no DB path — insufficient data gate) ───────────────────

class TestBehavioralAlphaNoDb:
    """Test the guard conditions that require no DB lookup."""

    def test_no_executed_buys_returns_none(self):
        from unittest.mock import MagicMock
        db = MagicMock()
        orders = [_order(status="pending")]
        assert _behavioral_alpha(db, orders) is None

    def test_fewer_than_3_priced_returns_none(self):
        from unittest.mock import MagicMock, patch
        db = MagicMock()
        snap = SimpleNamespace(price=0.0)  # price=0 → not counted as priced
        with patch("app.market_data.service.get_cached_price", return_value=snap):
            orders = [
                _order(status="executed", action="buy", ticker="AAPL", unit_price=100.0, rationale="x"),
                _order(status="executed", action="buy", ticker="MSFT", unit_price=200.0, rationale=None),
            ]
            assert _behavioral_alpha(db, orders) is None

    def test_only_documented_returns_none(self):
        from unittest.mock import MagicMock, patch
        db = MagicMock()
        snap = SimpleNamespace(price=110.0)
        with patch("app.market_data.service.get_cached_price", return_value=snap):
            orders = [
                _order(status="executed", action="buy", ticker="AAPL", unit_price=100.0, rationale="reason"),
                _order(status="executed", action="buy", ticker="MSFT", unit_price=100.0, rationale="reason2"),
                _order(status="executed", action="buy", ticker="GOOG", unit_price=100.0, rationale="reason3"),
            ]
            # all documented → no undoc_returns → None
            assert _behavioral_alpha(db, orders) is None

    def test_computes_alpha_correctly(self):
        from unittest.mock import MagicMock, patch

        db = MagicMock()

        def fake_price(db, ticker):
            prices = {"AAPL": 110.0, "MSFT": 120.0, "GOOG": 90.0, "AMZN": 95.0}
            return SimpleNamespace(price=prices.get(ticker, 100.0))

        with patch("app.market_data.service.get_cached_price", side_effect=fake_price):
            orders = [
                # documented: AAPL +10%, MSFT +20% → avg = +15%
                _order(status="executed", action="buy", ticker="AAPL", unit_price=100.0, rationale="thesis"),
                _order(status="executed", action="buy", ticker="MSFT", unit_price=100.0, rationale="thesis"),
                # undocumented: GOOG -10%, AMZN -5% → avg = -7.5%
                _order(status="executed", action="buy", ticker="GOOG", unit_price=100.0, rationale=None),
                _order(status="executed", action="buy", ticker="AMZN", unit_price=100.0, rationale=None),
            ]
            result = _behavioral_alpha(db, orders)
            assert result is not None
            # 15% - (-7.5%) = 22.5%
            assert abs(result - 22.5) < 0.1

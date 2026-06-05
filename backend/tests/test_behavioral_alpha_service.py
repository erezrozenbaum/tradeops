"""Unit tests for behavioral_alpha/service.py pure helpers.

Tests cover: _verdict, _alpha_dimension, _build_highlight, _detect_patterns.
DB-bound functions (_get_executed_buys, _price_orders, compute_behavioral_alpha) are
excluded — they require a live session and are covered by integration suites.
"""
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from app.behavioral_alpha.service import (
    _alpha_dimension,
    _build_highlight,
    _detect_patterns,
    _verdict,
)


def _order(**kw):
    defaults = {
        "id": uuid.uuid4(),
        "ticker": "AAPL",
        "name": "Apple",
        "action": "buy",
        "rationale": None,
        "pre_flight_review": None,
        "goal_id": None,
        "estimated_value": 1000.0,
        "unit_price": 100.0,
        "executed_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
        "currency": "USD",
        "status": "executed",
        "asset_type": "stock",
        "thesis_params": None,
    }
    defaults.update(kw)
    return SimpleNamespace(**defaults)


# ─── _verdict ────────────────────────────────────────────────────────────────

class TestVerdict:
    def test_extracts_reconsider(self):
        o = _order(pre_flight_review={"verdict": "reconsider"})
        assert _verdict(o) == "reconsider"

    def test_extracts_proceed(self):
        o = _order(pre_flight_review={"verdict": "proceed"})
        assert _verdict(o) == "proceed"

    def test_returns_none_for_empty_review(self):
        o = _order(pre_flight_review={})
        assert _verdict(o) is None

    def test_returns_none_for_null_review(self):
        o = _order(pre_flight_review=None)
        assert _verdict(o) is None


# ─── _alpha_dimension ────────────────────────────────────────────────────────

class TestAlphaDimension:
    def _data(self):
        return [
            (_order(rationale="thesis"), 10.0),
            (_order(rationale="thesis"), 6.0),
            (_order(rationale=None), -4.0),
            (_order(rationale=None), -2.0),
        ]

    def test_positive_alpha_when_documented_wins(self):
        result = _alpha_dimension(
            self._data(),
            lambda o: bool(o.rationale),
            "Doc Alpha", "Documented", "Undocumented",
        )
        assert result.alpha_pct == 11.0   # 8.0 - (-3.0)
        assert result.group_a_avg_return == 8.0
        assert result.group_b_avg_return == -3.0

    def test_negative_alpha_when_undocumented_wins(self):
        data = [
            (_order(rationale=None), 15.0),
            (_order(rationale=None), 10.0),
            (_order(rationale="thesis"), 2.0),
            (_order(rationale="thesis"), 0.0),
        ]
        result = _alpha_dimension(
            data, lambda o: bool(o.rationale), "Doc Alpha", "Documented", "Undocumented",
        )
        assert result.alpha_pct is not None
        assert result.alpha_pct < 0

    def test_alpha_none_when_one_group_empty(self):
        data = [(_order(rationale="thesis"), 5.0)] * 3
        result = _alpha_dimension(
            data, lambda o: bool(o.rationale), "Doc Alpha", "Documented", "Undocumented",
        )
        assert result.alpha_pct is None
        assert result.group_b_avg_return is None

    def test_has_data_true_above_minimum(self):
        data = [(_order(), 1.0)] * 3
        result = _alpha_dimension(data, lambda o: True, "L", "A", "B")
        assert result.has_data is True

    def test_has_data_false_below_minimum(self):
        data = [(_order(), 1.0)] * 2
        result = _alpha_dimension(data, lambda o: True, "L", "A", "B")
        assert result.has_data is False

    def test_win_rate_calculated(self):
        data = [
            (_order(rationale="t"), 5.0),
            (_order(rationale="t"), -1.0),
            (_order(rationale=None), 3.0),
        ]
        result = _alpha_dimension(
            data, lambda o: bool(o.rationale), "L", "A", "B",
        )
        assert result.group_a_win_rate == 0.5   # 1 of 2 positive
        assert result.group_b_win_rate == 1.0   # 1 of 1 positive


# ─── _build_highlight ────────────────────────────────────────────────────────

class TestBuildHighlight:
    def test_basic_fields(self):
        oid = uuid.uuid4()
        goal = uuid.uuid4()
        o = _order(id=oid, goal_id=goal, rationale="My thesis",
                   pre_flight_review={"verdict": "reconsider"})
        h = _build_highlight(o, 7.5)
        assert h.order_id == str(oid)
        assert h.return_pct == 7.5
        assert h.had_rationale is True
        assert h.was_goal_linked is True
        assert h.pre_flight_verdict == "reconsider"

    def test_rationale_snippet_truncated_at_120(self):
        long_text = "A" * 200
        o = _order(rationale=long_text)
        h = _build_highlight(o, 1.0)
        assert h.rationale_snippet is not None
        assert len(h.rationale_snippet) == 121   # 120 + "…"
        assert h.rationale_snippet.endswith("…")

    def test_no_snippet_when_no_rationale(self):
        o = _order(rationale=None)
        h = _build_highlight(o, 1.0)
        assert h.rationale_snippet is None
        assert h.had_rationale is False


# ─── _detect_patterns ────────────────────────────────────────────────────────

class TestDetectPatterns:
    def test_blind_override_fires(self):
        o = _order(pre_flight_review={"verdict": "reconsider"}, rationale=None)
        patterns = _detect_patterns([o], [(o, -5.0)])
        keys = [p.pattern_key for p in patterns]
        assert "blind_override" in keys

    def test_blind_override_requires_reconsider_verdict(self):
        o = _order(pre_flight_review={"verdict": "proceed"}, rationale=None)
        patterns = _detect_patterns([o], [(o, -5.0)])
        assert all(p.pattern_key != "blind_override" for p in patterns)

    def test_blind_override_suppressed_when_rationale_provided(self):
        o = _order(pre_flight_review={"verdict": "reconsider"}, rationale="thesis")
        patterns = _detect_patterns([o], [(o, -5.0)])
        assert all(p.pattern_key != "blind_override" for p in patterns)

    def test_undocumented_loss_fires_with_two_losses(self):
        o1 = _order(rationale=None)
        o2 = _order(rationale=None)
        patterns = _detect_patterns([o1, o2], [(o1, -5.0), (o2, -4.0)])
        keys = [p.pattern_key for p in patterns]
        assert "undocumented_loss" in keys

    def test_undocumented_loss_suppressed_with_one_loss(self):
        o1 = _order(rationale=None)
        patterns = _detect_patterns([o1], [(o1, -5.0)])
        assert all(p.pattern_key != "undocumented_loss" for p in patterns)

    def test_reactive_large_trade_fires_above_threshold(self):
        small = _order(estimated_value=100.0, rationale=None, goal_id=None)
        large = _order(estimated_value=1600.0, rationale=None, goal_id=None)
        # avg = 850; large (1600) > 850 * 1.5 = 1275
        patterns = _detect_patterns([small, large], [])
        keys = [p.pattern_key for p in patterns]
        assert "reactive_large_trade" in keys

    def test_reactive_large_suppressed_with_rationale(self):
        small = _order(estimated_value=100.0, rationale=None, goal_id=None)
        large = _order(estimated_value=1600.0, rationale="thesis", goal_id=None)
        patterns = _detect_patterns([small, large], [])
        assert all(p.pattern_key != "reactive_large_trade" for p in patterns)

    def test_goal_drift_fires_below_25_pct_with_5_orders(self):
        orders = [_order(goal_id=None)] * 5   # 0% goal-linked
        patterns = _detect_patterns(orders, [])
        keys = [p.pattern_key for p in patterns]
        assert "goal_drift" in keys

    def test_goal_drift_suppressed_below_5_orders(self):
        orders = [_order(goal_id=None)] * 4
        patterns = _detect_patterns(orders, [])
        assert all(p.pattern_key != "goal_drift" for p in patterns)

    def test_goal_drift_suppressed_at_high_goal_rate(self):
        goal_id = uuid.uuid4()
        orders = [_order(goal_id=goal_id)] * 4 + [_order(goal_id=None)]
        patterns = _detect_patterns(orders, [])
        assert all(p.pattern_key != "goal_drift" for p in patterns)

    def test_patterns_capped_at_four(self):
        # Trigger all four patterns simultaneously
        goal_id = None
        o_override = _order(pre_flight_review={"verdict": "reconsider"},
                            rationale=None, estimated_value=100.0, goal_id=goal_id)
        o_loss1 = _order(rationale=None, estimated_value=100.0, goal_id=goal_id)
        o_loss2 = _order(rationale=None, estimated_value=100.0, goal_id=goal_id)
        o_loss3 = _order(rationale=None, estimated_value=100.0, goal_id=goal_id)
        o_large = _order(rationale=None, estimated_value=2000.0, goal_id=goal_id)
        all_executed = [o_override, o_loss1, o_loss2, o_loss3, o_large]
        priced = [(o_loss1, -5.0), (o_loss2, -4.0), (o_override, -6.0)]
        patterns = _detect_patterns(all_executed, priced)
        assert len(patterns) <= 4

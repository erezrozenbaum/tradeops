"""Unit tests for investor_dna/service.py pure helpers.

Tests cover: _is_documented, _verdict, _dqs_label, _build_leakage,
_build_edge, _build_risks, _build_recommendation.
DB-bound functions (_get_all_executed, _get_executed_buys, _price_orders,
get_investor_dna) are excluded — covered by integration suites.
"""
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.investor_dna.schemas import DnaSignal, LeakageByClass, DnaRecommendation
from app.investor_dna.service import (
    _build_edge,
    _build_leakage,
    _build_recommendation,
    _build_risks,
    _dqs_label,
    _is_documented,
    _verdict,
)

_NOW = datetime.now(timezone.utc)


def _order(**kw):
    defaults = {
        "id": uuid.uuid4(),
        "ticker": "AAPL",
        "name": "Apple",
        "action": "buy",
        "rationale": None,
        "thesis_params": None,
        "pre_flight_review": None,
        "goal_id": None,
        "estimated_value": 1000.0,
        "unit_price": 100.0,
        "executed_at": _NOW - timedelta(days=15),
        "currency": "USD",
        "status": "executed",
        "asset_type": "stock",
    }
    defaults.update(kw)
    return SimpleNamespace(**defaults)


def _leakage(**kw) -> LeakageByClass:
    defaults = dict(
        asset_class="stock",
        documented_count=2,
        undocumented_count=1,
        documented_avg_return_pct=5.0,
        undocumented_avg_return_pct=2.0,
        leakage_pct=3.0,
        leakage_dollar=30.0,
        currency="USD",
    )
    defaults.update(kw)
    return LeakageByClass(**defaults)


def _signal(key: str, title: str = "T", value: str = "V", detail: str = "D") -> DnaSignal:
    return DnaSignal(key=key, title=title, value=value, detail=detail)


# ─── _is_documented ──────────────────────────────────────────────────────────

class TestIsDocumented:
    def test_rationale_alone_is_documented(self):
        o = _order(rationale="My thesis")
        assert _is_documented(o) is True

    def test_thesis_params_alone_is_documented(self):
        o = _order(thesis_params={"stop": 95})
        assert _is_documented(o) is True

    def test_neither_is_undocumented(self):
        o = _order(rationale=None, thesis_params=None)
        assert _is_documented(o) is False

    def test_empty_rationale_is_undocumented(self):
        o = _order(rationale="   ", thesis_params=None)
        assert _is_documented(o) is False


# ─── _verdict ────────────────────────────────────────────────────────────────

class TestVerdict:
    def test_returns_verdict_string(self):
        o = _order(pre_flight_review={"verdict": "reconsider"})
        assert _verdict(o) == "reconsider"

    def test_returns_none_for_null_review(self):
        o = _order(pre_flight_review=None)
        assert _verdict(o) is None

    def test_returns_none_for_missing_key(self):
        o = _order(pre_flight_review={"something": "else"})
        assert _verdict(o) is None


# ─── _dqs_label ──────────────────────────────────────────────────────────────

class TestDqsLabel:
    def test_excellent_at_80(self):
        assert _dqs_label(80) == "Excellent"

    def test_excellent_above_80(self):
        assert _dqs_label(95) == "Excellent"

    def test_good_at_65(self):
        assert _dqs_label(65) == "Good"

    def test_fair_at_45(self):
        assert _dqs_label(45) == "Fair"

    def test_needs_work_below_45(self):
        assert _dqs_label(44) == "Needs Work"

    def test_needs_work_at_zero(self):
        assert _dqs_label(0) == "Needs Work"


# ─── _build_leakage ──────────────────────────────────────────────────────────

class TestBuildLeakage:
    def test_leakage_computed_when_both_groups_present(self):
        doc = _order(rationale="thesis", estimated_value=1000.0, asset_type="stock")
        undoc = _order(rationale=None, estimated_value=500.0, asset_type="stock")
        priced = [(doc, 10.0), (undoc, 4.0)]
        result, total, currency = _build_leakage(priced)
        assert len(result) == 1
        assert result[0].leakage_pct == 6.0          # 10 - 4
        assert result[0].leakage_dollar == 30.0      # 6/100 * 500
        assert total == 30.0
        assert currency == "USD"

    def test_leakage_none_when_only_documented(self):
        doc = _order(rationale="thesis", asset_type="bond")
        priced = [(doc, 5.0)]
        result, total, currency = _build_leakage(priced)
        assert result[0].leakage_pct is None
        assert total is None

    def test_multiple_asset_classes_separated(self):
        s = _order(rationale="t", asset_type="stock")
        b = _order(rationale="t", asset_type="bond")
        priced = [(s, 8.0), (b, 3.0)]
        result, _, _ = _build_leakage(priced)
        classes = {r.asset_class for r in result}
        assert "stock" in classes
        assert "bond" in classes

    def test_uncategorized_used_when_asset_type_none(self):
        o = _order(rationale=None, asset_type=None, estimated_value=200.0)
        doc = _order(rationale="t", asset_type=None, estimated_value=200.0)
        priced = [(doc, 8.0), (o, 2.0)]
        result, _, _ = _build_leakage(priced)
        assert result[0].asset_class == "uncategorized"

    def test_total_aggregates_across_classes(self):
        doc_s = _order(rationale="t", asset_type="stock", estimated_value=1000.0)
        undoc_s = _order(rationale=None, asset_type="stock", estimated_value=1000.0)
        doc_b = _order(rationale="t", asset_type="bond", estimated_value=1000.0)
        undoc_b = _order(rationale=None, asset_type="bond", estimated_value=1000.0)
        priced = [(doc_s, 10.0), (undoc_s, 4.0), (doc_b, 8.0), (undoc_b, 2.0)]
        _, total, currency = _build_leakage(priced)
        # stock leakage: 6/100*1000=60; bond leakage: 6/100*1000=60; total=120
        assert total == 120.0


# ─── _build_edge ─────────────────────────────────────────────────────────────

class TestBuildEdge:
    def test_documentation_edge_fires_when_doc_outperforms(self):
        doc = _order(rationale="t")
        undoc = _order(rationale=None)
        priced = [(doc, 10.0), (undoc, 2.0)]
        doc_priced = [(doc, 10.0)]
        undoc_priced = [(undoc, 2.0)]
        edge = _build_edge(priced, doc_priced, undoc_priced)
        keys = [s.key for s in edge]
        assert "documentation_edge" in keys

    def test_documentation_edge_suppressed_when_undoc_outperforms(self):
        doc = _order(rationale="t")
        undoc = _order(rationale=None)
        priced = [(doc, 2.0), (undoc, 10.0)]
        doc_priced = [(doc, 2.0)]
        undoc_priced = [(undoc, 10.0)]
        edge = _build_edge(priced, doc_priced, undoc_priced)
        assert all(s.key != "documentation_edge" for s in edge)

    def test_goal_linkage_edge_fires(self):
        goal_id = uuid.uuid4()
        goal_o = _order(goal_id=goal_id)
        ngoal_o = _order(goal_id=None)
        priced = [(goal_o, 12.0), (ngoal_o, 2.0)]
        edge = _build_edge(priced, [], [])
        keys = [s.key for s in edge]
        assert "goal_linkage" in keys

    def test_optimal_holding_requires_2_in_bracket(self):
        # Both orders in "< 1 month" bracket (executed 15 days ago)
        o1 = _order(executed_at=_NOW - timedelta(days=10))
        o2 = _order(executed_at=_NOW - timedelta(days=5))
        priced = [(o1, 8.0), (o2, 6.0)]
        edge = _build_edge(priced, [], [])
        keys = [s.key for s in edge]
        assert "optimal_holding" in keys

    def test_optimal_holding_suppressed_with_one_in_bracket(self):
        o = _order(executed_at=_NOW - timedelta(days=10))
        priced = [(o, 8.0)]
        edge = _build_edge(priced, [], [])
        assert all(s.key != "optimal_holding" for s in edge)

    def test_strongest_class_fires_with_2_in_same_class(self):
        o1 = _order(asset_type="etf")
        o2 = _order(asset_type="etf")
        priced = [(o1, 9.0), (o2, 7.0)]
        edge = _build_edge(priced, [], [])
        keys = [s.key for s in edge]
        assert "strongest_class" in keys


# ─── _build_risks ────────────────────────────────────────────────────────────

class TestBuildRisks:
    def test_capital_leakage_fires_when_positive_total(self):
        lc = _leakage(leakage_dollar=100.0)
        risks = _build_risks([], [], [], 100.0, "USD", [lc])
        keys = [s.key for s in risks]
        assert "capital_leakage" in keys

    def test_capital_leakage_suppressed_when_none(self):
        risks = _build_risks([], [], [], None, None, [])
        assert all(s.key != "capital_leakage" for s in risks)

    def test_override_loss_rate_fires_at_40_pct(self):
        # 2 losses total; 1 is a blind override loss → 50% rate ≥ 40%
        loss = _order(pre_flight_review={"verdict": "reconsider"}, rationale=None)
        other_loss = _order(rationale="t")
        priced = [(loss, -5.0), (other_loss, -3.0)]
        priced_map_orders = [loss, other_loss]
        # executed_buys = [loss, other_loss]; undoc_priced for undoc losses
        risks = _build_risks(priced_map_orders, priced, [], None, None, [])
        keys = [s.key for s in risks]
        assert "override_loss_rate" in keys

    def test_undoc_losses_fires_with_2_losses(self):
        o1 = _order(rationale=None)
        o2 = _order(rationale=None)
        priced = [(o1, -5.0), (o2, -4.5)]
        undoc_priced = [(o1, -5.0), (o2, -4.5)]
        risks = _build_risks([], priced, undoc_priced, None, None, [])
        keys = [s.key for s in risks]
        assert "undoc_losses" in keys

    def test_goal_drift_fires_at_low_goal_rate(self):
        orders = [_order(goal_id=None)] * 5   # 0% goal-linked, 5 orders
        risks = _build_risks(orders, [], [], None, None, [])
        keys = [s.key for s in risks]
        assert "goal_drift" in keys

    def test_goal_drift_suppressed_below_5_orders(self):
        orders = [_order(goal_id=None)] * 4
        risks = _build_risks(orders, [], [], None, None, [])
        assert all(s.key != "goal_drift" for s in risks)


# ─── _build_recommendation ───────────────────────────────────────────────────

class TestBuildRecommendation:
    def test_continue_doing_from_documentation_edge(self):
        edge = [_signal("documentation_edge")]
        rec = _build_recommendation(edge, [], 0.8, 0.5, [])
        assert "Documented thesis investing" in rec.continue_doing

    def test_continue_doing_from_goal_linkage(self):
        edge = [_signal("goal_linkage")]
        rec = _build_recommendation(edge, [], 0.8, 0.5, [])
        assert "Goal-linked capital allocation" in rec.continue_doing

    def test_reduce_includes_doc_below_50pct(self):
        rec = _build_recommendation([], [], 0.4, 0.5, [])
        assert "Undocumented staging — every order deserves a thesis" in rec.reduce

    def test_reduce_doc_suppressed_at_high_rate(self):
        rec = _build_recommendation([], [], 0.8, 0.5, [])
        assert "Undocumented staging — every order deserves a thesis" not in rec.reduce

    def test_reduce_includes_goal_drift_from_risk(self):
        risks = [_signal("goal_drift")]
        rec = _build_recommendation([], risks, 0.8, 0.5, [])
        assert "Reactive trades outside your goal framework" in rec.reduce

    def test_avoid_from_override_loss_rate(self):
        risks = [_signal("override_loss_rate")]
        rec = _build_recommendation([], risks, 0.8, 0.5, [])
        assert "Blind risk overrides — document your disagreement or stand down" in rec.avoid

    def test_reduce_blind_overrides_when_present(self):
        o = _order(pre_flight_review={"verdict": "reconsider"}, rationale=None)
        rec = _build_recommendation([], [], 0.8, 0.5, [o])
        assert "Override frequency without written rationale" in rec.reduce

    def test_continue_doing_capped_at_3(self):
        edge = [
            _signal("documentation_edge"),
            _signal("goal_linkage"),
            _signal("strongest_class", title="Tech is your strongest asset class"),
            _signal("optimal_holding", title="Optimal holding period: 1–3 months"),
        ]
        rec = _build_recommendation(edge, [], 0.8, 0.5, [])
        assert len(rec.continue_doing) <= 3

    def test_avoid_capped_at_2(self):
        risks = [_signal("capital_leakage"), _signal("override_loss_rate"), _signal("extra")]
        rec = _build_recommendation([], risks, 0.8, 0.5, [])
        assert len(rec.avoid) <= 2

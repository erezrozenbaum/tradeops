"""Unit tests for decision_intelligence service — pure helpers, no DB required."""
from datetime import datetime, timezone
from types import SimpleNamespace

from app.decision_intelligence.service import (
    _compute_trend,
    _dqs_label,
    _documentation_score,
    _goal_alignment_score,
    _kappa_history,
    _risk_intelligence_score,
)
from app.decision_intelligence.schemas import DQSHistoryPoint, KappaHistoryPoint


def _order(**kw) -> SimpleNamespace:
    """Minimal fake StagedOrder."""
    defaults = dict(
        status="pending",
        rationale=None,
        goal_id=None,
        pre_flight_review=None,
        created_at=datetime(2026, 1, 15, tzinfo=timezone.utc),
        ticker="AAPL",
        action="buy",
        unit_price=100.0,
        outcome_snapshots=None,
    )
    defaults.update(kw)
    return SimpleNamespace(**defaults)


# ── _dqs_label ─────────────────────────────────────────────────────────────────

class TestDqsLabel:
    def test_excellent(self):
        assert _dqs_label(80) == "Excellent"
        assert _dqs_label(100) == "Excellent"

    def test_good(self):
        assert _dqs_label(65) == "Good"
        assert _dqs_label(79) == "Good"

    def test_fair(self):
        assert _dqs_label(45) == "Fair"
        assert _dqs_label(64) == "Fair"

    def test_needs_work(self):
        assert _dqs_label(0) == "Needs Work"
        assert _dqs_label(44) == "Needs Work"


# ── _documentation_score ──────────────────────────────────────────────────────

class TestDocumentationScore:
    def test_empty_orders(self):
        score, rate = _documentation_score([])
        assert score == 0.0
        assert rate == 0.0

    def test_all_documented(self):
        orders = [_order(rationale="reason") for _ in range(4)]
        score, rate = _documentation_score(orders)
        assert rate == 1.0
        assert abs(score - 35.0) < 0.01

    def test_none_documented(self):
        orders = [_order(rationale=None) for _ in range(4)]
        score, rate = _documentation_score(orders)
        assert score == 0.0
        assert rate == 0.0

    def test_half_documented(self):
        orders = [_order(rationale="x"), _order(rationale=None)]
        score, rate = _documentation_score(orders)
        assert rate == 0.5
        assert abs(score - 17.5) < 0.01

    def test_blank_rationale_not_counted(self):
        orders = [_order(rationale="  "), _order(rationale="valid")]
        score, rate = _documentation_score(orders)
        assert rate == 0.5


# ── _risk_intelligence_score ──────────────────────────────────────────────────

class TestRiskIntelligenceScore:
    def test_no_executed_orders_returns_neutral(self):
        orders = [_order(status="pending")]
        score, compliance, overrides, _ = _risk_intelligence_score(orders)
        assert score == 15.0
        assert overrides == 0

    def test_no_reconsider_overrides_gives_full_bonus(self):
        orders = [_order(status="executed", pre_flight_review={"verdict": "proceed"})]
        score, _, overrides, _ = _risk_intelligence_score(orders)
        assert overrides == 0
        assert score == 30.0  # full base (20) + full bonus (10)

    def test_blind_override_penalises_score(self):
        orders = [
            _order(status="executed", pre_flight_review={"verdict": "reconsider"}, rationale=None),
        ]
        score, _, overrides, _ = _risk_intelligence_score(orders)
        assert overrides == 1
        assert score == 0.0  # base=0 (all reconsider), bonus=0 (none documented)

    def test_documented_override_preserves_bonus(self):
        orders = [
            _order(status="executed", pre_flight_review={"verdict": "reconsider"}, rationale="I disagree because…"),
        ]
        score, _, overrides, _ = _risk_intelligence_score(orders)
        assert overrides == 1
        # base_rate = 0/1 = 0, bonus = 1.0 * 10 = 10 → score = 10
        assert abs(score - 10.0) < 0.01


# ── _goal_alignment_score ─────────────────────────────────────────────────────

class TestGoalAlignmentScore:
    def test_empty_orders(self):
        score, rate = _goal_alignment_score([])
        assert score == 0.0 and rate == 0.0

    def test_all_goal_linked(self):
        import uuid
        orders = [_order(goal_id=uuid.uuid4()) for _ in range(5)]
        score, rate = _goal_alignment_score(orders)
        assert rate == 1.0
        assert abs(score - 20.0) < 0.01

    def test_none_goal_linked(self):
        orders = [_order(goal_id=None) for _ in range(5)]
        score, rate = _goal_alignment_score(orders)
        assert score == 0.0 and rate == 0.0

    def test_partial_goal_linked(self):
        import uuid
        orders = [_order(goal_id=uuid.uuid4()), _order(goal_id=None)]
        score, rate = _goal_alignment_score(orders)
        assert rate == 0.5
        assert abs(score - 10.0) < 0.01


# ── _kappa_history ────────────────────────────────────────────────────────────

class TestKappaHistory:
    def test_empty_returns_empty(self):
        assert _kappa_history([]) == []

    def test_pending_orders_excluded(self):
        o = _order(status="pending", pre_flight_review={"behavioral": {"kappa_score": 0.7, "confidence_tier": "STANDARD"}})
        assert _kappa_history([o]) == []

    def test_executed_without_kappa_excluded(self):
        o = _order(status="executed", pre_flight_review={"behavioral": {"confidence_tier": "STANDARD"}})
        assert _kappa_history([o]) == []

    def test_executed_without_behavioral_excluded(self):
        o = _order(status="executed", pre_flight_review={"verdict": "proceed"})
        assert _kappa_history([o]) == []

    def test_executed_with_kappa_included(self):
        o = _order(
            status="executed",
            pre_flight_review={"behavioral": {"kappa_score": 0.72, "confidence_tier": "STANDARD"}},
            created_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
        )
        result = _kappa_history([o])
        assert len(result) == 1
        assert isinstance(result[0], KappaHistoryPoint)
        assert result[0].kappa_score == 0.72
        assert result[0].confidence_tier == "STANDARD"
        assert result[0].date == "2026-03-01"

    def test_capped_to_last_20(self):
        orders = [
            _order(
                status="executed",
                pre_flight_review={"behavioral": {"kappa_score": 0.6, "confidence_tier": "STANDARD"}},
                created_at=datetime(2026, 1, i + 1, tzinfo=timezone.utc),
            )
            for i in range(25)
        ]
        result = _kappa_history(orders)
        assert len(result) == 20

    def test_sorted_by_created_at(self):
        orders = [
            _order(status="executed", pre_flight_review={"behavioral": {"kappa_score": 0.8, "confidence_tier": "HIGH_ALPHA"}},
                   created_at=datetime(2026, 3, 1, tzinfo=timezone.utc)),
            _order(status="executed", pre_flight_review={"behavioral": {"kappa_score": 0.4, "confidence_tier": "HIGH_RISK_OVERRIDE"}},
                   created_at=datetime(2026, 1, 1, tzinfo=timezone.utc)),
        ]
        result = _kappa_history(orders)
        assert result[0].kappa_score == 0.4   # earlier date first
        assert result[1].kappa_score == 0.8

    def test_none_pre_flight_excluded(self):
        o = _order(status="executed", pre_flight_review=None)
        assert _kappa_history([o]) == []


# ── _compute_trend ────────────────────────────────────────────────────────────

class TestComputeTrend:
    def _pt(self, month: str, score: float) -> DQSHistoryPoint:
        return DQSHistoryPoint(month=month, score=score, order_count=1)

    def test_insufficient_history_single_point(self):
        trend, delta = _compute_trend([self._pt("2026-01", 70)])
        assert trend == "insufficient_data"
        assert delta is None

    def test_insufficient_history_empty(self):
        trend, delta = _compute_trend([])
        assert trend == "insufficient_data"

    def test_improving(self):
        pts = [self._pt(f"2026-0{i}", float(50 + i * 5)) for i in range(1, 6)]
        trend, delta = _compute_trend(pts)
        assert trend == "improving"
        assert delta is not None and delta >= 5

    def test_declining(self):
        pts = [self._pt(f"2026-0{i}", float(80 - i * 5)) for i in range(1, 6)]
        trend, delta = _compute_trend(pts)
        assert trend == "declining"
        assert delta is not None and delta <= -5

    def test_stable(self):
        pts = [self._pt(f"2026-0{i}", 70.0) for i in range(1, 6)]
        trend, delta = _compute_trend(pts)
        assert trend == "stable"
        assert delta is not None and abs(delta) < 5

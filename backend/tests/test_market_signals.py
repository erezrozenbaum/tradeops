"""Tests for market_signals guard and score logic (pure functions — no DB, no Claude)."""

from app.market_signals.guard import (
    evaluate_signal,
    compute_composite_score,
    compute_trend_direction,
    build_connected_insight,
    _CONCENTRATION_LIMIT_PCT,
    _MIN_STABILITY_SCORE,
)


# ── evaluate_signal ────────────────────────────────────────────────────────────

class TestEvaluateSignal:
    def test_approved_when_stable_and_not_concentrated(self):
        result = evaluate_signal("AAPL", ticker_pct_of_portfolio=10.0, stability_score=70)
        assert result.status == "APPROVED"
        assert result.mute_reason is None

    def test_muted_when_stability_below_threshold(self):
        result = evaluate_signal("AAPL", ticker_pct_of_portfolio=5.0, stability_score=49)
        assert result.status == "MUTED"
        assert "stability" in result.mute_reason.lower()
        assert result.metadata["check"] == "stability"

    def test_muted_at_exact_stability_threshold(self):
        result = evaluate_signal("AAPL", ticker_pct_of_portfolio=5.0,
                                 stability_score=_MIN_STABILITY_SCORE - 1)
        assert result.status == "MUTED"

    def test_approved_at_minimum_stability_score(self):
        result = evaluate_signal("AAPL", ticker_pct_of_portfolio=5.0,
                                 stability_score=_MIN_STABILITY_SCORE)
        assert result.status == "APPROVED"

    def test_muted_when_ticker_over_concentration_limit(self):
        result = evaluate_signal("AAPL", ticker_pct_of_portfolio=16.0, stability_score=75)
        assert result.status == "MUTED"
        assert "concentration" in result.metadata["check"]
        assert "AAPL" in result.mute_reason

    def test_approved_at_exact_concentration_limit(self):
        result = evaluate_signal("AAPL",
                                 ticker_pct_of_portfolio=_CONCENTRATION_LIMIT_PCT,
                                 stability_score=75)
        assert result.status == "APPROVED"

    def test_stability_check_takes_priority_over_concentration(self):
        # Both failing — stability reason should be returned
        result = evaluate_signal("AAPL", ticker_pct_of_portfolio=20.0, stability_score=30)
        assert result.status == "MUTED"
        assert result.metadata["check"] == "stability"

    def test_metadata_contains_stability_score(self):
        result = evaluate_signal("VTI", ticker_pct_of_portfolio=8.0, stability_score=60)
        assert result.metadata["stability_score"] == 60

    def test_metadata_contains_ticker_pct(self):
        result = evaluate_signal("VTI", ticker_pct_of_portfolio=8.0, stability_score=60)
        assert result.metadata["ticker_pct"] == 8.0


# ── compute_composite_score ───────────────────────────────────────────────────

class TestComputeCompositeScore:
    def test_neutral_sentiment_returns_50(self):
        assert compute_composite_score(0.0, False) == 50

    def test_max_bullish_returns_100(self):
        assert compute_composite_score(1.0, False) == 100

    def test_max_bearish_returns_0(self):
        assert compute_composite_score(-1.0, False) == 0

    def test_whale_mention_adds_15_bonus(self):
        base = compute_composite_score(0.0, False)
        whale = compute_composite_score(0.0, True)
        assert whale == base + 15

    def test_whale_bonus_capped_at_100(self):
        score = compute_composite_score(1.0, True)  # 100 + 15 → capped at 100
        assert score == 100

    def test_positive_sentiment_above_50(self):
        assert compute_composite_score(0.5, False) == 75

    def test_negative_sentiment_below_50(self):
        assert compute_composite_score(-0.5, False) == 25


# ── compute_trend_direction ───────────────────────────────────────────────────

class TestComputeTrendDirection:
    def test_single_score_returns_stable(self):
        assert compute_trend_direction([0.5]) == "stable"

    def test_empty_scores_returns_stable(self):
        assert compute_trend_direction([]) == "stable"

    def test_improving_trend(self):
        # First half avg: -0.5, second half avg: +0.5 → delta = +1.0 > 0.1
        result = compute_trend_direction([-0.6, -0.4, 0.4, 0.6])
        assert result == "improving"

    def test_deteriorating_trend(self):
        # First half avg: +0.5, second half avg: -0.5 → delta = -1.0 < -0.1
        result = compute_trend_direction([0.6, 0.4, -0.4, -0.6])
        assert result == "deteriorating"

    def test_stable_when_delta_small(self):
        result = compute_trend_direction([0.1, 0.1, 0.15, 0.1])
        assert result == "stable"

    def test_two_data_points_improving(self):
        result = compute_trend_direction([-0.5, 0.5])
        assert result == "improving"

    def test_two_data_points_stable(self):
        result = compute_trend_direction([0.1, 0.15])
        assert result == "stable"


# ── build_connected_insight ───────────────────────────────────────────────────

class TestBuildConnectedInsight:
    def test_tax_harvest_insight_on_negative_sentiment_and_loss(self):
        insight = build_connected_insight(
            ticker="NVDA",
            sentiment_score=-0.6,
            ticker_pct_of_portfolio=10.0,
            unrealized_pnl=-2_000.0,
            holding_days=200,
            currency="USD",
        )
        assert insight is not None
        assert "harvest" in insight.lower() or "loss" in insight.lower()

    def test_rebalancing_insight_on_negative_sentiment_and_overweight(self):
        insight = build_connected_insight(
            ticker="AAPL",
            sentiment_score=-0.5,
            ticker_pct_of_portfolio=14.0,
            unrealized_pnl=1_000.0,
            holding_days=400,
            currency="USD",
        )
        assert insight is not None
        assert "rebalanc" in insight.lower() or "14.0" in insight

    def test_accumulation_insight_on_positive_sentiment_and_underweight(self):
        insight = build_connected_insight(
            ticker="VTI",
            sentiment_score=0.7,
            ticker_pct_of_portfolio=3.0,
            unrealized_pnl=200.0,
            holding_days=100,
            currency="USD",
        )
        assert insight is not None
        assert "top-up" in insight.lower() or "3.0" in insight

    def test_no_insight_for_neutral_stable_position(self):
        insight = build_connected_insight(
            ticker="VTI",
            sentiment_score=0.1,
            ticker_pct_of_portfolio=8.0,
            unrealized_pnl=500.0,
            holding_days=300,
            currency="USD",
        )
        assert insight is None

    def test_no_insight_when_loss_too_small(self):
        # Loss below -500 threshold
        insight = build_connected_insight(
            ticker="TSLA",
            sentiment_score=-0.8,
            ticker_pct_of_portfolio=5.0,
            unrealized_pnl=-100.0,
            holding_days=50,
            currency="USD",
        )
        # Might still get rebalancing if pct > 12 — but pct is 5, so no
        assert insight is None

    def test_short_term_label_in_tax_insight(self):
        insight = build_connected_insight(
            ticker="MSFT",
            sentiment_score=-0.7,
            ticker_pct_of_portfolio=8.0,
            unrealized_pnl=-3_000.0,
            holding_days=100,   # < 365 → short-term
            currency="USD",
        )
        assert insight is not None
        assert "short-term" in insight

    def test_long_term_label_in_tax_insight(self):
        insight = build_connected_insight(
            ticker="MSFT",
            sentiment_score=-0.7,
            ticker_pct_of_portfolio=8.0,
            unrealized_pnl=-3_000.0,
            holding_days=400,   # >= 365 → long-term
            currency="USD",
        )
        assert insight is not None
        assert "long-term" in insight

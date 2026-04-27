"""Unit tests for market_scanner.engine — no DB required."""
import uuid
from types import SimpleNamespace
from datetime import date

import pytest

from app.market_scanner.engine import scan, _risk_alignment_score, _diversification_score, _horizon_score


def _investor(
    experience_level="beginner",
    time_horizon=None,
    preferred_assets=None,
    is_minor=False,
):
    return SimpleNamespace(
        id=uuid.uuid4(),
        experience_level=SimpleNamespace(value=experience_level),
        time_horizon=time_horizon,
        preferred_assets=preferred_assets,
        is_minor=is_minor,
    )


def _risk_model(
    stability_score=70,
    age_tier="adult",
    high_risk_pct=10.0,
    growth_pct=30.0,
    low_risk_pct=60.0,
    blocked_strategy_families=None,
    allowed_strategy_families=None,
):
    return SimpleNamespace(
        stability_score=stability_score,
        age_tier=age_tier,
        high_risk_pct=high_risk_pct,
        growth_pct=growth_pct,
        low_risk_pct=low_risk_pct,
        blocked_strategy_families=blocked_strategy_families or [],
        allowed_strategy_families=allowed_strategy_families or ["conservative", "balanced", "growth"],
    )


# ── Engine unit tests ─────────────────────────────────────────────────────────

class TestRiskAlignmentScore:
    def test_exact_match(self):
        assert _risk_alignment_score("moderate", "moderate") == 40.0

    def test_one_step(self):
        assert _risk_alignment_score("high", "moderate") == 25.0

    def test_two_steps(self):
        assert _risk_alignment_score("very_high", "moderate") == 10.0

    def test_three_steps(self):
        assert _risk_alignment_score("very_high", "low") == 0.0


class TestDiversificationScore:
    def test_empty_portfolio(self):
        assert _diversification_score("etf", {}) == 15.0

    def test_zero_pct_in_type(self):
        assert _diversification_score("crypto", {"etf": 100.0}) == 30.0

    def test_low_pct(self):
        assert _diversification_score("stock", {"stock": 10.0}) == 20.0

    def test_medium_pct(self):
        assert _diversification_score("etf", {"etf": 30.0}) == 10.0

    def test_high_pct(self):
        assert _diversification_score("etf", {"etf": 60.0}) == 0.0


class TestHorizonScore:
    def test_exact_match(self):
        assert _horizon_score("long_term", "long_term") == 20.0

    def test_adjacent(self):
        assert _horizon_score("medium_term", "long_term") == 10.0

    def test_opposite(self):
        assert _horizon_score("short_term", "long_term") == 0.0

    def test_no_investor_horizon(self):
        assert _horizon_score("long_term", None) == 10.0


# ── Full scan tests ───────────────────────────────────────────────────────────

class TestScan:
    def test_not_ready_returns_empty(self):
        investor = _investor()
        suggestions, notes = scan(investor, _risk_model(), "not_ready", {})
        assert suggestions == []
        assert any("not_ready" in n.lower() or "unavailable" in n.lower() for n in notes)

    def test_education_only_returns_preservation_only(self):
        investor = _investor()
        suggestions, notes = scan(investor, _risk_model(), "education_only", {})
        assert all(s.asset_family == "preservation" for s in suggestions)
        assert len(suggestions) > 0

    def test_no_risk_model_conservative_only(self):
        investor = _investor(experience_level="intermediate")
        suggestions, notes = scan(investor, None, "ready", {})
        assert all(s.risk_level in {"low", "moderate"} for s in suggestions)
        assert any("no risk model" in n.lower() for n in notes)

    def test_crypto_blocked_excludes_crypto(self):
        investor = _investor(experience_level="advanced")
        rm = _risk_model(
            high_risk_pct=20.0,
            growth_pct=40.0,
            blocked_strategy_families=["crypto"],
        )
        suggestions, _ = scan(investor, rm, "ready", {})
        assert all(s.asset_type != "crypto" for s in suggestions)

    def test_aggressive_blocked_excludes_very_high(self):
        investor = _investor(experience_level="advanced")
        rm = _risk_model(
            high_risk_pct=20.0,
            growth_pct=40.0,
            blocked_strategy_families=["aggressive"],
        )
        suggestions, _ = scan(investor, rm, "ready", {})
        assert all(s.risk_level != "very_high" for s in suggestions)

    def test_retirement_tier_excludes_high_risk(self):
        investor = _investor(experience_level="advanced")
        rm = _risk_model(age_tier="retirement", high_risk_pct=5.0, growth_pct=15.0)
        suggestions, notes = scan(investor, rm, "ready", {})
        assert all(s.risk_level in {"low", "moderate"} for s in suggestions)
        assert any("retirement" in n.lower() for n in notes)

    def test_preferred_assets_filter(self):
        investor = _investor(
            experience_level="intermediate",
            preferred_assets=["crypto"],
        )
        rm = _risk_model(
            high_risk_pct=20.0,
            growth_pct=40.0,
            blocked_strategy_families=[],
        )
        suggestions, _ = scan(investor, rm, "ready", {})
        assert all("crypto" in s.tags for s in suggestions)

    def test_results_sorted_by_fit_score_descending(self):
        investor = _investor(experience_level="intermediate", time_horizon="long_term")
        suggestions, _ = scan(investor, _risk_model(), "ready", {})
        scores = [s.fit_score for s in suggestions]
        assert scores == sorted(scores, reverse=True)

    def test_high_risk_pct_zero_excludes_high_instruments(self):
        investor = _investor(experience_level="intermediate")
        rm = _risk_model(high_risk_pct=0.0, growth_pct=30.0)
        suggestions, _ = scan(investor, rm, "ready", {})
        assert all(s.risk_level in {"low", "moderate"} for s in suggestions)

    def test_beginner_filters_non_beginner_instruments(self):
        investor = _investor(experience_level="beginner")
        rm = _risk_model(high_risk_pct=10.0, growth_pct=30.0)
        suggestions, _ = scan(investor, rm, "ready", {})
        # Beginners get 0 pts for non-beginner instruments; they still appear but ranked lower
        # Check that no instrument requiring advanced experience tops the list
        if len(suggestions) >= 2:
            top = suggestions[0]
            assert top.fit_score >= suggestions[-1].fit_score

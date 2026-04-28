"""Unit tests for portfolio_analysis.rebalance_engine — no DB required."""
import uuid
from types import SimpleNamespace

import pytest

from app.portfolio_analysis.rebalance_engine import compute_rebalance

INVESTOR_ID = uuid.uuid4()


def _risk_model(low_risk_pct=70.0, growth_pct=25.0, high_risk_pct=5.0):
    return SimpleNamespace(
        low_risk_pct=low_risk_pct,
        growth_pct=growth_pct,
        high_risk_pct=high_risk_pct,
    )


class TestNoRiskModel:
    def test_returns_empty_when_no_risk_model(self):
        result = compute_rebalance(INVESTOR_ID, risk_model=None, asset_allocation={"etf": 100.0})
        assert result.rebalance_needed is False
        assert result.tiers == []
        assert len(result.notes) == 1

    def test_returns_empty_when_no_allocation(self):
        result = compute_rebalance(INVESTOR_ID, risk_model=_risk_model(), asset_allocation={})
        assert result.rebalance_needed is False
        assert result.tiers == []


class TestBalancedPortfolio:
    def test_no_rebalance_when_within_threshold(self):
        # Target: low=70, growth=25, high=5
        # Actual: bond=68, etf=25, crypto=7 → deltas: -2, 0, +2 (all < 5%)
        allocation = {"bond": 68.0, "etf": 25.0, "crypto": 7.0}
        result = compute_rebalance(INVESTOR_ID, _risk_model(), allocation)
        assert result.rebalance_needed is False
        for tier in result.tiers:
            assert tier.action == "hold"

    def test_exact_match_produces_hold(self):
        allocation = {"bond": 70.0, "etf": 25.0, "crypto": 5.0}
        result = compute_rebalance(INVESTOR_ID, _risk_model(), allocation)
        assert result.rebalance_needed is False
        assert all(t.action == "hold" for t in result.tiers)


class TestOverweightHighRisk:
    def test_crypto_overweight_triggers_reduce(self):
        # Target high_risk=5, actual=40 → delta=+35
        allocation = {"bond": 50.0, "etf": 10.0, "crypto": 40.0}
        result = compute_rebalance(INVESTOR_ID, _risk_model(), allocation)
        assert result.rebalance_needed is True
        high_risk_tier = next(t for t in result.tiers if t.tier == "high_risk")
        assert high_risk_tier.action == "reduce"
        assert high_risk_tier.delta_pct > 0

    def test_reduce_message_in_notes(self):
        allocation = {"crypto": 60.0, "etf": 40.0}
        result = compute_rebalance(INVESTOR_ID, _risk_model(), allocation)
        assert result.rebalance_needed is True
        assert any("deviate" in n.lower() for n in result.notes)


class TestUnderweightLowRisk:
    def test_bonds_underweight_triggers_buy_more(self):
        # Target low_risk=70, actual=10 → delta=-60
        allocation = {"bond": 10.0, "etf": 85.0, "crypto": 5.0}
        result = compute_rebalance(INVESTOR_ID, _risk_model(), allocation)
        assert result.rebalance_needed is True
        low_risk_tier = next(t for t in result.tiers if t.tier == "low_risk")
        assert low_risk_tier.action == "buy_more"
        assert low_risk_tier.delta_pct < 0


class TestTierMapping:
    def test_fund_maps_to_low_risk(self):
        allocation = {"fund": 70.0, "stock": 25.0, "crypto": 5.0}
        result = compute_rebalance(INVESTOR_ID, _risk_model(), allocation)
        low_risk = next(t for t in result.tiers if t.tier == "low_risk")
        assert abs(low_risk.actual_pct - 70.0) < 0.5

    def test_stock_maps_to_growth(self):
        allocation = {"bond": 70.0, "stock": 25.0, "crypto": 5.0}
        result = compute_rebalance(INVESTOR_ID, _risk_model(), allocation)
        growth = next(t for t in result.tiers if t.tier == "growth")
        assert abs(growth.actual_pct - 25.0) < 0.5

    def test_other_assets_noted(self):
        # "other" is excluded from tier analysis
        allocation = {"bond": 50.0, "other": 50.0}
        result = compute_rebalance(INVESTOR_ID, _risk_model(), allocation)
        # Should note that "other" is excluded
        assert any("unclassified" in n.lower() or "other" in n.lower() for n in result.notes)

    def test_three_tiers_always_returned(self):
        allocation = {"etf": 100.0}
        result = compute_rebalance(INVESTOR_ID, _risk_model(), allocation)
        assert len(result.tiers) == 3
        tier_keys = {t.tier for t in result.tiers}
        assert tier_keys == {"low_risk", "growth", "high_risk"}

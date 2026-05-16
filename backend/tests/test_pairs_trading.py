"""Tests for Statistical Arbitrage Pairs Trading engine — pure math, no HTTP/DB."""
import math

import numpy as np
import pytest

from app.pairs_trading.engine import _adf0, _determine_signal, _ols
from app.pairs_trading.schemas import PairAnalysis


class TestOLS:
    def test_perfect_linear_fit(self):
        x = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
        y = 2.0 * x + 1.0
        beta, alpha = _ols(y, x)
        assert abs(beta - 2.0) < 1e-9
        assert abs(alpha - 1.0) < 1e-9

    def test_hedge_ratio_positive(self):
        rng = np.random.default_rng(42)
        x = np.cumsum(rng.standard_normal(100))
        y = 1.5 * x + rng.standard_normal(100) * 0.1
        beta, alpha = _ols(y, x)
        assert beta > 0
        assert 1.3 < beta < 1.7

    def test_negative_hedge_ratio(self):
        rng = np.random.default_rng(42)
        x = np.cumsum(rng.standard_normal(100))
        y = -0.8 * x + rng.standard_normal(100) * 0.1
        beta, _ = _ols(y, x)
        assert beta < 0


class TestADF0:
    def test_stationary_series_negative_stat(self):
        rng = np.random.default_rng(42)
        # White noise is stationary — ADF should be strongly negative
        series = rng.standard_normal(200)
        stat = _adf0(series)
        assert stat < -2.0

    def test_random_walk_near_zero(self):
        rng = np.random.default_rng(7)
        # Random walk is non-stationary — ADF stat should be close to zero or mildly negative
        rw = np.cumsum(rng.standard_normal(200))
        stat = _adf0(rw)
        # Random walk τ typically between 0 and -2 — definitely above -2.87
        assert stat > -3.0   # sanity check; could be -2 to 0

    def test_short_series_returns_zero(self):
        stat = _adf0(np.array([1.0, 2.0, 3.0]))
        assert stat == 0.0


class TestSignalLogic:
    def test_long_spread_at_minus_two(self):
        signal, reason = _determine_signal(-2.0)
        assert signal == "LONG_SPREAD"
        assert "-2.0" in reason or "-2.00" in reason

    def test_short_spread_at_plus_two(self):
        signal, reason = _determine_signal(2.0)
        assert signal == "SHORT_SPREAD"

    def test_stop_loss_at_plus_three_five(self):
        signal, _ = _determine_signal(3.5)
        assert signal == "STOP_LOSS"

    def test_stop_loss_at_minus_three_five(self):
        signal, _ = _determine_signal(-3.5)
        assert signal == "STOP_LOSS"

    def test_exit_near_zero(self):
        signal, _ = _determine_signal(0.3)
        assert signal == "EXIT"

    def test_neutral_at_one(self):
        signal, _ = _determine_signal(1.0)
        assert signal == "NEUTRAL"


class TestPairAnalysisSchema:
    def test_schema_valid(self):
        pa = PairAnalysis(
            ticker1="AAPL",
            ticker2="MSFT",
            lookback_days=252,
            hedge_ratio=0.85,
            spread_mean=0.0,
            spread_std=3.2,
            z_score=-2.1,
            adf_stat=-3.1,
            is_cointegrated=True,
            signal="LONG_SPREAD",
            signal_reason="Z=-2.10 ≤ -2.0",
            data_points=252,
        )
        assert pa.is_cointegrated is True
        assert pa.signal == "LONG_SPREAD"

    def test_rejected_schema(self):
        pa = PairAnalysis(
            ticker1="AAPL",
            ticker2="GOOG",
            lookback_days=252,
            hedge_ratio=1.2,
            spread_mean=5.0,
            spread_std=10.0,
            z_score=0.5,
            adf_stat=-1.5,
            is_cointegrated=False,
            signal="NEUTRAL",
            signal_reason="Not cointegrated",
            data_points=200,
        )
        assert pa.is_cointegrated is False

"""Statistical Arbitrage Pairs Trading engine.

Math:
  1. Fetch ~lookback_days of daily closes for both tickers via Yahoo Finance.
  2. OLS regression y = beta*x + alpha → hedge ratio beta.
  3. Spread = y - beta*x - alpha (zero-mean by construction).
  4. Z-score = (spread[-1] - mean(spread)) / std(spread).
  5. ADF(0) test on spread residuals to confirm cointegration.
     Critical value: τ < -2.87 (5% level, no drift/trend, n→∞, MacKinnon 1994).

Signal logic (paper mode only):
  LONG_SPREAD  (z <= -2.0)  — spread is unusually low, buy y / sell x
  SHORT_SPREAD (z >=  2.0)  — spread is unusually high, sell y / buy x
  STOP_LOSS    (|z| >= 3.5) — relationship breakdown, exit immediately
  EXIT         (|z| <  0.5) — spread converged, exit position
  NEUTRAL                   — no actionable signal
"""
from __future__ import annotations

import logging
from typing import Literal

import httpx
import numpy as np

from app.pairs_trading.schemas import PairAnalysis

log = logging.getLogger(__name__)

_YF_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
_YF_HEADERS = {"User-Agent": "Mozilla/5.0"}

_ADF_CRITICAL_5PCT = -2.87   # MacKinnon (1994), no constant, n→∞


def _fetch_closes(ticker: str, lookback_days: int) -> list[float] | None:
    """Fetch daily close prices from Yahoo Finance chart API."""
    range_str = "2y" if lookback_days > 252 else "1y"
    try:
        resp = httpx.get(
            _YF_URL.format(ticker=ticker),
            params={"interval": "1d", "range": range_str},
            headers=_YF_HEADERS,
            timeout=15.0,
        )
        resp.raise_for_status()
        data = resp.json()
        results = (data.get("chart") or {}).get("result") or []
        if not results:
            return None
        closes = results[0].get("indicators", {}).get("quote", [{}])[0].get("close") or []
        closes = [c for c in closes if c is not None]
        return closes[-lookback_days:] if closes else None
    except Exception as exc:
        log.error("Yahoo Finance history fetch failed for %s: %s", ticker, exc)
        return None


def _ols(y: np.ndarray, x: np.ndarray) -> tuple[float, float]:
    """OLS: y = beta*x + alpha. Returns (beta, alpha)."""
    x_mean, y_mean = x.mean(), y.mean()
    beta = float(np.dot(x - x_mean, y - y_mean) / np.dot(x - x_mean, x - x_mean))
    alpha = float(y_mean - beta * x_mean)
    return beta, alpha


def _adf0(series: np.ndarray) -> float:
    """ADF(0) test statistic (no lagged diffs, no drift/trend).

    Regresses Δy_t on y_{t-1}. Returns τ = β̂ / SE(β̂).
    More negative → stronger evidence of stationarity (cointegration).
    """
    dy = np.diff(series)
    y_lag = series[:-1]
    n = len(dy)
    if n < 10:
        return 0.0

    x_mean = y_lag.mean()
    dy_mean = dy.mean()
    beta = float(np.dot(y_lag - x_mean, dy - dy_mean) / np.dot(y_lag - x_mean, y_lag - x_mean))
    alpha = dy_mean - beta * x_mean
    residuals = dy - (alpha + beta * y_lag)
    s2 = float(np.dot(residuals, residuals) / (n - 2))
    var_x = float(np.dot(y_lag - x_mean, y_lag - x_mean))
    se_beta = float(np.sqrt(s2 / var_x))
    if se_beta == 0:
        return 0.0
    return beta / se_beta


def _determine_signal(
    z: float,
) -> tuple[Literal["LONG_SPREAD", "SHORT_SPREAD", "EXIT", "STOP_LOSS", "NEUTRAL"], str]:
    az = abs(z)
    if az >= 3.5:
        return "STOP_LOSS", f"Z-score {z:.2f} exceeds ±3.5 stop-loss threshold — relationship may have broken down."
    if z <= -2.0:
        return "LONG_SPREAD", f"Z-score {z:.2f} ≤ -2.0 — spread is abnormally low. Long {'{ticker1}'} / Short {'{ticker2}'}."
    if z >= 2.0:
        return "SHORT_SPREAD", f"Z-score {z:.2f} ≥ 2.0 — spread is abnormally high. Short {'{ticker1}'} / Long {'{ticker2}'}."
    if az < 0.5:
        return "EXIT", f"Z-score {z:.2f} near zero — spread has converged. Exit any open position."
    return "NEUTRAL", f"Z-score {z:.2f} — no actionable signal (signal range: ±2.0)."


def analyze_pair(ticker1: str, ticker2: str, lookback_days: int = 252) -> PairAnalysis | None:
    """Fetch prices, compute OLS spread, Z-score, and ADF cointegration test."""
    closes1 = _fetch_closes(ticker1, lookback_days)
    closes2 = _fetch_closes(ticker2, lookback_days)

    if not closes1 or not closes2:
        log.warning("Could not fetch history for %s or %s", ticker1, ticker2)
        return None

    n = min(len(closes1), len(closes2))
    if n < 30:
        log.warning("Insufficient data points (%d) for pair %s/%s", n, ticker1, ticker2)
        return None

    y = np.array(closes1[-n:], dtype=float)
    x = np.array(closes2[-n:], dtype=float)

    beta, alpha = _ols(y, x)
    spread = y - beta * x - alpha

    spread_mean = float(spread.mean())
    spread_std = float(spread.std(ddof=1))
    if spread_std == 0:
        return None

    z_score = float((spread[-1] - spread_mean) / spread_std)

    adf_stat = _adf0(spread)
    is_cointegrated = adf_stat < _ADF_CRITICAL_5PCT

    raw_signal, raw_reason = _determine_signal(z_score)
    reason = raw_reason.replace("{ticker1}", ticker1).replace("{ticker2}", ticker2)

    return PairAnalysis(
        ticker1=ticker1,
        ticker2=ticker2,
        lookback_days=lookback_days,
        hedge_ratio=round(beta, 6),
        spread_mean=round(spread_mean, 6),
        spread_std=round(spread_std, 6),
        z_score=round(z_score, 4),
        adf_stat=round(adf_stat, 4),
        is_cointegrated=is_cointegrated,
        signal=raw_signal,
        signal_reason=reason,
        data_points=n,
    )

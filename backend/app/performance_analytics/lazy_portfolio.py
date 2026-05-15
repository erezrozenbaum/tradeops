"""Smart Benchmarking — "Complexity Premium" vs a lazy 60/40 portfolio.

The lazy portfolio is 60% VT (global total market) / 40% AGG (US bonds).
fetch_lazy_returns() is the only function that calls yfinance (Docker-only).
build_comparison() is pure Python — no external deps, fully testable.
"""
import math
import time
import logging
import uuid
from datetime import datetime, timezone

from app.performance_analytics.schemas import LazyPortfolioComparison

log = logging.getLogger(__name__)

_DATA_GATE_DAYS = 30          # minimum snapshot history required
_LAZY_COMPOSITION = "60% VT / 40% AGG"
_VT_WEIGHT = 0.60
_AGG_WEIGHT = 0.40
_RISK_FREE_RATE = 0.045       # annualised, matches engine.py

# 24-hour cache: (vt_return, agg_return, fetched_at) keyed by start_date ISO
_lazy_cache: dict[str, tuple[float | None, float | None, float]] = {}
_CACHE_TTL = 86_400


def fetch_lazy_returns(
    start_date: datetime,
    end_date: datetime,
) -> tuple[float | None, float | None]:
    """Fetch VT and AGG total returns over [start_date, end_date]. Cached 24h."""
    import yfinance as yf  # Docker-only import

    key = f"{start_date.date().isoformat()}_{end_date.date().isoformat()}"
    cached = _lazy_cache.get(key)
    if cached and time.time() - cached[2] < _CACHE_TTL:
        return cached[0], cached[1]

    def _ticker_return(ticker: str) -> float | None:
        try:
            hist = yf.download(
                ticker,
                start=start_date.strftime("%Y-%m-%d"),
                end=end_date.strftime("%Y-%m-%d"),
                progress=False,
                auto_adjust=True,
                timeout=10,
            )
            if hist.empty:
                return None
            closes = hist["Close"].squeeze().dropna()
            if len(closes) < 2:
                return None
            return round(
                (float(closes.iloc[-1]) - float(closes.iloc[0])) / float(closes.iloc[0]) * 100, 2
            )
        except Exception as exc:
            log.debug("[lazy_portfolio] %s fetch failed: %s", ticker, exc)
            return None

    vt_ret = _ticker_return("VT")
    agg_ret = _ticker_return("AGG")
    _lazy_cache[key] = (vt_ret, agg_ret, time.time())
    return vt_ret, agg_ret


def build_comparison(
    *,
    investor_id: uuid.UUID,
    currency: str,
    snapshot_days: int,
    portfolio_return_pct: float,
    portfolio_sharpe: float | None,
    vt_return_pct: float | None,
    agg_return_pct: float | None,
) -> LazyPortfolioComparison:
    """Pure function — compute complexity premium from pre-fetched inputs."""
    now = datetime.now(timezone.utc)
    data_gate_passed = snapshot_days >= _DATA_GATE_DAYS

    lazy_return_pct: float | None = None
    complexity_premium_pct: float | None = None
    lazy_sharpe: float | None = None
    risk_adjusted_premium: float | None = None
    verdict: str

    if data_gate_passed and vt_return_pct is not None and agg_return_pct is not None:
        lazy_return_pct = round(_VT_WEIGHT * vt_return_pct + _AGG_WEIGHT * agg_return_pct, 2)
        complexity_premium_pct = round(portfolio_return_pct - lazy_return_pct, 2)

        # Estimate lazy Sharpe from its annualised return and typical 60/40 volatility (~10% annualised)
        # Using lazy_return as approximate annual return when snapshot_days >= 365, else scale
        if snapshot_days >= 14:
            years = snapshot_days / 365.25
            lazy_annual_ret_pct = lazy_return_pct / years if years > 0 else 0.0
            # Typical 60/40 portfolio annualised volatility ~10%
            _LAZY_VOL = 10.0
            lazy_sharpe = round((lazy_annual_ret_pct - _RISK_FREE_RATE * 100) / _LAZY_VOL, 2)

        if portfolio_sharpe is not None and lazy_sharpe is not None:
            risk_adjusted_premium = round(portfolio_sharpe - lazy_sharpe, 2)

        # Verdict
        if complexity_premium_pct > 0.5:
            verdict = (
                f"Your active portfolio earned +{complexity_premium_pct:.1f}% above a simple 60/40 index. "
                "Your effort is paying off."
            )
        elif complexity_premium_pct >= -0.5:
            verdict = (
                "Your portfolio is essentially matching a simple 60/40 index. "
                "Consider whether the added complexity is worth it."
            )
        else:
            verdict = (
                f"A simple 60/40 index ({_LAZY_COMPOSITION}) beat your portfolio by "
                f"{abs(complexity_premium_pct):.1f}%. Consider simplifying."
            )
    elif not data_gate_passed:
        verdict = f"Check back after {_DATA_GATE_DAYS} days of portfolio history. Currently {snapshot_days} days."
    else:
        verdict = "Benchmark data unavailable — try again later."

    return LazyPortfolioComparison(
        investor_id=investor_id,
        currency=currency,
        data_gate_passed=data_gate_passed,
        snapshot_days=snapshot_days,
        portfolio_return_pct=portfolio_return_pct,
        portfolio_sharpe=portfolio_sharpe,
        lazy_return_pct=lazy_return_pct,
        lazy_sharpe=lazy_sharpe,
        lazy_composition=_LAZY_COMPOSITION,
        complexity_premium_pct=complexity_premium_pct,
        risk_adjusted_premium=risk_adjusted_premium,
        verdict=verdict,
        computed_at=now,
    )

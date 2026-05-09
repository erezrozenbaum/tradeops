"""Performance analytics engine.

Computes Sharpe, Sortino, max drawdown, annualised return, volatility, and
benchmark (SPY) comparison from a series of portfolio snapshots.
"""
import math
import time
import logging
from datetime import datetime, timezone

import yfinance as yf

from app.portfolio_analysis.schemas import PortfolioSnapshotPoint
from app.performance_analytics.schemas import BenchmarkPoint, PerformanceAnalytics

log = logging.getLogger(__name__)

# Risk-free rate approximation (annualised) — US T-bill / Bank of Israel rate 2024-25
_RISK_FREE_RATE = 0.045

# In-memory benchmark cache: ticker+start_date → (series, fetched_at)
_bench_cache: dict[str, tuple[list[BenchmarkPoint], float, float]] = {}
_BENCH_TTL = 86_400  # 24 hours


def _fetch_benchmark(ticker: str, since: datetime) -> tuple[list[BenchmarkPoint], float | None]:
    """Fetch cumulative return series for benchmark ticker starting from `since`."""
    cache_key = f"{ticker}_{since.date().isoformat()}"
    if cache_key in _bench_cache:
        series, total_return, fetched_at = _bench_cache[cache_key]
        if time.time() - fetched_at < _BENCH_TTL:
            return series, total_return

    try:
        start_str = since.strftime("%Y-%m-%d")
        hist = yf.download(ticker, start=start_str, progress=False, auto_adjust=True, timeout=10)
        if hist.empty:
            return [], None

        closes = hist["Close"].squeeze().dropna()
        if len(closes) < 2:
            return [], None

        base = float(closes.iloc[0])
        dates = closes.index.strftime("%Y-%m-%d").tolist()
        values = closes.tolist()

        series = [
            BenchmarkPoint(
                date=dates[i],
                cumulative_return_pct=round((float(values[i]) - base) / base * 100, 2),
            )
            for i in range(len(dates))
        ]
        total_return = round((float(values[-1]) - base) / base * 100, 2)
        _bench_cache[cache_key] = (series, total_return, time.time())
        return series, total_return
    except Exception as exc:
        log.debug("[performance_analytics] Benchmark fetch failed for %s: %s", ticker, exc)
        return [], None


def compute(
    snapshots: list[PortfolioSnapshotPoint],
    investor_id,
    currency: str = "USD",
) -> PerformanceAnalytics:
    now = datetime.now(timezone.utc)

    if len(snapshots) < 2:
        return PerformanceAnalytics(
            investor_id=investor_id,
            currency=currency,
            period_days=0,
            data_points=len(snapshots),
            total_return_pct=0.0,
            annual_return_pct=None,
            max_drawdown_pct=0.0,
            current_drawdown_pct=0.0,
            sharpe_ratio=None,
            sortino_ratio=None,
            annual_volatility_pct=None,
            best_period_pct=None,
            worst_period_pct=None,
            benchmark_ticker=None,
            benchmark_total_return_pct=None,
            benchmark_series=[],
            computed_at=now,
        )

    values = [s.total_value for s in snapshots]
    start_dt = snapshots[0].snapshot_at
    end_dt = snapshots[-1].snapshot_at

    # Normalise timezone for arithmetic
    if start_dt.tzinfo is None:
        start_dt = start_dt.replace(tzinfo=timezone.utc)
    if end_dt.tzinfo is None:
        end_dt = end_dt.replace(tzinfo=timezone.utc)

    period_days = max(1, (end_dt - start_dt).days)

    # ── Total & annualised return ─────────────────────────────────────────────
    total_return_pct = (values[-1] - values[0]) / values[0] * 100 if values[0] > 0 else 0.0
    annual_return_pct = None
    if period_days >= 14 and values[0] > 0:
        annual_return_pct = ((values[-1] / values[0]) ** (365 / period_days) - 1) * 100

    # ── Period-over-period returns ────────────────────────────────────────────
    returns = []
    for i in range(1, len(values)):
        if values[i - 1] > 0:
            returns.append((values[i] - values[i - 1]) / values[i - 1])

    # ── Max drawdown ─────────────────────────────────────────────────────────
    max_drawdown_pct = 0.0
    peak = values[0]
    for v in values:
        if v > peak:
            peak = v
        dd = (peak - v) / peak * 100 if peak > 0 else 0.0
        if dd > max_drawdown_pct:
            max_drawdown_pct = dd

    # Current drawdown from all-time high in this period
    alltime_peak = max(values)
    current_drawdown_pct = (alltime_peak - values[-1]) / alltime_peak * 100 if alltime_peak > 0 else 0.0

    # ── Volatility & risk ratios ──────────────────────────────────────────────
    sharpe_ratio = None
    sortino_ratio = None
    annual_volatility_pct = None
    best_period_pct = None
    worst_period_pct = None

    if len(returns) >= 4:
        n = len(returns)
        mean_r = sum(returns) / n
        variance = sum((r - mean_r) ** 2 for r in returns) / n
        daily_std = math.sqrt(variance) if variance > 0 else 0.0

        # Scale factor: approximate daily frequency from actual days/snapshots
        freq = period_days / n  # average days per snapshot
        annual_factor = 365 / freq

        annual_volatility_pct = daily_std * math.sqrt(annual_factor) * 100

        # Risk-free rate converted to per-snapshot period
        rf_per_period = (1 + _RISK_FREE_RATE) ** (freq / 365) - 1
        excess = [r - rf_per_period for r in returns]
        mean_excess = sum(excess) / n

        if daily_std > 0:
            sharpe_ratio = round((mean_excess / daily_std) * math.sqrt(annual_factor), 2)

        downside = [r for r in returns if r < rf_per_period]
        if downside:
            down_var = sum((r - rf_per_period) ** 2 for r in downside) / n
            down_std = math.sqrt(down_var)
            if down_std > 0:
                sortino_ratio = round((mean_excess / down_std) * math.sqrt(annual_factor), 2)
        elif sharpe_ratio is not None:
            sortino_ratio = sharpe_ratio  # no downside periods

        best_period_pct = round(max(returns) * 100, 2)
        worst_period_pct = round(min(returns) * 100, 2)

    # ── Benchmark — ILS investors compare vs TA-35, others vs S&P 500 ─────────
    benchmark_ticker = "^TA35" if currency == "ILS" else "SPY"
    bench_series, bench_total = _fetch_benchmark(benchmark_ticker, start_dt)

    return PerformanceAnalytics(
        investor_id=investor_id,
        currency=currency,
        period_days=period_days,
        data_points=len(snapshots),
        total_return_pct=round(total_return_pct, 2),
        annual_return_pct=round(annual_return_pct, 2) if annual_return_pct is not None else None,
        max_drawdown_pct=round(max_drawdown_pct, 2),
        current_drawdown_pct=round(current_drawdown_pct, 2),
        sharpe_ratio=sharpe_ratio,
        sortino_ratio=sortino_ratio,
        annual_volatility_pct=round(annual_volatility_pct, 2) if annual_volatility_pct is not None else None,
        best_period_pct=best_period_pct,
        worst_period_pct=worst_period_pct,
        benchmark_ticker=benchmark_ticker,
        benchmark_total_return_pct=bench_total,
        benchmark_series=bench_series,
        computed_at=now,
    )

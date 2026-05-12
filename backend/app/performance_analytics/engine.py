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


def _compute_irr(
    cash_flows: list[tuple[datetime, float]],
    final_value: float,
    final_date: datetime,
) -> float | None:
    """Annualized IRR from buy cash flows via Newton-Raphson.

    cash_flows: list of (date, amount_paid) for each buy, amount_paid > 0.
    Returns annualized rate or None if insufficient data / does not converge.
    """
    if not cash_flows or final_value <= 0:
        return None

    t0 = cash_flows[0][0]
    if t0.tzinfo is None:
        t0 = t0.replace(tzinfo=timezone.utc)

    # Build (years, amount): buys are outflows (-), final portfolio value is inflow (+)
    dated: list[tuple[float, float]] = []
    for dt, paid in cash_flows:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        years = max(0.0, (dt - t0).total_seconds() / (365.25 * 86400))
        dated.append((years, -paid))  # outflow

    final_dt = final_date
    if final_dt.tzinfo is None:
        final_dt = final_dt.replace(tzinfo=timezone.utc)
    total_years = max(0.001, (final_dt - t0).total_seconds() / (365.25 * 86400))
    dated.append((total_years, final_value))  # inflow

    # Newton-Raphson
    r = 0.1  # initial guess
    for _ in range(200):
        try:
            npv = sum(a / (1 + r) ** t for t, a in dated)
            dnpv = sum(-t * a / (1 + r) ** (t + 1) for t, a in dated)
        except (ZeroDivisionError, OverflowError):
            return None
        if abs(dnpv) < 1e-12:
            break
        r_new = r - npv / dnpv
        if r_new <= -1.0:
            r = r / 2  # step back toward feasible region
            continue
        if abs(r_new - r) < 1e-8:
            r = r_new
            break
        r = r_new

    if r <= -1.0 or not math.isfinite(r):
        return None
    return round(r * 100, 2)

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
    cash_flows: "list[tuple[datetime, float]] | None" = None,
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
            beta=None,
            mwr_pct=None,
            computed_at=now,
        )

    # Filter to snapshots with valid cost basis (exclude zero-basis entries that
    # would produce division-by-zero or misleadingly large returns)
    valid = [s for s in snapshots if s.cost_basis > 0]
    if len(valid) < 2:
        valid = snapshots  # fall back to raw values if no cost-basis data

    start_dt = valid[0].snapshot_at
    end_dt = valid[-1].snapshot_at

    # Normalise timezone for arithmetic
    if start_dt.tzinfo is None:
        start_dt = start_dt.replace(tzinfo=timezone.utc)
    if end_dt.tzinfo is None:
        end_dt = end_dt.replace(tzinfo=timezone.utc)

    period_days = max(1, (end_dt - start_dt).days)

    # ── NAV-based returns ─────────────────────────────────────────────────────
    # Use value/cost_basis ratio (normalised NAV) instead of raw total_value.
    # This eliminates distortion from capital additions between snapshots:
    # when the user adds new holdings the cost_basis rises proportionally, so
    # the ratio stays stable while genuine price appreciation is still captured.
    navs = [
        s.total_value / s.cost_basis if s.cost_basis > 0 else 1.0
        for s in valid
    ]

    # ── Total & annualised return ─────────────────────────────────────────────
    total_return_pct = (navs[-1] - navs[0]) / navs[0] * 100 if navs[0] > 0 else 0.0
    annual_return_pct = None
    if period_days >= 14 and navs[0] > 0:
        annual_return_pct = ((navs[-1] / navs[0]) ** (365 / period_days) - 1) * 100

    # ── Period-over-period returns ────────────────────────────────────────────
    returns = []
    for i in range(1, len(navs)):
        if navs[i - 1] > 0:
            returns.append((navs[i] - navs[i - 1]) / navs[i - 1])

    # ── Max drawdown ─────────────────────────────────────────────────────────
    max_drawdown_pct = 0.0
    peak = navs[0]
    for v in navs:
        if v > peak:
            peak = v
        dd = (peak - v) / peak * 100 if peak > 0 else 0.0
        if dd > max_drawdown_pct:
            max_drawdown_pct = dd

    # Current drawdown from all-time high in this period
    alltime_peak = max(navs)
    current_drawdown_pct = (alltime_peak - navs[-1]) / alltime_peak * 100 if alltime_peak > 0 else 0.0

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

    # ── Beta vs benchmark ─────────────────────────────────────────────────────
    # Beta = Cov(portfolio_returns, benchmark_returns) / Var(benchmark_returns)
    # Align portfolio snapshot periods with benchmark daily data by date lookup.
    beta: float | None = None
    if bench_series and len(returns) >= 4:
        bench_by_date: dict[str, float] = {bp.date: bp.cumulative_return_pct for bp in bench_series}

        def _nearest_bench(date_str: str) -> float | None:
            from datetime import timedelta as _td
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            for i in range(6):
                d = (dt - _td(days=i)).strftime("%Y-%m-%d")
                if d in bench_by_date:
                    return bench_by_date[d]
            return None

        bench_rets: list[float] = []
        port_rets_matched: list[float] = []
        for i in range(1, len(valid)):
            s_start = valid[i - 1].snapshot_at
            s_end = valid[i].snapshot_at
            if s_start.tzinfo is None:
                s_start = s_start.replace(tzinfo=timezone.utc)
            if s_end.tzinfo is None:
                s_end = s_end.replace(tzinfo=timezone.utc)
            bc_start = _nearest_bench(s_start.strftime("%Y-%m-%d"))
            bc_end = _nearest_bench(s_end.strftime("%Y-%m-%d"))
            if bc_start is None or bc_end is None:
                continue
            # Convert cumulative returns to period return for this interval
            br = (1 + bc_end / 100) / (1 + bc_start / 100) - 1
            bench_rets.append(br)
            port_rets_matched.append(returns[i - 1])

        if len(bench_rets) >= 4:
            n = len(bench_rets)
            mean_p = sum(port_rets_matched) / n
            mean_b = sum(bench_rets) / n
            cov = sum((port_rets_matched[i] - mean_p) * (bench_rets[i] - mean_b) for i in range(n)) / n
            var_b = sum((r - mean_b) ** 2 for r in bench_rets) / n
            if var_b > 0:
                beta = round(cov / var_b, 3)

    # ── Money-Weighted Return (IRR) ───────────────────────────────────────────
    mwr_pct: float | None = None
    if cash_flows and valid:
        mwr_pct = _compute_irr(cash_flows, valid[-1].total_value, end_dt)

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
        beta=beta,
        mwr_pct=mwr_pct,
        computed_at=now,
    )

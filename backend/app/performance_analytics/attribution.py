"""Holding-level performance attribution + rolling returns + benchmark comparison."""
import time
import logging
from datetime import datetime, timezone, timedelta

import yfinance as yf

from app.portfolio_analysis.schemas import PortfolioSummary, PortfolioSnapshotPoint
from app.performance_analytics.schemas import AttributionResult, HoldingContribution

log = logging.getLogger(__name__)

_bench_cache: dict[str, tuple[float | None, float]] = {}
_BENCH_TTL = 86_400  # 24h


def _benchmark_for_currency(currency: str) -> str:
    return "^TA35" if currency == "ILS" else "SPY"


def _bench_display_name(ticker: str) -> str:
    return "TA-35" if ticker == "^TA35" else "S&P 500 (SPY)"


def _fetch_benchmark_return(ticker: str, since: datetime) -> float | None:
    key = f"{ticker}_{since.date()}"
    cached = _bench_cache.get(key)
    if cached and time.time() - cached[1] < _BENCH_TTL:
        return cached[0]
    try:
        hist = yf.download(ticker, start=since.strftime("%Y-%m-%d"), progress=False, auto_adjust=True, timeout=10)
        if hist.empty:
            return None
        closes = hist["Close"].squeeze().dropna()
        if len(closes) < 2:
            return None
        ret = round((float(closes.iloc[-1]) - float(closes.iloc[0])) / float(closes.iloc[0]) * 100, 2)
        _bench_cache[key] = (ret, time.time())
        return ret
    except Exception as exc:
        log.debug("[attribution] Benchmark %s fetch failed: %s", ticker, exc)
        _bench_cache[key] = (None, time.time())
        return None


def _rolling_return(snapshots: list[PortfolioSnapshotPoint], days: int) -> float | None:
    if len(snapshots) < 2:
        return None
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=days)

    start_snap = None
    for s in snapshots:
        ts = s.snapshot_at if s.snapshot_at.tzinfo else s.snapshot_at.replace(tzinfo=timezone.utc)
        if ts <= cutoff:
            start_snap = s
        else:
            break

    if start_snap is None or start_snap.total_value <= 0:
        return None

    latest = snapshots[-1]
    return round((latest.total_value - start_snap.total_value) / start_snap.total_value * 100, 2)


def compute_attribution(
    snapshots: list[PortfolioSnapshotPoint],
    portfolio: PortfolioSummary | None,
    investor_id,
    currency: str,
) -> AttributionResult:
    now = datetime.now(timezone.utc)

    sorted_snaps = sorted(
        snapshots,
        key=lambda s: s.snapshot_at if s.snapshot_at.tzinfo else s.snapshot_at.replace(tzinfo=timezone.utc),
    )

    rolling: dict[str, float | None] = {
        "1m": _rolling_return(sorted_snaps, 30),
        "3m": _rolling_return(sorted_snaps, 90),
        "6m": _rolling_return(sorted_snaps, 180),
        "1y": _rolling_return(sorted_snaps, 365),
    }

    total_return_pct = 0.0
    if len(sorted_snaps) >= 2 and sorted_snaps[0].total_value > 0:
        total_return_pct = round(
            (sorted_snaps[-1].total_value - sorted_snaps[0].total_value) / sorted_snaps[0].total_value * 100, 2
        )

    bench_ticker = _benchmark_for_currency(currency)
    bench_return: float | None = None
    if sorted_snaps:
        start_dt = sorted_snaps[0].snapshot_at
        if start_dt.tzinfo is None:
            start_dt = start_dt.replace(tzinfo=timezone.utc)
        bench_return = _fetch_benchmark_return(bench_ticker, start_dt)

    alpha_pct = round(total_return_pct - bench_return, 2) if bench_return is not None else None

    holdings: list[HoldingContribution] = []
    if portfolio and portfolio.total_cost_basis > 0:
        total_cb = portfolio.total_cost_basis
        for acc in portfolio.accounts:
            for ha in acc.holdings:
                if ha.cost_basis <= 0:
                    continue
                holdings.append(HoldingContribution(
                    holding_id=ha.id,
                    name=ha.name,
                    ticker=ha.ticker,
                    asset_type=ha.asset_type,
                    weight_pct=round(ha.cost_basis / total_cb * 100, 1),
                    return_pct=round(ha.unrealized_pnl_pct, 2),
                    contribution_pct=round(ha.unrealized_pnl / total_cb * 100, 2),
                ))

    by_contribution = sorted(holdings, key=lambda h: h.contribution_pct, reverse=True)
    contributors = [h for h in by_contribution if h.contribution_pct > 0][:5]
    detractors = list(reversed([h for h in by_contribution if h.contribution_pct < 0]))[:5]

    return AttributionResult(
        investor_id=investor_id,
        currency=currency,
        total_return_pct=total_return_pct,
        benchmark_ticker=bench_ticker,
        benchmark_return_pct=bench_return,
        alpha_pct=alpha_pct,
        rolling_returns=rolling,
        contributors=contributors,
        detractors=detractors,
        computed_at=now,
    )

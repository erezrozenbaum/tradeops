"""Computes pairwise correlation and concentration risk for a portfolio."""
import logging
import math
import time
import uuid
from datetime import datetime, timedelta, timezone

import yfinance as yf
from sqlalchemy.orm import Session

from app.market_scanner.catalog import CATALOG
from app.models.investment_account import InvestmentAccount
from app.models.investor_profile import InvestorProfile
from app.portfolio_correlation.schemas import (
    ConcentrationRisk,
    CorrelationPair,
    CorrelationResult,
    SectorConcentration,
)

log = logging.getLogger(__name__)

_HISTORY_CACHE: dict[str, tuple[list[float], float]] = {}
_CACHE_TTL = 86_400  # 24h

# Sector map from catalog
_TICKER_SECTOR: dict[str, str] = {i.ticker: (i.asset_family or i.asset_type) for i in CATALOG}

_SECTOR_CONCENTRATION_THRESHOLD = 40.0
_HIGH_CORR_THRESHOLD = 0.8
_LOOKBACK_DAYS = 90


def _fetch_returns(ticker: str) -> list[float]:
    """Return list of daily % returns over the last LOOKBACK_DAYS. Cached 24h."""
    cached = _HISTORY_CACHE.get(ticker)
    if cached and (time.time() - cached[1]) < _CACHE_TTL:
        return cached[0]

    try:
        start = (datetime.now(timezone.utc) - timedelta(days=_LOOKBACK_DAYS + 5)).strftime("%Y-%m-%d")
        hist = yf.download(ticker, start=start, progress=False, auto_adjust=True, timeout=10)
        if hist.empty:
            _HISTORY_CACHE[ticker] = ([], time.time())
            return []
        closes = hist["Close"].squeeze().dropna().tolist()
        if len(closes) < 5:
            _HISTORY_CACHE[ticker] = ([], time.time())
            return []
        returns = [(closes[i] - closes[i - 1]) / closes[i - 1] for i in range(1, len(closes))]
        _HISTORY_CACHE[ticker] = (returns, time.time())
        return returns
    except Exception as exc:
        log.debug("[correlation] Failed to fetch %s: %s", ticker, exc)
        _HISTORY_CACHE[ticker] = ([], time.time())
        return []


def _pearson(x: list[float], y: list[float]) -> float | None:
    n = min(len(x), len(y))
    if n < 10:
        return None
    x, y = x[-n:], y[-n:]
    mean_x = sum(x) / n
    mean_y = sum(y) / n
    num = sum((x[i] - mean_x) * (y[i] - mean_y) for i in range(n))
    den_x = math.sqrt(sum((v - mean_x) ** 2 for v in x))
    den_y = math.sqrt(sum((v - mean_y) ** 2 for v in y))
    if den_x == 0 or den_y == 0:
        return None
    return round(num / (den_x * den_y), 3)


def compute(db: Session, investor_id: uuid.UUID) -> CorrelationResult | None:
    investor = db.get(InvestorProfile, investor_id)
    if not investor:
        return None

    accounts = (
        db.query(InvestmentAccount)
        .filter(InvestmentAccount.investor_id == investor_id)
        .all()
    )

    # Collect tickers with weights
    ticker_values: dict[str, float] = {}
    for acc in accounts:
        for h in acc.holdings:
            if not h.ticker:
                continue
            ticker = h.ticker.upper()
            val = h.current_value or (h.quantity * h.avg_buy_price)
            ticker_values[ticker] = ticker_values.get(ticker, 0) + val

    tickers = sorted(ticker_values)
    if len(tickers) < 2:
        # Not enough tickers for correlation
        return CorrelationResult(
            investor_id=investor_id,
            tickers=tickers,
            matrix=[],
            concentration_risk=ConcentrationRisk(
                sector_concentrations=[],
                highly_correlated_pairs=[],
                risk_score=0,
                warnings=["Not enough tickered holdings to compute correlation (need at least 2)."],
            ),
            lookback_days=_LOOKBACK_DAYS,
            data_quality="insufficient",
        )

    # Fetch returns for all tickers
    returns_map: dict[str, list[float]] = {}
    for t in tickers:
        r = _fetch_returns(t)
        if r:
            returns_map[t] = r

    # Compute pairwise correlation
    pairs: list[CorrelationPair] = []
    for i, a in enumerate(tickers):
        for b in tickers[i + 1:]:
            if a in returns_map and b in returns_map:
                corr = _pearson(returns_map[a], returns_map[b])
                if corr is not None:
                    pairs.append(CorrelationPair(ticker_a=a, ticker_b=b, correlation=corr))

    # Determine data quality
    fetched = len(returns_map)
    if fetched == len(tickers):
        quality = "full"
    elif fetched >= len(tickers) // 2:
        quality = "partial"
    else:
        quality = "insufficient"

    # Sector concentration
    total_val = sum(ticker_values.values()) or 1.0
    sector_map: dict[str, list[str]] = {}
    sector_val: dict[str, float] = {}
    for ticker, val in ticker_values.items():
        sector = _TICKER_SECTOR.get(ticker, "other")
        sector_map.setdefault(sector, []).append(ticker)
        sector_val[sector] = sector_val.get(sector, 0) + val

    sector_concentrations: list[SectorConcentration] = []
    for sector, val in sorted(sector_val.items(), key=lambda x: -x[1]):
        pct = val / total_val * 100
        sector_concentrations.append(SectorConcentration(
            sector=sector,
            weight_pct=round(pct, 1),
            tickers=sector_map[sector],
            is_concentrated=pct > _SECTOR_CONCENTRATION_THRESHOLD,
        ))

    # High correlation pairs
    high_corr = [p for p in pairs if abs(p.correlation) > _HIGH_CORR_THRESHOLD]

    # Risk score (0–100)
    warnings: list[str] = []
    risk_score = 0
    concentrated = [s for s in sector_concentrations if s.is_concentrated]
    if concentrated:
        risk_score += 30 * min(len(concentrated), 2)
        for s in concentrated:
            warnings.append(f"{s.sector.capitalize()} is {s.weight_pct:.0f}% of portfolio — above the 40% concentration threshold.")
    if len(high_corr) >= 3:
        risk_score += 30
        warnings.append(f"{len(high_corr)} ticker pairs have correlation > 0.8 — low diversification benefit.")
    elif len(high_corr) >= 1:
        risk_score += 15
        warnings.append(f"{len(high_corr)} ticker pair(s) are highly correlated (>0.8) — consider diversifying.")
    risk_score = min(100, risk_score)

    return CorrelationResult(
        investor_id=investor_id,
        tickers=tickers,
        matrix=pairs,
        concentration_risk=ConcentrationRisk(
            sector_concentrations=sector_concentrations,
            highly_correlated_pairs=high_corr,
            risk_score=risk_score,
            warnings=warnings,
        ),
        lookback_days=_LOOKBACK_DAYS,
        data_quality=quality,
    )

"""Portfolio Anti-Correlation Engine — read-only pre-flight advisory.

Computes the Pearson correlation between a staged asset and the investor's
top holdings using local price snapshots. Surfaced as an informational card
inside the pre-flight review. Never modifies order sizing or the Risk Engine
verdict.

Requires MIN_HISTORICAL_DAYS daily price points for both the staged asset and
each compared holding; falls back to INSUFFICIENT_DATA if history is too short.
"""
import logging
import uuid
from typing import Any

import numpy as np
from sqlalchemy.orm import Session

log = logging.getLogger(__name__)

MIN_HISTORICAL_DAYS = 15
TOP_HOLDINGS_COUNT = 5


def _fetch_price_series(db: Session, ticker: str) -> list[float]:
    """Return one closing price per calendar day for `ticker`, oldest-first."""
    from app.models.price_snapshot import PriceSnapshot

    snaps = (
        db.query(PriceSnapshot)
        .filter(PriceSnapshot.ticker == ticker)
        .order_by(PriceSnapshot.fetched_at.asc())
        .all()
    )

    by_date: dict[str, float] = {}
    for s in snaps:
        day_key = s.fetched_at.strftime("%Y-%m-%d")
        by_date[day_key] = s.price  # later fetch for same day overwrites

    return [by_date[d] for d in sorted(by_date.keys())]


def _top_holding_tickers(db: Session, investor_id: uuid.UUID) -> list[str]:
    """Return tickers of the top N holdings by estimated value (ticker must exist)."""
    from app.models.investment_account import InvestmentAccount, InvestmentHolding

    holdings = (
        db.query(InvestmentHolding)
        .join(InvestmentAccount, InvestmentHolding.account_id == InvestmentAccount.id)
        .filter(
            InvestmentAccount.investor_id == investor_id,
            InvestmentHolding.ticker.isnot(None),
        )
        .all()
    )

    scored: list[tuple[float, str]] = []
    for h in holdings:
        value = h.current_value or (h.quantity * h.avg_buy_price)
        if h.ticker and value > 0:
            scored.append((value, h.ticker))

    seen: set[str] = set()
    result: list[str] = []
    for _, ticker in sorted(scored, key=lambda x: x[0], reverse=True):
        if ticker not in seen:
            seen.add(ticker)
            result.append(ticker)
        if len(result) >= TOP_HOLDINGS_COUNT:
            break

    return result


def compute_portfolio_correlation(
    db: Session,
    investor_id: uuid.UUID,
    staged_ticker: str | None,
) -> dict[str, Any]:
    """
    Correlate the staged ticker against the investor's top holdings.
    Returns a dict suitable for embedding in pre_flight_review['diversification'].

    Only meaningful for buy orders with a ticker; returns SKIPPED otherwise.
    """
    if not staged_ticker:
        return {
            "status": "SKIPPED",
            "avg_correlation": None,
            "risk_tier": "UNKNOWN",
            "individual_breakdown": {},
            "insight": "No ticker specified — correlation analysis requires a stock or ETF ticker.",
        }

    staged_history = _fetch_price_series(db, staged_ticker)

    if len(staged_history) < MIN_HISTORICAL_DAYS:
        return {
            "status": "INSUFFICIENT_DATA",
            "avg_correlation": None,
            "risk_tier": "UNKNOWN",
            "individual_breakdown": {},
            "insight": (
                f"Insufficient price history for {staged_ticker} in local cache "
                f"(need {MIN_HISTORICAL_DAYS} days). Correlation analysis unavailable."
            ),
        }

    holding_tickers = [
        t for t in _top_holding_tickers(db, investor_id)
        if t.upper() != staged_ticker.upper()
    ]

    if not holding_tickers:
        return {
            "status": "ISOLATED_ASSET",
            "avg_correlation": 0.0,
            "risk_tier": "LOW",
            "individual_breakdown": {},
            "insight": "No existing holdings with price history to compare against.",
        }

    staged_arr = np.array(staged_history, dtype=float)
    staged_returns = np.diff(staged_arr) / staged_arr[:-1]

    individual_correlations: dict[str, float] = {}

    for ticker in holding_tickers:
        price_series = _fetch_price_series(db, ticker)
        if len(price_series) < MIN_HISTORICAL_DAYS:
            continue

        holding_arr = np.array(price_series, dtype=float)
        min_len = min(len(staged_returns), len(holding_arr) - 1)
        if min_len < MIN_HISTORICAL_DAYS - 1:
            continue

        holding_returns = (np.diff(holding_arr) / holding_arr[:-1])[:min_len]
        target_returns = staged_returns[:min_len]

        corr_matrix = np.corrcoef(target_returns, holding_returns)
        corr_val = corr_matrix[0, 1]
        if not np.isnan(corr_val):
            individual_correlations[ticker] = float(round(corr_val, 2))

    if not individual_correlations:
        return {
            "status": "INSUFFICIENT_DATA",
            "avg_correlation": None,
            "risk_tier": "UNKNOWN",
            "individual_breakdown": {},
            "insight": "Existing holdings lack sufficient price history for reliable correlation calculation.",
        }

    avg_corr = float(round(float(np.mean(list(individual_correlations.values()))), 2))

    if avg_corr >= 0.70:
        risk_tier = "HIGH_OVERLAP"
        insight = (
            f"This asset is tightly correlated with your existing holdings (r={avg_corr:+.2f}). "
            "Adding capital here compounds vulnerability to a single sector shock."
        )
    elif avg_corr >= 0.30:
        risk_tier = "MODERATE_OVERLAP"
        insight = (
            f"Moderate correlation with current portfolio (r={avg_corr:+.2f}). "
            "Provides standard market exposure without exceptional diversification benefit."
        )
    else:
        risk_tier = "HIGHLY_DIVERSIFIED"
        insight = (
            f"Low correlation with existing holdings (r={avg_corr:+.2f}). "
            "Asset moves independently from your main positions — structural diversification benefit."
        )

    return {
        "status": "SUCCESS",
        "avg_correlation": avg_corr,
        "risk_tier": risk_tier,
        "individual_breakdown": individual_correlations,
        "insight": insight,
    }

"""Personal Signal Guard — filters market signals against investor's specific profile.

Pure functions only — no DB calls. All data passed in as arguments for testability.
"""
from dataclasses import dataclass

# Single-ticker concentration limit. Matches the existing concentration flag in portfolio_analysis.
_CONCENTRATION_LIMIT_PCT = 15.0

# Minimum financial stability score to receive signals.
# Below this the investor should focus on financial foundations, not market signals.
_MIN_STABILITY_SCORE = 50


@dataclass
class GuardResult:
    status: str          # APPROVED | MUTED
    mute_reason: str | None
    metadata: dict


def evaluate_signal(
    ticker: str,
    ticker_pct_of_portfolio: float,   # current % this ticker represents
    stability_score: int,             # investor's current financial stability score (0-100)
) -> GuardResult:
    """Evaluate whether a signal should be surfaced to the investor.

    Checks (in priority order):
    1. Stability Check — mute all signals when financial foundations are shaky
    2. Concentration Check — mute signals for already over-concentrated tickers
    """
    if stability_score < _MIN_STABILITY_SCORE:
        return GuardResult(
            status="MUTED",
            mute_reason="Financial stability score below threshold — focus on foundations first",
            metadata={
                "stability_score": stability_score,
                "min_required": _MIN_STABILITY_SCORE,
                "check": "stability",
            },
        )

    if ticker_pct_of_portfolio > _CONCENTRATION_LIMIT_PCT:
        return GuardResult(
            status="MUTED",
            mute_reason=f"{ticker} already at {ticker_pct_of_portfolio:.1f}% of portfolio (limit: {_CONCENTRATION_LIMIT_PCT}%)",
            metadata={
                "ticker_pct": ticker_pct_of_portfolio,
                "concentration_limit": _CONCENTRATION_LIMIT_PCT,
                "check": "concentration",
            },
        )

    return GuardResult(
        status="APPROVED",
        mute_reason=None,
        metadata={
            "stability_score": stability_score,
            "ticker_pct": ticker_pct_of_portfolio,
        },
    )


def compute_composite_score(sentiment_score: float, is_whale_mention: bool) -> int:
    """Map sentiment (-1→+1) to 0-100 base score. Whale mentions get +15 bonus."""
    base = int((sentiment_score + 1.0) / 2.0 * 100)
    bonus = 15 if is_whale_mention else 0
    return min(100, base + bonus)


def compute_trend_direction(scores: list[float]) -> str:
    """Determine trend direction from a time-ordered list of sentiment scores (oldest first).

    Returns 'improving', 'deteriorating', or 'stable'.
    Requires at least 2 data points; returns 'stable' otherwise.
    """
    if len(scores) < 2:
        return "stable"
    first_half = scores[: len(scores) // 2]
    second_half = scores[len(scores) // 2 :]
    avg_first = sum(first_half) / len(first_half)
    avg_second = sum(second_half) / len(second_half)
    delta = avg_second - avg_first
    if delta > 0.1:
        return "improving"
    if delta < -0.1:
        return "deteriorating"
    return "stable"


def build_connected_insight(
    ticker: str,
    sentiment_score: float,
    ticker_pct_of_portfolio: float,
    unrealized_pnl: float | None,
    holding_days: int | None,
    currency: str,
) -> str | None:
    """Surface a single most-relevant actionable insight by connecting signal to portfolio state."""
    insights = []

    # Tax-loss harvest opportunity: negative sentiment + unrealized loss
    if sentiment_score < -0.3 and unrealized_pnl is not None and unrealized_pnl < -500:
        tax_hint = "short-term" if holding_days is not None and holding_days < 365 else "long-term"
        insights.append(
            f"Negative sentiment + unrealized loss of {currency} {abs(unrealized_pnl):,.0f} "
            f"({tax_hint}) — tax-loss harvest window may be open."
        )

    # Rebalancing signal: negative sentiment + over-concentrated
    if sentiment_score < -0.2 and ticker_pct_of_portfolio > 12.0:
        insights.append(
            f"{ticker} at {ticker_pct_of_portfolio:.1f}% of portfolio. "
            f"Negative sentiment may be a natural rebalancing moment."
        )

    # Accumulation context: positive sentiment + under-weighted (below 5%)
    if sentiment_score > 0.4 and ticker_pct_of_portfolio < 5.0:
        insights.append(
            f"Positive sentiment on a small position ({ticker_pct_of_portfolio:.1f}%). "
            f"Aligns with a considered top-up within your risk limits."
        )

    return insights[0] if insights else None

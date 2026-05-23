import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.behavioral_patterns.schemas import (
    BehavioralMetrics,
    BehavioralPattern,
    HoldingPeriodStats,
)
from app.models.holding_transaction import HoldingTransaction
from app.models.recommendation_decision import RecommendationDecision

_LOOKBACK_DAYS = 365


def _median(values: list[float]) -> float | None:
    if not values:
        return None
    s = sorted(values)
    n = len(s)
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2


def compute_behavioral_metrics(db: Session, investor_id: uuid.UUID) -> BehavioralMetrics:
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=_LOOKBACK_DAYS)
    since_date = since.date()

    # --- All transactions in lookback window ---
    all_txns: list[HoldingTransaction] = (
        db.query(HoldingTransaction)
        .filter(
            HoldingTransaction.investor_id == investor_id,
            HoldingTransaction.transaction_date >= since_date,
        )
        .order_by(HoldingTransaction.transaction_date.asc())
        .all()
    )

    # --- Holding period analysis (FIFO match of buys → sells per ticker) ---
    buys_by_ticker: dict[str, list[date]] = defaultdict(list)
    sells_by_ticker: dict[str, list[date]] = defaultdict(list)

    for t in all_txns:
        if not t.ticker:
            continue
        if t.transaction_type == "buy":
            buys_by_ticker[t.ticker].append(t.transaction_date)
        elif t.transaction_type == "sell":
            sells_by_ticker[t.ticker].append(t.transaction_date)

    holding_periods: list[float] = []
    for ticker, buy_dates in buys_by_ticker.items():
        sell_dates = sorted(sells_by_ticker.get(ticker, []))
        remaining_sells = list(sell_dates)
        for buy_date in sorted(buy_dates):
            for i, sell_date in enumerate(remaining_sells):
                if sell_date >= buy_date:
                    holding_periods.append((sell_date - buy_date).days)
                    remaining_sells.pop(i)
                    break

    avg_days = (sum(holding_periods) / len(holding_periods)) if holding_periods else None
    median_days = _median(holding_periods)
    short_term = sum(1 for d in holding_periods if d < 30)
    medium_term = sum(1 for d in holding_periods if 30 <= d < 180)
    long_term = sum(1 for d in holding_periods if d >= 180)

    hp_stats = HoldingPeriodStats(
        avg_days=round(avg_days, 1) if avg_days is not None else None,
        median_days=round(median_days, 1) if median_days is not None else None,
        short_term_count=short_term,
        medium_term_count=medium_term,
        long_term_count=long_term,
        matched_pairs=len(holding_periods),
    )

    # --- Monthly trade frequency ---
    monthly_counts: dict[str, int] = defaultdict(int)
    for t in all_txns:
        if t.transaction_type in ("buy", "sell"):
            key = f"{t.transaction_date.year}-{t.transaction_date.month:02d}"
            monthly_counts[key] += 1

    # --- Recommendation action rate ---
    recent_recs: list[RecommendationDecision] = (
        db.query(RecommendationDecision)
        .filter(
            RecommendationDecision.investor_id == investor_id,
            RecommendationDecision.decision_type == "ai_recommendation",
            RecommendationDecision.triggered_at >= since,
        )
        .order_by(RecommendationDecision.triggered_at.desc())
        .limit(20)
        .all()
    )

    acted_count = 0
    for rec in recent_recs:
        rec_date = rec.triggered_at.date()
        window_end = rec_date + timedelta(days=30)
        txn_count = (
            db.query(HoldingTransaction)
            .filter(
                HoldingTransaction.investor_id == investor_id,
                HoldingTransaction.transaction_date >= rec_date,
                HoldingTransaction.transaction_date <= window_end,
                HoldingTransaction.transaction_type.in_(["buy", "sell"]),
            )
            .count()
        )
        if txn_count > 0:
            acted_count += 1

    action_rate = (acted_count / len(recent_recs)) if recent_recs else None
    rec_sample = len(recent_recs)

    # --- Pattern detection ---
    patterns: list[BehavioralPattern] = []

    if avg_days is not None:
        if avg_days < 14:
            patterns.append(BehavioralPattern(
                key="overtrading",
                label="Overtrading",
                description=f"Average holding period of {avg_days:.0f} days suggests very short-term trading. "
                            "Frequent trades increase costs and behavioral risk.",
                severity="warning",
            ))
        elif avg_days < 30:
            patterns.append(BehavioralPattern(
                key="short_term_bias",
                label="Short-Term Bias",
                description=f"Average holding period of {avg_days:.0f} days. "
                            "Consider whether short-term positions align with your stated strategy.",
                severity="info",
            ))
        elif avg_days > 180:
            patterns.append(BehavioralPattern(
                key="long_term_discipline",
                label="Long-Term Discipline",
                description=f"Average holding period of {avg_days:.0f} days demonstrates patient, "
                            "long-term investing behavior.",
                severity="positive",
            ))

    if action_rate is not None:
        if action_rate < 0.15:
            patterns.append(BehavioralPattern(
                key="strategy_ignorer",
                label="Low Strategy Follow-Through",
                description=f"Only {action_rate*100:.0f}% of AI recommendations were followed by a trade "
                            "within 30 days. Recommendations may not align with your preferences.",
                severity="info",
            ))
        elif action_rate > 0.7:
            patterns.append(BehavioralPattern(
                key="strategy_follower",
                label="High Strategy Follow-Through",
                description=f"{action_rate*100:.0f}% of AI recommendations were followed by a trade. "
                            "You consistently act on system guidance.",
                severity="positive",
            ))

    if monthly_counts:
        avg_monthly = sum(monthly_counts.values()) / len(monthly_counts)
        if avg_monthly > 10:
            patterns.append(BehavioralPattern(
                key="high_frequency",
                label="High Frequency Activity",
                description=f"Average of {avg_monthly:.1f} trades per month. "
                            "Consider whether this frequency reflects your strategy.",
                severity="warning",
            ))

    # --- Behavioral score ---
    score = 50

    if avg_days is not None:
        if avg_days > 180:
            score += 25
        elif avg_days > 90:
            score += 15
        elif avg_days > 30:
            score += 5
        elif avg_days < 14:
            score -= 25
        elif avg_days < 30:
            score -= 10

    if action_rate is not None:
        if 0.3 <= action_rate <= 0.7:
            score += 15
        elif action_rate < 0.1 or action_rate > 0.9:
            score -= 5

    score = max(0, min(100, score))

    # --- Summary ---
    if not all_txns:
        summary = "No transaction history found in the last 12 months. Record trades to enable behavioral analysis."
    elif not holding_periods:
        summary = (
            f"Found {len(all_txns)} transactions but no completed buy-sell pairs yet. "
            "Behavioral analysis improves as you complete more trades."
        )
    else:
        concern_parts = [p.label for p in patterns if p.severity == "warning"]
        positive_parts = [p.label for p in patterns if p.severity == "positive"]
        if concern_parts:
            summary = (
                f"Behavioral score: {score}/100. "
                f"Concerns: {', '.join(concern_parts)}. "
                + (f"Strengths: {', '.join(positive_parts)}." if positive_parts else "")
            )
        elif positive_parts:
            summary = f"Behavioral score: {score}/100. Strengths: {', '.join(positive_parts)}."
        else:
            summary = f"Behavioral score: {score}/100. No significant behavioral patterns detected."

    return BehavioralMetrics(
        investor_id=investor_id,
        computed_at=now,
        holding_period_stats=hp_stats,
        monthly_trade_counts=dict(sorted(monthly_counts.items())),
        recommendation_action_rate=round(action_rate, 3) if action_rate is not None else None,
        recommendation_sample_size=rec_sample,
        patterns_detected=patterns,
        behavioral_score=score,
        summary=summary,
        data_period_days=_LOOKBACK_DAYS,
    )

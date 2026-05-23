import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.attribution.schemas import (
    AttributionFactor,
    ConfidenceLayer,
    PerformanceAttribution,
)
from app.models.holding_transaction import HoldingTransaction
from app.models.portfolio_snapshot import PortfolioSnapshot
from app.models.price_snapshot import PriceSnapshot

_PERIOD_DAYS = {"ytd": None, "1y": 365, "6m": 180, "3m": 90}


def _period_start(period: str) -> datetime:
    now = datetime.now(timezone.utc)
    if period == "ytd":
        return datetime(now.year, 1, 1, tzinfo=timezone.utc)
    days = _PERIOD_DAYS.get(period, 365)
    return now - timedelta(days=days)


def compute_attribution(
    db: Session, investor_id: uuid.UUID, period: str = "ytd"
) -> PerformanceAttribution | None:
    now = datetime.now(timezone.utc)
    start = _period_start(period)

    # Snapshots: nearest to period start (could be before start) + latest
    first_snapshot: PortfolioSnapshot | None = (
        db.query(PortfolioSnapshot)
        .filter(
            PortfolioSnapshot.investor_id == investor_id,
            PortfolioSnapshot.snapshot_at >= start - timedelta(days=30),
        )
        .order_by(PortfolioSnapshot.snapshot_at.asc())
        .first()
    )

    last_snapshot: PortfolioSnapshot | None = (
        db.query(PortfolioSnapshot)
        .filter(PortfolioSnapshot.investor_id == investor_id)
        .order_by(PortfolioSnapshot.snapshot_at.desc())
        .first()
    )

    if not first_snapshot or not last_snapshot or first_snapshot.id == last_snapshot.id:
        return None

    start_value = first_snapshot.total_value
    end_value = last_snapshot.total_value
    total_change = end_value - start_value

    # Net capital deployed in period (buys add, sells subtract)
    txns: list[HoldingTransaction] = (
        db.query(HoldingTransaction)
        .filter(
            HoldingTransaction.investor_id == investor_id,
            HoldingTransaction.transaction_date >= first_snapshot.snapshot_at.date(),
            HoldingTransaction.transaction_type.in_(["buy", "sell"]),
        )
        .all()
    )

    net_deployed = sum(
        t.total_amount if t.transaction_type == "buy" else -t.total_amount
        for t in txns
    )
    fees = sum(t.fees for t in txns)

    market_gain = total_change - net_deployed

    factors: list[AttributionFactor] = []

    def _pct(v: float) -> float | None:
        return round(v / total_change * 100, 1) if total_change else None

    factors.append(AttributionFactor(
        factor="savings_contribution",
        label="Capital Deployed",
        value_change=round(net_deployed, 2),
        pct_of_total_change=_pct(net_deployed),
        description="Net capital added to the portfolio (purchases minus proceeds from sales).",
    ))
    factors.append(AttributionFactor(
        factor="market_return",
        label="Market Return",
        value_change=round(market_gain, 2),
        pct_of_total_change=_pct(market_gain),
        description="Portfolio appreciation from market price movements.",
    ))
    if fees > 0:
        factors.append(AttributionFactor(
            factor="fees_drag",
            label="Transaction Fees",
            value_change=-round(fees, 2),
            pct_of_total_change=_pct(-fees),
            description="Total transaction fees paid during the period.",
        ))

    # --- Confidence layers ---
    confidence_layers: list[ConfidenceLayer] = []

    # 1. Snapshot recency
    snap_age_hours = (now - last_snapshot.snapshot_at).total_seconds() / 3600
    if snap_age_hours < 24:
        snap_score, snap_note = 1.0, "Portfolio snapshot is current (< 24h old)."
    elif snap_age_hours < 72:
        snap_score, snap_note = 0.7, f"Portfolio snapshot is {snap_age_hours:.0f}h old."
    else:
        snap_score, snap_note = 0.3, f"Portfolio snapshot is {snap_age_hours/24:.0f} days old — regenerate for accuracy."

    confidence_layers.append(ConfidenceLayer(
        dimension="snapshot_recency",
        label="Portfolio Snapshot Freshness",
        score=snap_score,
        note=snap_note,
    ))

    # 2. Price data freshness
    latest_price: PriceSnapshot | None = (
        db.query(PriceSnapshot)
        .filter(PriceSnapshot.investor_id == investor_id)
        .order_by(PriceSnapshot.fetched_at.desc())
        .first()
    )
    if latest_price is None:
        price_score, price_note = 0.2, "No live price data found."
    else:
        price_age_h = (now - latest_price.fetched_at).total_seconds() / 3600
        if price_age_h < 4:
            price_score, price_note = 1.0, "Price data is current."
        elif price_age_h < 24:
            price_score, price_note = 0.7, f"Price data is {price_age_h:.0f}h old."
        else:
            price_score, price_note = 0.3, f"Price data is {price_age_h/24:.0f} days old."

    confidence_layers.append(ConfidenceLayer(
        dimension="data_freshness",
        label="Live Price Freshness",
        score=price_score,
        note=price_note,
    ))

    # 3. Sample quality: number of snapshots used
    snapshot_count = (
        db.query(PortfolioSnapshot)
        .filter(
            PortfolioSnapshot.investor_id == investor_id,
            PortfolioSnapshot.snapshot_at >= start,
        )
        .count()
    )
    if snapshot_count >= 10:
        hist_score, hist_note = 1.0, f"{snapshot_count} portfolio snapshots available for this period."
    elif snapshot_count >= 3:
        hist_score, hist_note = 0.6, f"Only {snapshot_count} snapshots for this period — attribution is approximate."
    else:
        hist_score, hist_note = 0.3, f"Very few snapshots ({snapshot_count}) — attribution may be inaccurate."

    confidence_layers.append(ConfidenceLayer(
        dimension="holdings_completeness",
        label="Historical Data Depth",
        score=hist_score,
        note=hist_note,
    ))

    overall_confidence = round(
        sum(c.score for c in confidence_layers) / len(confidence_layers), 2
    )

    note = None
    if period == "ytd" and first_snapshot.snapshot_at.year < now.year:
        note = (
            "No portfolio snapshot found from January 1st. "
            "Using the earliest available snapshot as the baseline."
        )

    return PerformanceAttribution(
        investor_id=investor_id,
        period=period,
        period_start=first_snapshot.snapshot_at,
        period_end=last_snapshot.snapshot_at,
        start_value=round(start_value, 2),
        end_value=round(end_value, 2),
        total_change=round(total_change, 2),
        total_return_pct=(
            round(total_change / start_value * 100, 2) if start_value else None
        ),
        currency=last_snapshot.currency,
        factors=factors,
        confidence=confidence_layers,
        overall_confidence_score=overall_confidence,
        computed_at=now,
        note=note,
    )

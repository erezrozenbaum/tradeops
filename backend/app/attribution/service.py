from __future__ import annotations

import uuid
from collections import defaultdict
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


# ─── Extended estimate helpers ────────────────────────────────────────────────

def _behavioral_drag(txns: list[HoldingTransaction], period_start: datetime) -> float | None:
    """
    Fees from buy-sell pairs where the holding lasted < 30 days.
    Returns a negative number (drag on returns) or None if no data.
    """
    since_date = period_start.date()
    period_txns = [t for t in txns if t.transaction_date >= since_date]
    if not period_txns:
        return None

    buys_by_ticker: dict[str, list[HoldingTransaction]] = defaultdict(list)
    short_term_fees = 0.0
    found_any = False

    for t in sorted(period_txns, key=lambda x: x.transaction_date):
        if t.transaction_type == "buy" and t.ticker:
            buys_by_ticker[t.ticker].append(t)
        elif t.transaction_type == "sell" and t.ticker:
            prior = buys_by_ticker.get(t.ticker, [])
            if prior:
                buy = prior.pop(0)  # FIFO match
                holding_days = (t.transaction_date - buy.transaction_date).days
                if holding_days < 30:
                    short_term_fees += t.fees + buy.fees
                    found_any = True

    if not found_any:
        return None
    return -round(short_term_fees, 2)


def _fx_drag(db: Session, investor_id: uuid.UUID) -> float | None:
    """
    Total FX P&L from the fx_impact engine.
    Negative = currency headwind (FX drag), positive = FX tailwind.
    Returns None if insufficient FX data.
    """
    try:
        from app.fx_impact.engine import compute as compute_fx_impact
        result = compute_fx_impact(db, investor_id)
        if result.holdings_missing_fx_data == len(result.holdings):
            return None
        return round(result.total_fx_pnl, 2) if result.total_fx_pnl != 0.0 else None
    except Exception:
        return None


def _concentration_cost(db: Session, investor_id: uuid.UUID) -> float | None:
    """
    Sum of unrealized losses from the top-3 holdings by cost basis.
    Represents the P&L drag attributable to concentration in specific positions.
    Returns a negative number (loss) or None if no loss data.
    """
    try:
        from app.fx_impact.engine import compute as compute_fx_impact
        result = compute_fx_impact(db, investor_id)

        # Holdings with full P&L data, sorted by cost_basis_base descending
        scored = [
            h for h in result.holdings
            if h.cost_basis_base is not None and h.total_pnl is not None
        ]
        if not scored:
            return None

        top3 = sorted(scored, key=lambda h: h.cost_basis_base or 0.0, reverse=True)[:3]
        concentration_loss = sum(h.total_pnl for h in top3 if h.total_pnl < 0)

        return round(concentration_loss, 2) if concentration_loss < 0 else None
    except Exception:
        return None

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

    # --- Extended estimate factors (supplementary — not additive to total_change) ---
    behav_drag = _behavioral_drag(txns, start)
    if behav_drag is not None:
        factors.append(AttributionFactor(
            factor="behavioral_drag",
            label="Behavioral Drag",
            value_change=behav_drag,
            pct_of_total_change=_pct(behav_drag),
            description=(
                "Illustrative estimate of fees attributable to short-term trades (< 30-day round-trips). "
                "A sub-component of total fees — shown separately to highlight behavioral cost."
            ),
            is_estimate=True,
        ))

    fx_drag_val = _fx_drag(db, investor_id)
    if fx_drag_val is not None:
        factors.append(AttributionFactor(
            factor="fx_drag",
            label="FX Impact" if fx_drag_val >= 0 else "FX Drag",
            value_change=fx_drag_val,
            pct_of_total_change=_pct(fx_drag_val),
            description=(
                "Illustrative estimate of currency movement P&L across cross-currency holdings. "
                "Positive = FX tailwind (holding currency strengthened); negative = FX headwind."
            ),
            is_estimate=True,
        ))

    conc_cost = _concentration_cost(db, investor_id)
    if conc_cost is not None:
        factors.append(AttributionFactor(
            factor="concentration_cost",
            label="Concentration Cost",
            value_change=conc_cost,
            pct_of_total_change=_pct(conc_cost),
            description=(
                "Illustrative estimate of unrealized losses from the top-3 most concentrated holdings. "
                "Highlights the P&L risk of position concentration."
            ),
            is_estimate=True,
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

    # 2. Price data freshness — PriceSnapshot is a global cache table (no investor_id)
    latest_price: PriceSnapshot | None = (
        db.query(PriceSnapshot)
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

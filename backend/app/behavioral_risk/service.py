from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import NamedTuple

from sqlalchemy.orm import Session

from app.behavioral_risk.schemas import BehavioralRiskEventResponse, BehavioralRiskListResponse
from app.models.behavioral_risk_event import BehavioralRiskEvent
from app.models.holding_transaction import HoldingTransaction


# ─── Detection result ─────────────────────────────────────────────────────────

class _Detection(NamedTuple):
    event_type: str
    severity: str
    description: str
    evidence: dict
    recommendation: str


# ─── Detection helpers ────────────────────────────────────────────────────────

def _detect_panic_selling(txns: list[HoldingTransaction], now: datetime) -> _Detection | None:
    sells = [t for t in txns if t.transaction_type == "sell"]
    if len(sells) < 3:
        return None

    cutoff = now - timedelta(days=14)
    recent_sells = [s for s in sells if _txn_dt(s) >= cutoff]

    # Sliding 3-day window
    recent_sells.sort(key=lambda t: t.transaction_date)
    trigger_dates = []
    for i, s in enumerate(recent_sells):
        window_end = s.transaction_date + timedelta(days=3)
        count = sum(1 for r in recent_sells if s.transaction_date <= r.transaction_date <= window_end)
        if count >= 3:
            trigger_dates.append(str(s.transaction_date))

    if not trigger_dates:
        return None

    tickers = list({s.ticker for s in recent_sells if s.ticker})
    return _Detection(
        event_type="panic_selling",
        severity="high",
        description=(
            "3 or more sell transactions detected within a 3-day window in the last 14 days. "
            "Rapid sequential selling is a common indicator of panic-driven decision making."
        ),
        evidence={
            "sell_count_14d": len(recent_sells),
            "trigger_windows": trigger_dates[:3],
            "tickers": tickers[:10],
        },
        recommendation=(
            "Review whether these sells align with your strategy. "
            "Consider setting price alerts instead of reacting to short-term volatility."
        ),
    )


def _detect_revenge_trading(txns: list[HoldingTransaction], now: datetime) -> _Detection | None:
    cutoff = now - timedelta(days=30)
    recent = [t for t in txns if _txn_dt(t) >= cutoff]

    sells = [t for t in recent if t.transaction_type == "sell"]
    buys = [t for t in recent if t.transaction_type == "buy"]

    matches: list[dict] = []
    for sell in sells:
        if not sell.ticker:
            continue
        sell_dt = sell.transaction_date
        # Look for a buy of the same ticker within 7 days after the sell
        for buy in buys:
            if buy.ticker == sell.ticker and sell_dt < buy.transaction_date <= sell_dt + timedelta(days=7):
                matches.append({"ticker": sell.ticker, "sell_date": str(sell_dt), "buy_date": str(buy.transaction_date)})
                break

    if not matches:
        return None

    return _Detection(
        event_type="revenge_trading",
        severity="high",
        description=(
            f"Detected {len(matches)} instance(s) of buying back a ticker within 7 days of selling it. "
            "Revenge trading often results from emotional response to a loss rather than rational analysis."
        ),
        evidence={"instances": matches[:5]},
        recommendation=(
            "If you are re-entering a position, ensure it is based on a fresh analysis — "
            "not an attempt to recover a loss. Consider waiting at least 30 days before re-entering."
        ),
    )


def _detect_overtrading_spike(txns: list[HoldingTransaction], now: datetime) -> _Detection | None:
    trades = [t for t in txns if t.transaction_type in ("buy", "sell")]
    if not trades:
        return None

    cutoff_recent = now - timedelta(days=7)
    cutoff_baseline = now - timedelta(days=63)

    recent_count = sum(1 for t in trades if _txn_dt(t) >= cutoff_recent)
    # Baseline: avg weekly count over weeks 2–9
    baseline_trades = [t for t in trades if cutoff_baseline <= _txn_dt(t) < cutoff_recent]
    baseline_weekly_avg = len(baseline_trades) / 8.0 if baseline_trades else 0.0

    if baseline_weekly_avg < 1.0:
        return None  # Insufficient baseline; don't false-positive on new investors

    if recent_count < baseline_weekly_avg * 2:
        return None

    return _Detection(
        event_type="overtrading_spike",
        severity="medium",
        description=(
            f"This week's trade count ({recent_count}) is more than 2× your recent weekly average "
            f"({baseline_weekly_avg:.1f}). Elevated activity may indicate reactive decision making."
        ),
        evidence={
            "trades_last_7d": recent_count,
            "weekly_baseline_avg": round(baseline_weekly_avg, 1),
            "ratio": round(recent_count / baseline_weekly_avg, 1),
        },
        recommendation=(
            "High-frequency trading increases costs and often reduces returns. "
            "Review your strategy before making additional trades this week."
        ),
    )


def _detect_performance_chasing(txns: list[HoldingTransaction], now: datetime) -> _Detection | None:
    lookback = now - timedelta(days=365)
    recent_cutoff = now - timedelta(days=14)

    all_buys = [t for t in txns if t.transaction_type == "buy" and _txn_dt(t) >= lookback]
    historical_tickers = {t.ticker for t in all_buys if t.ticker and _txn_dt(t) < recent_cutoff}
    recent_buys = [t for t in all_buys if _txn_dt(t) >= recent_cutoff and t.ticker]

    # New tickers: bought in last 14d but never bought in prior 12 months
    new_ticker_buys = [t for t in recent_buys if t.ticker not in historical_tickers]
    new_tickers = list({t.ticker for t in new_ticker_buys})

    if len(new_tickers) < 2:
        return None

    return _Detection(
        event_type="performance_chasing",
        severity="medium",
        description=(
            f"Bought {len(new_tickers)} new ticker(s) in the last 14 days that you have no prior history with: "
            f"{', '.join(new_tickers[:5])}. "
            "Rapid diversification into unfamiliar assets can indicate chasing recent market performance."
        ),
        evidence={
            "new_tickers": new_tickers[:10],
            "new_ticker_count": len(new_tickers),
            "buy_count_14d": len(new_ticker_buys),
        },
        recommendation=(
            "Before investing in an unfamiliar asset, research its fundamentals and ensure it fits "
            "your risk model allocation. Avoid buying purely based on recent price performance."
        ),
    )


def _detect_concentration_addiction(db: Session, investor_id: uuid.UUID) -> _Detection | None:
    from app.models.investment_account import InvestmentAccount, InvestmentHolding

    accounts = (
        db.query(InvestmentAccount)
        .filter(InvestmentAccount.investor_id == investor_id)
        .all()
    )
    account_ids = [a.id for a in accounts]
    if not account_ids:
        return None

    holdings = (
        db.query(InvestmentHolding)
        .filter(
            InvestmentHolding.account_id.in_(account_ids),
            InvestmentHolding.current_value.isnot(None),
            InvestmentHolding.current_value > 0,
        )
        .all()
    )

    if not holdings:
        return None

    total_value = sum(h.current_value for h in holdings)
    if total_value <= 0:
        return None

    over_threshold = [
        {"name": h.name, "ticker": h.ticker, "pct": round(h.current_value / total_value * 100, 1)}
        for h in holdings
        if h.current_value / total_value > 0.40
    ]

    if not over_threshold:
        return None

    top = over_threshold[0]
    return _Detection(
        event_type="concentration_addiction",
        severity="high",
        description=(
            f"'{top['name']}' represents {top['pct']}% of your total portfolio value. "
            "Concentration above 40% in a single holding amplifies risk significantly."
        ),
        evidence={
            "concentrated_holdings": over_threshold[:3],
            "total_portfolio_value": round(total_value, 2),
        },
        recommendation=(
            "Consider diversifying by trimming the concentrated position into other risk-model-aligned assets. "
            "No single holding should represent more than 40% of a balanced portfolio."
        ),
    )


def _detect_risk_creep(db: Session, investor_id: uuid.UUID) -> _Detection | None:
    from app.risk_modeling.service import get_latest as get_latest_risk_model
    from app.models.portfolio_snapshot import PortfolioSnapshot

    risk_model = get_latest_risk_model(db, investor_id)
    snapshot = (
        db.query(PortfolioSnapshot)
        .filter(PortfolioSnapshot.investor_id == investor_id)
        .order_by(PortfolioSnapshot.snapshot_at.desc())
        .first()
    )

    if not risk_model or not snapshot:
        return None

    asset_alloc: dict[str, float] = snapshot.asset_allocation or {}
    _HIGH_RISK_TYPES = {"crypto", "call_option", "put_option"}
    _LOCKED_TYPES = {"pension_fund", "study_fund"}

    locked_pct = sum(v for k, v in asset_alloc.items() if k in _LOCKED_TYPES)
    tradeable_pct = max(0.0, 100.0 - locked_pct)

    if tradeable_pct < 5.0:
        return None

    raw_high_risk = sum(v for k, v in asset_alloc.items() if k in _HIGH_RISK_TYPES)
    actual_high_risk = round(raw_high_risk / tradeable_pct * 100, 1)
    target_high_risk = risk_model.high_risk_pct

    overshoot = actual_high_risk - target_high_risk
    if overshoot < 15.0:
        return None

    return _Detection(
        event_type="risk_creep",
        severity="medium",
        description=(
            f"Your high-risk allocation ({actual_high_risk}%) is {overshoot:.1f} percentage points above "
            f"your risk model target ({target_high_risk}%). "
            "Risk creep occurs when speculative positions gradually exceed your defined risk budget."
        ),
        evidence={
            "actual_high_risk_pct": actual_high_risk,
            "target_high_risk_pct": target_high_risk,
            "overshoot_pct": round(overshoot, 1),
        },
        recommendation=(
            "Consider trimming high-risk assets (crypto, options) to bring allocation back within "
            "your risk model target. Use the Strategy Drift page to review full allocation."
        ),
    )


def _detect_strategy_abandonment(txns: list[HoldingTransaction], db: Session, investor_id: uuid.UUID, now: datetime) -> _Detection | None:
    from app.models.investment_account import InvestmentAccount, InvestmentHolding

    trade_txns = [t for t in txns if t.transaction_type in ("buy", "sell")]
    if trade_txns:
        most_recent = max(trade_txns, key=lambda t: t.transaction_date)
        days_since = (now.date() - most_recent.transaction_date).days
    else:
        days_since = 999

    if days_since < 60:
        return None

    # Confirm investor actually has holdings
    accounts = db.query(InvestmentAccount).filter(InvestmentAccount.investor_id == investor_id).all()
    if not accounts:
        return None

    holding_count = (
        db.query(InvestmentHolding)
        .filter(InvestmentHolding.account_id.in_([a.id for a in accounts]))
        .count()
    )

    if holding_count == 0:
        return None

    return _Detection(
        event_type="strategy_abandonment",
        severity="low",
        description=(
            f"No buy or sell transactions recorded in the last {days_since} days, "
            f"despite having {holding_count} active holding(s). "
            "Inactivity may indicate strategy drift or disengagement."
        ),
        evidence={
            "days_since_last_trade": days_since,
            "holding_count": holding_count,
        },
        recommendation=(
            "Review your portfolio against your current risk model and goals. "
            "If your strategy is on track, record a manual review note. "
            "If not, consider rebalancing or adjusting your strategy."
        ),
    )


# ─── Main detection runner ────────────────────────────────────────────────────

def _txn_dt(t: HoldingTransaction) -> datetime:
    return datetime.combine(t.transaction_date, datetime.min.time()).replace(tzinfo=timezone.utc)


def detect_and_persist(db: Session, investor_id: uuid.UUID) -> list[BehavioralRiskEvent]:
    now = datetime.now(timezone.utc)
    lookback = now - timedelta(days=365)

    txns: list[HoldingTransaction] = (
        db.query(HoldingTransaction)
        .filter(
            HoldingTransaction.investor_id == investor_id,
            HoldingTransaction.transaction_date >= lookback.date(),
        )
        .order_by(HoldingTransaction.transaction_date.asc())
        .all()
    )

    # Load active events to skip duplicate types
    active_types = {
        row.event_type
        for row in db.query(BehavioralRiskEvent.event_type)
        .filter(
            BehavioralRiskEvent.investor_id == investor_id,
            BehavioralRiskEvent.status == "active",
        )
        .all()
    }

    detectors = [
        lambda: _detect_panic_selling(txns, now),
        lambda: _detect_revenge_trading(txns, now),
        lambda: _detect_overtrading_spike(txns, now),
        lambda: _detect_performance_chasing(txns, now),
        lambda: _detect_concentration_addiction(db, investor_id),
        lambda: _detect_risk_creep(db, investor_id),
        lambda: _detect_strategy_abandonment(txns, db, investor_id, now),
    ]

    created: list[BehavioralRiskEvent] = []
    for detect in detectors:
        try:
            result = detect()
        except Exception:
            continue

        if result is None:
            continue
        if result.event_type in active_types:
            continue

        event = BehavioralRiskEvent(
            investor_id=investor_id,
            event_type=result.event_type,
            severity=result.severity,
            status="active",
            detected_at=now,
            description=result.description,
            evidence=result.evidence,
            recommendation=result.recommendation,
        )
        db.add(event)
        active_types.add(result.event_type)
        created.append(event)

    if created:
        db.commit()
        for e in created:
            db.refresh(e)

    return created


# ─── Read helpers ─────────────────────────────────────────────────────────────

def get_events_response(db: Session, investor_id: uuid.UUID, status: str | None = None) -> BehavioralRiskListResponse:
    from app.behavioral_risk.schemas import SEVERITY_ORDER
    now = datetime.now(timezone.utc)

    q = db.query(BehavioralRiskEvent).filter(BehavioralRiskEvent.investor_id == investor_id)
    if status:
        q = q.filter(BehavioralRiskEvent.status == status)

    rows = q.order_by(BehavioralRiskEvent.detected_at.desc()).all()

    events = sorted(
        [BehavioralRiskEventResponse.from_orm_row(r) for r in rows],
        key=lambda e: (SEVERITY_ORDER.get(e.severity, 99), e.detected_at),
        reverse=False,
    )

    active_count = sum(1 for e in events if e.status == "active")
    resolved_count = sum(1 for e in events if e.status in ("resolved", "acknowledged"))

    return BehavioralRiskListResponse(
        investor_id=investor_id,
        events=events,
        active_count=active_count,
        resolved_count=resolved_count,
        generated_at=now,
    )


def get_event_response(db: Session, investor_id: uuid.UUID, event_id: uuid.UUID) -> BehavioralRiskEventResponse | None:
    row = (
        db.query(BehavioralRiskEvent)
        .filter(BehavioralRiskEvent.id == event_id, BehavioralRiskEvent.investor_id == investor_id)
        .first()
    )
    return BehavioralRiskEventResponse.from_orm_row(row) if row else None


def resolve_event(db: Session, investor_id: uuid.UUID, event_id: uuid.UUID) -> BehavioralRiskEventResponse | None:
    row = (
        db.query(BehavioralRiskEvent)
        .filter(BehavioralRiskEvent.id == event_id, BehavioralRiskEvent.investor_id == investor_id)
        .first()
    )
    if not row:
        return None

    now = datetime.now(timezone.utc)
    row.status = "resolved"
    row.resolved_at = now
    db.commit()
    db.refresh(row)
    return BehavioralRiskEventResponse.from_orm_row(row)


def run_detection_response(db: Session, investor_id: uuid.UUID) -> BehavioralRiskListResponse:
    detect_and_persist(db, investor_id)
    return get_events_response(db, investor_id)

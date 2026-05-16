"""Live trading gate checker and order risk validator.

Five hard gates — ALL must pass before any order is submitted:
  1. Paper trading: ≥30 calendar days old, ≥3 ticks, Sharpe ratio > 0.5
  2. Risk acknowledgment: investor explicitly acknowledged real-money risk
  3. Risk model: live_trading_allowed = True (admin-toggled per investor)
  4. Order risk: estimated_value / investable_capital <= max_trade_size_pct %
                 open order count < max_open_positions
  5. IBKR connection: gateway reachable and authenticated
"""
import math
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy.orm import Session

from app.live_trading.schemas import GateStatus, LiveTradingReadiness
from app.models.live_trading import LiveOrder, LiveTradingSession
from app.models.paper_trade import PaperPortfolio, PortfolioStatus
from app.risk_modeling import service as rm_service


# ── Sharpe helper ─────────────────────────────────────────────────────────────

def _compute_sharpe(monthly_returns: list[float]) -> float | None:
    """Annualised Sharpe from monthly return % series. Requires ≥3 data points."""
    n = len(monthly_returns)
    if n < 3:
        return None
    mean = sum(monthly_returns) / n
    variance = sum((r - mean) ** 2 for r in monthly_returns) / (n - 1)
    std = math.sqrt(variance)
    if std == 0:
        return None
    return round((mean / std) * math.sqrt(12), 3)


# ── Gate 1: paper trading history ─────────────────────────────────────────────

def _gate_paper_history(db: Session, investor_id: uuid.UUID) -> tuple[GateStatus, float | None, int | None]:
    portfolios = (
        db.query(PaperPortfolio)
        .filter(
            PaperPortfolio.investor_profile_id == investor_id,
            PaperPortfolio.status == PortfolioStatus.active,
        )
        .all()
    )

    best_sharpe: float | None = None
    best_days: int | None = None

    for p in portfolios:
        age_days = (datetime.now(timezone.utc) - p.started_at.replace(tzinfo=timezone.utc)).days
        ticks = p.ticks
        if age_days < 30 or len(ticks) < 3:
            continue
        returns = [t.monthly_return_pct for t in ticks]
        sharpe = _compute_sharpe(returns)
        if sharpe is not None and (best_sharpe is None or sharpe > best_sharpe):
            best_sharpe = sharpe
            best_days = age_days

    if best_sharpe is None:
        return (
            GateStatus(
                passed=False,
                label="Paper trading history",
                detail="Need an active paper portfolio ≥30 days old with ≥3 ticks.",
            ),
            None,
            None,
        )
    if best_sharpe < 0.5:
        return (
            GateStatus(
                passed=False,
                label="Paper trading history",
                detail=f"Best Sharpe ratio is {best_sharpe:.2f} — need >0.5.",
            ),
            best_sharpe,
            best_days,
        )
    return (
        GateStatus(
            passed=True,
            label="Paper trading history",
            detail=f"Sharpe ratio {best_sharpe:.2f} over {best_days} days.",
        ),
        best_sharpe,
        best_days,
    )


# ── Gate 2: risk acknowledgment ───────────────────────────────────────────────

def _gate_acknowledgment(db: Session, investor_id: uuid.UUID) -> GateStatus:
    session = (
        db.query(LiveTradingSession)
        .filter(
            LiveTradingSession.investor_id == investor_id,
            LiveTradingSession.acknowledged_risk == True,
        )
        .first()
    )
    if session is None:
        return GateStatus(
            passed=False,
            label="Risk acknowledgment",
            detail='You must acknowledge real-money risk by typing "I UNDERSTAND".',
        )
    return GateStatus(
        passed=True,
        label="Risk acknowledgment",
        detail=f"Acknowledged on {session.acknowledged_at.date() if session.acknowledged_at else 'unknown'}.",
    )


# ── Gate 3: admin live-trading enable ─────────────────────────────────────────

def _gate_admin_enabled(db: Session, investor_id: uuid.UUID) -> GateStatus:
    risk_model = rm_service.get_latest(db, investor_id)
    if risk_model is None:
        return GateStatus(
            passed=False,
            label="Admin approval",
            detail="No risk model found. Generate a risk model first.",
        )
    if not risk_model.live_trading_allowed:
        return GateStatus(
            passed=False,
            label="Admin approval",
            detail="Live trading not enabled for this account. Contact an admin.",
        )
    return GateStatus(
        passed=True,
        label="Admin approval",
        detail="Live trading enabled by admin.",
    )


# ── Gate 5: IBKR connectivity (called separately with gateway_url) ────────────

def check_ibkr_connection(gateway_url: str, ibkr_account_id: str, verify_ssl: bool = False) -> GateStatus:
    """Test IBKR Client Portal Gateway authentication status."""
    try:
        import httpx
        url = f"{gateway_url.rstrip('/')}/v1/api/iserver/auth/status"
        resp = httpx.get(url, verify=verify_ssl, timeout=5.0)
        if resp.status_code == 401:
            return GateStatus(
                passed=False,
                label="IBKR connection",
                detail="Gateway returned 401 — session not authenticated. Log in to IBKR Client Portal.",
            )
        resp.raise_for_status()
        data = resp.json()
        authenticated = data.get("authenticated", False)
        if not authenticated:
            return GateStatus(
                passed=False,
                label="IBKR connection",
                detail="IBKR gateway reachable but not authenticated. Complete gateway login.",
            )
        return GateStatus(
            passed=True,
            label="IBKR connection",
            detail=f"Connected to gateway at {gateway_url}.",
        )
    except Exception as exc:
        return GateStatus(
            passed=False,
            label="IBKR connection",
            detail=f"Cannot reach gateway: {exc}",
        )


# ── Full readiness check ──────────────────────────────────────────────────────

def check_readiness(
    db: Session,
    investor_id: uuid.UUID,
    gateway_url: str | None = None,
    ibkr_account_id: str | None = None,
) -> LiveTradingReadiness:
    gate_paper, sharpe, paper_days = _gate_paper_history(db, investor_id)
    gate_ack = _gate_acknowledgment(db, investor_id)
    gate_admin = _gate_admin_enabled(db, investor_id)

    if gateway_url and ibkr_account_id:
        gate_ibkr = check_ibkr_connection(gateway_url, ibkr_account_id)
    else:
        gate_ibkr = GateStatus(
            passed=False,
            label="IBKR connection",
            detail="Provide gateway_url and ibkr_account_id to test connection.",
        )

    gates = [gate_paper, gate_ack, gate_admin, gate_ibkr]
    return LiveTradingReadiness(
        all_gates_passed=all(g.passed for g in gates),
        gates=gates,
        sharpe_ratio=sharpe,
        paper_days=paper_days,
    )


# ── Order risk validation (gate 4) ───────────────────────────────────────────

def validate_order_risk(
    db: Session,
    investor_id: uuid.UUID,
    session_id: uuid.UUID,
    estimated_value: float,
) -> tuple[bool, str]:
    """Returns (passed, reason). Checks size limit and open position count."""
    risk_model = rm_service.get_latest(db, investor_id)
    if risk_model is None:
        return False, "No risk model found."

    investable = risk_model.investable_capital
    if investable > 0:
        size_pct = (estimated_value / investable) * 100
        if size_pct > risk_model.max_trade_size_pct:
            return (
                False,
                f"Order size {size_pct:.1f}% exceeds max {risk_model.max_trade_size_pct:.1f}% of investable capital.",
            )

    open_count = (
        db.query(LiveOrder)
        .filter(
            LiveOrder.session_id == session_id,
            LiveOrder.status.in_(["pending", "submitted"]),
        )
        .count()
    )
    if open_count >= risk_model.max_open_positions:
        return (
            False,
            f"Already {open_count} open order(s) — limit is {risk_model.max_open_positions}.",
        )

    return True, "OK"

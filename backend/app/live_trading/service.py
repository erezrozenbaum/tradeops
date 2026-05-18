import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.audit import service as audit
from app.live_trading import engine as gate_engine
from app.live_trading import ibkr as ibkr_client
from app.live_trading.schemas import AcknowledgeRiskRequest, OrderRequest
from app.market_data import service as market_data_svc
from app.models.investor_profile import InvestorProfile
from app.models.live_trading import LiveOrder, LiveTradingSession
from app.risk_modeling import service as rm_service


# ── Session management ────────────────────────────────────────────────────────

def get_active_session(db: Session, investor_id: uuid.UUID) -> LiveTradingSession | None:
    return (
        db.query(LiveTradingSession)
        .filter(
            LiveTradingSession.investor_id == investor_id,
            LiveTradingSession.is_active == True,
        )
        .first()
    )


def get_or_create_session(
    db: Session,
    investor_id: uuid.UUID,
    ibkr_account_id: str,
    gateway_url: str,
) -> LiveTradingSession:
    session = (
        db.query(LiveTradingSession)
        .filter(LiveTradingSession.investor_id == investor_id)
        .order_by(LiveTradingSession.created_at.desc())
        .first()
    )
    if session is None:
        session = LiveTradingSession(
            investor_id=investor_id,
            ibkr_account_id=ibkr_account_id,
            gateway_url=gateway_url,
        )
        db.add(session)
        db.commit()
        db.refresh(session)
    return session


# ── Risk acknowledgment ───────────────────────────────────────────────────────

def acknowledge_risk(
    db: Session,
    investor_id: uuid.UUID,
    body: AcknowledgeRiskRequest,
) -> LiveTradingSession:
    session = get_or_create_session(
        db, investor_id, body.ibkr_account_id, body.gateway_url
    )
    session.acknowledged_risk = True
    session.acknowledged_at = datetime.now(timezone.utc)
    session.ibkr_account_id = body.ibkr_account_id
    session.gateway_url = body.gateway_url
    db.commit()
    db.refresh(session)

    audit.log_event(
        db,
        event_type="live_trading.risk_acknowledged",
        description="Investor acknowledged real-money trading risk.",
        investor_profile_id=investor_id,
        metadata={"ibkr_account_id": body.ibkr_account_id},
    )
    return session


# ── Activate / deactivate ─────────────────────────────────────────────────────

def activate_session(
    db: Session,
    investor_id: uuid.UUID,
    gateway_url: str,
    ibkr_account_id: str,
) -> tuple[LiveTradingSession | None, str | None]:
    """Activate live trading after all gates pass. Returns (session, error)."""
    readiness = gate_engine.check_readiness(
        db, investor_id, gateway_url=gateway_url, ibkr_account_id=ibkr_account_id
    )
    if not readiness.all_gates_passed:
        failed = [g.label for g in readiness.gates if not g.passed]
        return None, f"Gates not met: {', '.join(failed)}"

    session = get_or_create_session(db, investor_id, ibkr_account_id, gateway_url)
    session.is_active = True
    session.halted_at = None
    session.halt_reason = None
    db.commit()
    db.refresh(session)

    audit.log_event(
        db,
        event_type="live_trading.session_activated",
        description="Live trading session activated.",
        investor_profile_id=investor_id,
        metadata={"session_id": str(session.id), "gateway_url": gateway_url},
    )
    return session, None


def halt(
    db: Session,
    investor_id: uuid.UUID,
    reason: str = "User requested halt",
) -> LiveTradingSession | None:
    """Kill switch: deactivate session and cancel all open IBKR orders."""
    session = get_active_session(db, investor_id)
    if session is None:
        return None

    # Best-effort cancel of all submitted orders
    open_orders = (
        db.query(LiveOrder)
        .filter(
            LiveOrder.session_id == session.id,
            LiveOrder.status.in_(["pending", "submitted"]),
        )
        .all()
    )
    for order in open_orders:
        if order.ibkr_order_id:
            ibkr_client.cancel_order(
                session.gateway_url,
                session.ibkr_account_id,
                order.ibkr_order_id,
            )
        order.status = "cancelled"

    session.is_active = False
    session.halted_at = datetime.now(timezone.utc)
    session.halt_reason = reason
    db.commit()
    db.refresh(session)

    audit.log_event(
        db,
        event_type="live_trading.session_halted",
        description=f"Live trading halted. Reason: {reason}",
        investor_profile_id=investor_id,
        metadata={"session_id": str(session.id), "reason": reason},
    )
    return session


# ── Order submission ──────────────────────────────────────────────────────────

def submit_order(
    db: Session,
    investor_id: uuid.UUID,
    body: OrderRequest,
) -> tuple[LiveOrder | None, str | None]:
    """Submit a live order through all safety gates. Returns (order, error)."""
    investor = db.get(InvestorProfile, investor_id)
    if investor and getattr(investor, "is_minor", False):
        return None, "Live trading is not permitted for minor accounts."

    session = get_active_session(db, investor_id)
    if session is None:
        return None, "No active live trading session. Activate session first."

    # Estimate value for risk check
    price_snap = market_data_svc.get_cached_price(db, body.ticker.upper())
    live_price = price_snap.price if price_snap else (body.limit_price or 0.0)
    estimated_value = live_price * body.quantity

    # Gate 4: order risk validation
    ok, risk_msg = gate_engine.validate_order_risk(
        db, investor_id, session.id, estimated_value
    )
    if not ok:
        return None, f"Risk gate rejected: {risk_msg}"

    # Look up IBKR contract ID
    conid, conid_err = ibkr_client.lookup_conid(
        session.gateway_url, body.ticker, verify_ssl=False
    )
    if conid is None:
        return None, f"Contract lookup failed: {conid_err}"

    # Create order record (pending) before submission
    order = LiveOrder(
        session_id=session.id,
        investor_id=investor_id,
        ticker=body.ticker.upper(),
        order_type=body.order_type,
        side=body.side,
        quantity=body.quantity,
        limit_price=body.limit_price,
        estimated_value=estimated_value,
        status="pending",
    )
    db.add(order)
    db.flush()

    # Submit to IBKR
    ibkr_order_id, submit_err = ibkr_client.submit_order(
        gateway_url=session.gateway_url,
        ibkr_account_id=session.ibkr_account_id,
        conid=conid,
        order_type=body.order_type,
        side=body.side,
        quantity=body.quantity,
        limit_price=body.limit_price,
        verify_ssl=False,
    )

    if submit_err:
        order.status = "rejected"
        order.rejection_reason = submit_err
    else:
        order.status = "submitted"
        order.ibkr_order_id = ibkr_order_id
        order.submitted_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(order)

    audit.log_event(
        db,
        event_type="live_trading.order_submitted" if not submit_err else "live_trading.order_rejected",
        description=(
            f"Live order {body.side.upper()} {body.quantity} {body.ticker.upper()} "
            f"({body.order_type}) — {'submitted' if not submit_err else 'rejected: ' + submit_err}"
        ),
        investor_profile_id=investor_id,
        metadata={
            "order_id": str(order.id),
            "ticker": body.ticker.upper(),
            "side": body.side,
            "quantity": body.quantity,
            "order_type": body.order_type,
            "estimated_value": estimated_value,
            "ibkr_order_id": ibkr_order_id,
            "error": submit_err,
        },
    )

    if submit_err:
        return order, f"Order rejected by IBKR: {submit_err}"
    return order, None


def list_orders(db: Session, investor_id: uuid.UUID) -> list[LiveOrder]:
    return (
        db.query(LiveOrder)
        .filter(LiveOrder.investor_id == investor_id)
        .order_by(LiveOrder.created_at.desc())
        .all()
    )

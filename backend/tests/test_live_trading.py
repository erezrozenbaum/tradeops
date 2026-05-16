"""Tests for live trading gates and order risk validation."""
import math
import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch

import pytest

from app.live_trading.engine import (
    _compute_sharpe,
    check_ibkr_connection,
    validate_order_risk,
)
from app.live_trading.schemas import AcknowledgeRiskRequest, OrderRequest


# ── Sharpe ratio ──────────────────────────────────────────────────────────────

def test_sharpe_basic():
    returns = [2.0, 1.5, 3.0, -0.5, 2.5]
    s = _compute_sharpe(returns)
    assert s is not None
    assert s > 0  # positive mean → positive Sharpe

def test_sharpe_too_few_points():
    assert _compute_sharpe([]) is None
    assert _compute_sharpe([1.0]) is None
    assert _compute_sharpe([1.0, 2.0]) is None

def test_sharpe_zero_std():
    # All same returns → std = 0 → undefined
    assert _compute_sharpe([1.0, 1.0, 1.0]) is None

def test_sharpe_negative():
    returns = [-2.0, -1.5, -3.0, -0.5, -2.5]
    s = _compute_sharpe(returns)
    assert s is not None
    assert s < 0


# ── Schema validation ─────────────────────────────────────────────────────────

def test_acknowledge_requires_exact_phrase():
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        AcknowledgeRiskRequest(
            confirmation="i understand",  # wrong case
            ibkr_account_id="U123",
            gateway_url="https://localhost:5000",
        )

def test_acknowledge_exact_phrase_ok():
    req = AcknowledgeRiskRequest(
        confirmation="I UNDERSTAND",
        ibkr_account_id="U123",
        gateway_url="https://localhost:5000",
    )
    assert req.confirmation == "I UNDERSTAND"

def test_order_limit_requires_price():
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        OrderRequest(
            ticker="AAPL",
            order_type="limit",
            side="buy",
            quantity=10,
            limit_price=None,  # missing for limit
        )

def test_order_market_no_price_ok():
    req = OrderRequest(
        ticker="AAPL",
        order_type="market",
        side="buy",
        quantity=10,
    )
    assert req.ticker == "AAPL"

def test_order_negative_quantity_rejected():
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        OrderRequest(
            ticker="AAPL",
            order_type="market",
            side="buy",
            quantity=-5,
        )


# ── Order risk validation ─────────────────────────────────────────────────────

def _make_db(investable=100_000.0, max_trade_pct=2.0, max_open=3, open_order_count=0):
    """Build a mock DB that returns a risk model and an open order count."""
    risk_model = MagicMock()
    risk_model.investable_capital = investable
    risk_model.max_trade_size_pct = max_trade_pct
    risk_model.max_open_positions = max_open

    db = MagicMock()
    # db.query(...).filter(...).count() → open_order_count
    db.query.return_value.filter.return_value.count.return_value = open_order_count

    return db, risk_model

def test_order_risk_size_too_large():
    with patch("app.live_trading.engine.rm_service.get_latest") as mock_rm:
        db, rm = _make_db(investable=100_000, max_trade_pct=2.0)
        mock_rm.return_value = rm
        # 5000 / 100000 = 5% > 2% max
        passed, msg = validate_order_risk(db, uuid.uuid4(), uuid.uuid4(), estimated_value=5_000)
        assert not passed
        assert "exceeds max" in msg

def test_order_risk_size_ok():
    with patch("app.live_trading.engine.rm_service.get_latest") as mock_rm:
        db, rm = _make_db(investable=100_000, max_trade_pct=2.0, max_open=3, open_order_count=0)
        mock_rm.return_value = rm
        # 1500 / 100000 = 1.5% < 2% max, 0 open orders < 3
        passed, msg = validate_order_risk(db, uuid.uuid4(), uuid.uuid4(), estimated_value=1_500)
        assert passed

def test_order_risk_too_many_open():
    with patch("app.live_trading.engine.rm_service.get_latest") as mock_rm:
        db, rm = _make_db(investable=100_000, max_trade_pct=2.0, max_open=3, open_order_count=3)
        mock_rm.return_value = rm
        passed, msg = validate_order_risk(db, uuid.uuid4(), uuid.uuid4(), estimated_value=500)
        assert not passed
        assert "open order" in msg.lower()

def test_order_risk_no_risk_model():
    with patch("app.live_trading.engine.rm_service.get_latest") as mock_rm:
        mock_rm.return_value = None
        db = MagicMock()
        passed, msg = validate_order_risk(db, uuid.uuid4(), uuid.uuid4(), estimated_value=500)
        assert not passed
        assert "risk model" in msg.lower()


# ── IBKR connection gate ──────────────────────────────────────────────────────

def test_ibkr_connection_success():
    with patch("httpx.get") as mock_get:
        mock_get.return_value = MagicMock(
            status_code=200,
            json=lambda: {"authenticated": True},
        )
        gate = check_ibkr_connection("https://localhost:5000", "U123456")
        assert gate.passed
        assert "Connected" in gate.detail

def test_ibkr_connection_not_authenticated():
    with patch("httpx.get") as mock_get:
        mock_get.return_value = MagicMock(
            status_code=200,
            json=lambda: {"authenticated": False},
        )
        gate = check_ibkr_connection("https://localhost:5000", "U123456")
        assert not gate.passed
        assert "not authenticated" in gate.detail.lower()

def test_ibkr_connection_401():
    with patch("httpx.get") as mock_get:
        resp = MagicMock()
        resp.status_code = 401
        mock_get.return_value = resp
        gate = check_ibkr_connection("https://localhost:5000", "U123456")
        assert not gate.passed
        assert "401" in gate.detail

def test_ibkr_connection_unreachable():
    with patch("httpx.get", side_effect=Exception("Connection refused")):
        gate = check_ibkr_connection("https://localhost:5000", "U123456")
        assert not gate.passed
        assert "Cannot reach" in gate.detail

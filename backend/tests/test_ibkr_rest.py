"""Tests for IBKR REST API connector — no actual HTTP calls."""
import json
from unittest.mock import MagicMock, patch

import pytest
import httpx

from app.broker_sync.ibkr_rest import fetch_positions, _ASSET_TYPE_MAP


class TestAssetTypeMap:
    def test_stock_mapped(self):
        assert _ASSET_TYPE_MAP["STK"] == "stock"

    def test_etf_mapped(self):
        assert _ASSET_TYPE_MAP["ETF"] == "etf"

    def test_crypto_mapped(self):
        assert _ASSET_TYPE_MAP["CRYPTO"] == "crypto"


class TestFetchPositionsParsing:
    def _mock_response(self, payload: list) -> MagicMock:
        resp = MagicMock()
        resp.json.return_value = payload
        resp.raise_for_status.return_value = None
        return resp

    @patch("httpx.Client")
    def test_successful_fetch(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        mock_client.get.return_value = self._mock_response([
            {
                "ticker": "AAPL",
                "contractDesc": "Apple Inc",
                "currency": "USD",
                "assetClass": "STK",
                "position": 10.0,
                "avgPrice": 150.0,
                "mktPrice": 175.0,
                "mktValue": 1750.0,
            }
        ])
        rows, errors = fetch_positions("https://localhost:5000", "U1234567")
        assert len(rows) == 1
        assert rows[0].ticker == "AAPL"
        assert rows[0].quantity == 10.0
        assert rows[0].current_value == 1750.0
        assert rows[0].asset_type == "stock"
        assert errors == []

    @patch("httpx.Client")
    def test_skips_zero_quantity(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        mock_client.get.return_value = self._mock_response([
            {"ticker": "AAPL", "contractDesc": "Apple", "currency": "USD", "assetClass": "STK",
             "position": 0.0, "avgPrice": 150.0, "mktValue": 0.0},
        ])
        rows, errors = fetch_positions("https://localhost:5000", "U123")
        assert rows == []

    @patch("httpx.Client")
    def test_connection_error_returns_error(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        mock_client.get.side_effect = httpx.ConnectError("refused")
        rows, errors = fetch_positions("https://localhost:5000", "U123")
        assert rows == []
        assert len(errors) == 1
        assert "connect" in errors[0].lower() or "gateway" in errors[0].lower()

    @patch("httpx.Client")
    def test_401_returns_session_error(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        resp = MagicMock()
        resp.status_code = 401
        mock_client.get.side_effect = httpx.HTTPStatusError("401", request=MagicMock(), response=resp)
        rows, errors = fetch_positions("https://localhost:5000", "U123")
        assert rows == []
        assert "session" in errors[0].lower() or "401" in errors[0] or "authenticate" in errors[0].lower()

    @patch("httpx.Client")
    def test_unexpected_format_returns_error(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        resp = MagicMock()
        resp.json.return_value = {"error": "not a list"}
        resp.raise_for_status.return_value = None
        mock_client.get.return_value = resp
        rows, errors = fetch_positions("https://localhost:5000", "U123")
        assert rows == []
        assert len(errors) == 1

    @patch("httpx.Client")
    def test_multiple_asset_types(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        mock_client.get.return_value = self._mock_response([
            {"ticker": "SPY", "contractDesc": "SPDR ETF", "currency": "USD",
             "assetClass": "ETF", "position": 5.0, "avgPrice": 450.0, "mktValue": 2250.0},
            {"ticker": "BTC", "contractDesc": "Bitcoin", "currency": "USD",
             "assetClass": "CRYPTO", "position": 0.5, "avgPrice": 40000.0, "mktValue": 22000.0},
        ])
        rows, errors = fetch_positions("https://localhost:5000", "U123")
        assert len(rows) == 2
        assert rows[0].asset_type == "etf"
        assert rows[1].asset_type == "crypto"

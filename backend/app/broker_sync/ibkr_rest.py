"""IBKR Client Portal REST API connector.

Fetches live portfolio positions directly from the IBKR Client Portal Gateway.

Gateway setup (user-side):
  1. Run IBKR Client Portal Gateway (Docker or local Java).
  2. Authenticate via browser at https://localhost:5000.
  3. Use the session cookie or just hit the API from localhost.

This connector only reads data — no trade execution.

Endpoint used:
  GET /portfolio/{accountId}/positions/0
  → returns JSON list of position objects

Key fields mapped:
  contractDesc / description → name
  symbol → ticker
  position → quantity
  mktPrice → unit_price
  mktValue → current_value
  avgPrice / avgCost → avg_buy_price
  currency → currency
  assetClass → asset_type
"""
from __future__ import annotations

import logging
import ssl

import httpx

from app.broker_sync.schemas import BrokerImportRow

log = logging.getLogger(__name__)

_ASSET_TYPE_MAP = {
    "STK": "stock",
    "BOND": "bond",
    "OPT": "other",
    "FUT": "other",
    "ETF": "etf",
    "FUND": "fund",
    "CRYPTO": "crypto",
    "WAR": "other",
}


def fetch_positions(
    gateway_url: str,
    ibkr_account_id: str,
    verify_ssl: bool = False,
) -> tuple[list[BrokerImportRow], list[str]]:
    """Fetch and parse positions from IBKR Client Portal Gateway.

    Args:
        gateway_url: Base URL of the running gateway (e.g. "https://localhost:5000").
        ibkr_account_id: IBKR account ID (e.g. "U1234567").
        verify_ssl: Set False for local self-signed gateway cert (default).

    Returns (rows, errors).
    """
    url = f"{gateway_url.rstrip('/')}/v1/api/portfolio/{ibkr_account_id}/positions/0"

    try:
        client = httpx.Client(verify=verify_ssl, timeout=15.0)
        resp = client.get(url)
        resp.raise_for_status()
        positions = resp.json()
    except httpx.ConnectError:
        return [], [
            f"Cannot connect to IBKR Gateway at {gateway_url}. "
            "Ensure the gateway is running and you are authenticated via browser."
        ]
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 401:
            return [], ["IBKR session expired — re-authenticate at the gateway browser login page."]
        return [], [f"IBKR gateway returned HTTP {exc.response.status_code}."]
    except Exception as exc:
        return [], [f"IBKR REST fetch failed: {exc}"]

    if not isinstance(positions, list):
        return [], ["Unexpected response format from IBKR gateway."]

    rows: list[BrokerImportRow] = []
    errors: list[str] = []

    for i, pos in enumerate(positions, start=1):
        try:
            symbol = str(pos.get("ticker") or pos.get("symbol") or "").strip()
            name = str(pos.get("contractDesc") or pos.get("description") or symbol or "Unknown").strip()
            currency = str(pos.get("currency") or "USD").upper()
            asset_class = str(pos.get("assetClass") or pos.get("secType") or "STK").upper()

            quantity = float(pos.get("position") or 0)
            if quantity == 0:
                continue

            avg_buy_price = float(pos.get("avgPrice") or pos.get("avgCost") or 0)
            mkt_price = float(pos.get("mktPrice") or 0)
            mkt_value = float(pos.get("mktValue") or 0)
            current_value = mkt_value if mkt_value else (round(quantity * mkt_price, 2) if mkt_price else None)

            asset_type = _ASSET_TYPE_MAP.get(asset_class, "other")

            rows.append(BrokerImportRow(
                ticker=symbol or None,
                name=name[:200],
                asset_type=asset_type,
                quantity=quantity,
                avg_buy_price=avg_buy_price,
                current_value=current_value,
                currency=currency,
            ))
        except Exception as exc:
            errors.append(f"Position {i}: {exc}")

    return rows, errors

"""IBKR Client Portal Gateway — order submission and management.

All calls are best-effort. Errors are returned as (None, error_message)
rather than raising, so the caller can log and handle gracefully.
"""
from typing import Optional

import httpx


def _client(gateway_url: str, verify_ssl: bool) -> httpx.Client:
    return httpx.Client(
        base_url=gateway_url.rstrip("/"),
        verify=verify_ssl,
        timeout=10.0,
    )


def lookup_conid(
    gateway_url: str,
    ticker: str,
    verify_ssl: bool = False,
) -> tuple[Optional[int], Optional[str]]:
    """Search for IBKR contract ID (conid) by ticker symbol.

    Returns (conid, None) on success or (None, error_message) on failure.
    Prefers US stocks (STK, USD) when multiple contracts are returned.
    """
    try:
        with _client(gateway_url, verify_ssl) as c:
            resp = c.get(
                "/v1/api/iserver/secdef/search",
                params={"symbol": ticker.upper(), "name": False, "secType": "STK"},
            )
            if resp.status_code == 401:
                return None, "IBKR session not authenticated — complete gateway login."
            resp.raise_for_status()
            results = resp.json()
            if not results:
                return None, f"No contract found for ticker '{ticker}'."
            # Prefer USD-denominated US stocks
            for r in results:
                if r.get("currency") == "USD" and r.get("description", "").startswith("STK"):
                    return int(r["conid"]), None
            # Fall back to first result
            return int(results[0]["conid"]), None
    except Exception as exc:
        return None, f"conid lookup failed: {exc}"


def submit_order(
    gateway_url: str,
    ibkr_account_id: str,
    conid: int,
    order_type: str,   # "market" | "limit"
    side: str,         # "buy" | "sell"
    quantity: float,
    limit_price: float | None = None,
    verify_ssl: bool = False,
) -> tuple[Optional[str], Optional[str]]:
    """Submit a single order to IBKR.

    Returns (ibkr_order_id, None) on success or (None, error_message) on failure.
    """
    ibkr_order_type = "MKT" if order_type == "market" else "LMT"
    payload: dict = {
        "orders": [
            {
                "conid": conid,
                "orderType": ibkr_order_type,
                "side": side.upper(),
                "quantity": quantity,
                "tif": "DAY",
            }
        ]
    }
    if ibkr_order_type == "LMT" and limit_price is not None:
        payload["orders"][0]["price"] = limit_price

    try:
        with _client(gateway_url, verify_ssl) as c:
            resp = c.post(
                f"/v1/api/iserver/account/{ibkr_account_id}/orders",
                json=payload,
            )
            if resp.status_code == 401:
                return None, "IBKR session not authenticated."
            resp.raise_for_status()
            data = resp.json()
            # Response is a list; first element has the order ID
            if isinstance(data, list) and data:
                order_id = str(data[0].get("order_id") or data[0].get("orderId") or "unknown")
                return order_id, None
            return None, f"Unexpected IBKR response: {data}"
    except Exception as exc:
        return None, f"Order submission failed: {exc}"


def cancel_order(
    gateway_url: str,
    ibkr_account_id: str,
    ibkr_order_id: str,
    verify_ssl: bool = False,
) -> Optional[str]:
    """Cancel an open order. Returns error message or None on success."""
    try:
        with _client(gateway_url, verify_ssl) as c:
            resp = c.delete(
                f"/v1/api/iserver/account/{ibkr_account_id}/order/{ibkr_order_id}"
            )
            if resp.status_code in (200, 204):
                return None
            return f"Cancel returned HTTP {resp.status_code}: {resp.text[:200]}"
    except Exception as exc:
        return f"Cancel failed: {exc}"

"""IBKR Flex Query XML parser.

Expected format: Flex Query Report exported from IBKR Account Management.
Key XML element: <OpenPosition> with attributes:
  symbol, isin, description, position, costBasisPrice, markPrice, currency, assetCategory
"""
import defusedxml
import defusedxml.ElementTree as ET

from app.broker_sync.schemas import BrokerImportRow

_ASSET_TYPE_MAP = {
    "STK": "stock",
    "BOND": "bond",
    "OPT": "other",
    "FUT": "other",
    "ETF": "etf",
    "FUND": "fund",
    "CRYPTO": "crypto",
    "WAR": "other",
    "RIGHT": "other",
}


def parse(content: bytes, filename: str) -> tuple[list[BrokerImportRow], list[str]]:
    rows: list[BrokerImportRow] = []
    errors: list[str] = []

    try:
        root = ET.fromstring(content)
    except (ET.ParseError, defusedxml.DefusedXmlException, ValueError) as exc:
        return [], [f"Invalid XML: {exc}"]

    positions = list(root.iter("OpenPosition"))
    if not positions:
        return [], ["No <OpenPosition> elements found — ensure this is an IBKR Flex Query report with open positions."]

    for i, pos in enumerate(positions, start=1):
        try:
            symbol = (pos.get("symbol") or "").strip()
            isin = (pos.get("isin") or "").strip() or None
            description = (pos.get("description") or symbol).strip()
            currency = (pos.get("currency") or "USD").strip().upper()
            asset_category = (pos.get("assetCategory") or "STK").strip().upper()

            raw_qty = pos.get("position") or pos.get("quantity") or "0"
            quantity = float(raw_qty)
            if quantity == 0:
                continue

            raw_cost = pos.get("costBasisPrice") or pos.get("avgCost") or "0"
            avg_buy_price = float(raw_cost)

            raw_mark = pos.get("markPrice") or pos.get("closePrice") or "0"
            mark_price = float(raw_mark)
            current_value = round(quantity * mark_price, 2) if mark_price else None

            asset_type = _ASSET_TYPE_MAP.get(asset_category, "other")

            rows.append(BrokerImportRow(
                ticker=symbol or None,
                isin=isin,
                name=description or symbol,
                asset_type=asset_type,
                quantity=quantity,
                avg_buy_price=avg_buy_price,
                current_value=current_value,
                currency=currency,
            ))
        except (ValueError, TypeError) as exc:
            errors.append(f"Position {i} ({pos.get('symbol', '?')}): {exc}")

    return rows, errors

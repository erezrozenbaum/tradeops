"""eToro portfolio CSV parser.

eToro portfolio export (CSV downloaded from eToro web):
Expected columns (case-insensitive):
  Asset, Units, Avg. Open Rate, Estimated Current Value, P&L Amount, Type

'Type' values seen: Real, CFD — we only import Real (actual ownership).
"""
import csv
import io

from app.broker_sync.schemas import BrokerImportRow

_TYPE_MAP = {
    "stock": "stock",
    "etf": "etf",
    "crypto": "crypto",
    "currency": "other",
    "commodity": "other",
    "index": "etf",
}


def _norm(headers: list[str]) -> dict[str, str]:
    """Return lower-stripped → original mapping."""
    return {h.strip().lower(): h for h in headers}


def parse(content: bytes, filename: str) -> tuple[list[BrokerImportRow], list[str]]:
    rows: list[BrokerImportRow] = []
    errors: list[str] = []

    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        return [], ["CSV is empty or has no header row"]

    # Build case-insensitive column index
    col = {h.strip().lower().replace(".", "").replace(" ", "_"): h for h in reader.fieldnames}

    # Column name candidates
    def _get(row: dict, *candidates: str) -> str:
        for c in candidates:
            key = col.get(c)
            if key and row.get(key, "").strip():
                return row[key].strip()
        return ""

    for i, raw in enumerate(reader, start=2):
        try:
            asset = _get(raw, "asset", "name", "ticker", "instrument")
            if not asset:
                errors.append(f"Row {i}: missing asset name — skipped")
                continue

            position_type = _get(raw, "type", "position_type").lower()
            # Skip CFD positions — they are not owned securities
            if position_type == "cfd":
                continue

            raw_units = _get(raw, "units", "quantity", "amount")
            quantity = float(raw_units.replace(",", "")) if raw_units else 0.0
            if quantity <= 0:
                continue

            raw_price = _get(raw, "avg_open_rate", "avg_open", "average_open_rate", "open_rate")
            avg_buy_price = float(raw_price.replace(",", "")) if raw_price else 0.0

            raw_value = _get(raw, "estimated_current_value", "current_value", "value", "market_value")
            current_value = float(raw_value.replace(",", "")) if raw_value else None

            instrument_type = _get(raw, "instrument_type", "category", "asset_type").lower()
            asset_type = _TYPE_MAP.get(instrument_type, "stock")

            rows.append(BrokerImportRow(
                ticker=asset,
                isin=None,
                name=asset,
                asset_type=asset_type,
                quantity=quantity,
                avg_buy_price=avg_buy_price,
                current_value=current_value,
                currency="USD",
            ))
        except (ValueError, TypeError) as exc:
            errors.append(f"Row {i}: {exc}")

    return rows, errors

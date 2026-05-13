"""Altshuler Shaham Trade (אלטשולר שחם טריד) portfolio export parser.

Supports both CSV and Excel (.xlsx) exports.

Altshuler Shaham Trade exports a bilingual (Hebrew/English) file.
Hebrew column names are mapped alongside their English equivalents.

Known column aliases (normalised to lowercase after stripping):
  Name / שם ני"ע / שם / security name / instrument
  ISIN / מספר isin / isin code
  Quantity / כמות / qty
  Avg Price / מחיר ממוצע / average price / מחיר קנייה ממוצע / unit cost
  Market Value / שווי / שווי שוק / value / current value / market value
  Currency / מטבע / cur
  Asset Type / סוג נייר / type
"""
import csv
import io
from typing import Any

from app.broker_sync.schemas import BrokerImportRow

# Maps normalised column name → canonical key
_COL_ALIASES: dict[str, str] = {
    # name
    'שם ני"ע': "name",
    "שם ני\"ע": "name",
    "שם נ\"ע": "name",
    "שם": "name",
    "name": "name",
    "security name": "name",
    "instrument": "name",
    "security": "name",
    "נייר ערך": "name",
    # isin
    "isin": "isin",
    "מספר isin": "isin",
    "isin code": "isin",
    "isin number": "isin",
    # quantity
    "כמות": "quantity",
    "quantity": "quantity",
    "qty": "quantity",
    "units": "quantity",
    "מניות": "quantity",
    # avg price
    "מחיר ממוצע": "avg_price",
    "מחיר קנייה ממוצע": "avg_price",
    "average price": "avg_price",
    "avg price": "avg_price",
    "avg. price": "avg_price",
    "unit cost": "avg_price",
    "cost price": "avg_price",
    "purchase price": "avg_price",
    # market value
    "שווי": "market_value",
    "שווי שוק": "market_value",
    "שווי נוכחי": "market_value",
    "market value": "market_value",
    "current value": "market_value",
    "value": "market_value",
    "estimated value": "market_value",
    # currency
    "מטבע": "currency",
    "currency": "currency",
    "cur": "currency",
    "ccy": "currency",
    # asset type
    "סוג נייר": "asset_type",
    "סוג": "asset_type",
    "type": "asset_type",
    "asset type": "asset_type",
    "instrument type": "asset_type",
}

_ASSET_TYPE_MAP = {
    "מניה": "stock",
    "אג\"ח": "bond",
    "אגח": "bond",
    "קרן": "fund",
    "etf": "etf",
    "קריפטו": "crypto",
    "stock": "stock",
    "bond": "bond",
    "fund": "fund",
    "crypto": "crypto",
}


def _map_columns(headers: list[str]) -> dict[str, int]:
    """Return canonical_key → column_index mapping."""
    result: dict[str, int] = {}
    for idx, h in enumerate(headers):
        normalised = h.strip().lower()
        canonical = _COL_ALIASES.get(normalised) or _COL_ALIASES.get(h.strip())
        if canonical and canonical not in result:
            result[canonical] = idx
    return result


def _parse_rows(rows_iter: list[list[Any]]) -> tuple[list[BrokerImportRow], list[str]]:
    results: list[BrokerImportRow] = []
    errors: list[str] = []

    headers: list[str] = []
    col_map: dict[str, int] = {}

    for row_num, row in enumerate(rows_iter, start=1):
        # Find header row (first row with recognisable columns)
        if not headers:
            str_row = [str(c).strip() if c is not None else "" for c in row]
            candidate = _map_columns(str_row)
            if "name" in candidate or "quantity" in candidate:
                headers = str_row
                col_map = candidate
            continue

        def get(key: str) -> str:
            idx = col_map.get(key)
            if idx is None or idx >= len(row):
                return ""
            val = row[idx]
            return str(val).strip() if val is not None else ""

        name = get("name")
        if not name or name.lower() in ("total", "סה\"כ", "סהכ", "grand total", ""):
            continue

        try:
            raw_qty = get("quantity").replace(",", "")
            quantity = float(raw_qty) if raw_qty else 0.0
            if quantity <= 0:
                continue

            raw_price = get("avg_price").replace(",", "")
            avg_buy_price = float(raw_price) if raw_price else 0.0

            raw_value = get("market_value").replace(",", "")
            current_value = float(raw_value) if raw_value else None

            isin = get("isin") or None
            if isin:
                isin = isin.upper()

            currency = get("currency").upper() or "ILS"

            raw_type = get("asset_type").lower()
            asset_type = _ASSET_TYPE_MAP.get(raw_type, "stock")

            results.append(BrokerImportRow(
                ticker=None,
                isin=isin,
                name=name,
                asset_type=asset_type,
                quantity=quantity,
                avg_buy_price=avg_buy_price,
                current_value=current_value,
                currency=currency,
            ))
        except (ValueError, TypeError) as exc:
            errors.append(f"Row {row_num}: {exc}")

    if not headers:
        errors.append(
            "Could not identify header row. "
            "Expected columns: Name/שם, Quantity/כמות, Avg Price/מחיר ממוצע, Currency/מטבע"
        )

    return results, errors


def _parse_csv(content: bytes) -> tuple[list[BrokerImportRow], list[str]]:
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            text = content.decode("windows-1255")  # Hebrew Windows encoding
        except UnicodeDecodeError:
            text = content.decode("latin-1")

    reader = csv.reader(io.StringIO(text))
    rows = [row for row in reader if any(c.strip() for c in row)]
    return _parse_rows(rows)


def _parse_xlsx(content: bytes) -> tuple[list[BrokerImportRow], list[str]]:
    try:
        import openpyxl
    except ImportError:
        return [], ["openpyxl is required for Excel import — contact your administrator"]

    import io as _io
    wb = openpyxl.load_workbook(_io.BytesIO(content), read_only=True, data_only=True)
    ws = wb.active
    rows = [[cell.value for cell in row] for row in ws.iter_rows()]
    return _parse_rows(rows)


def parse(content: bytes, filename: str) -> tuple[list[BrokerImportRow], list[str]]:
    if filename.lower().endswith((".xlsx", ".xls")):
        return _parse_xlsx(content)
    return _parse_csv(content)

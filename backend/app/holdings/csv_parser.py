"""Parse a CSV file of holdings into InvestmentHoldingCreate instances.

Expected CSV columns (header row required):
  name, asset_type, currency              — required
  ticker, isin, quantity, avg_buy_price,
  purchase_date (YYYY-MM-DD), notes       — optional

asset_type must be one of the HoldingAssetType enum values.
"""
import csv
import io
from datetime import date

from app.schemas.investment_account import InvestmentHoldingCreate

_VALID_ASSET_TYPES = {
    "stock", "bond", "etf", "crypto", "fund",
    "real_estate", "other", "pension_fund", "study_fund",
}

_REQUIRED = {"name", "asset_type", "currency"}


def parse_holdings_csv(
    content: bytes,
) -> tuple[list[InvestmentHoldingCreate], list[str]]:
    """Return (valid_holdings, error_messages). Errors are non-fatal — valid rows are still returned."""
    rows: list[InvestmentHoldingCreate] = []
    errors: list[str] = []

    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))

    if not reader.fieldnames:
        return [], ["CSV file is empty or has no header row"]

    missing = _REQUIRED - {f.strip().lower() for f in reader.fieldnames}
    if missing:
        return [], [f"CSV is missing required columns: {', '.join(sorted(missing))}"]

    for i, raw in enumerate(reader, start=2):
        row = {k.strip().lower(): (v or "").strip() for k, v in raw.items()}
        try:
            asset_type = row["asset_type"].lower()
            if asset_type not in _VALID_ASSET_TYPES:
                errors.append(
                    f"Row {i}: invalid asset_type '{row['asset_type']}' — "
                    f"valid values: {', '.join(sorted(_VALID_ASSET_TYPES))}"
                )
                continue

            purchase_date: date | None = None
            if row.get("purchase_date"):
                purchase_date = date.fromisoformat(row["purchase_date"])

            rows.append(
                InvestmentHoldingCreate(
                    name=row["name"],
                    asset_type=asset_type,  # type: ignore[arg-type]
                    currency=row["currency"].upper(),
                    ticker=row.get("ticker") or None,
                    isin=row.get("isin") or None,
                    quantity=float(row["quantity"]) if row.get("quantity") else 0.0,
                    avg_buy_price=float(row["avg_buy_price"]) if row.get("avg_buy_price") else 0.0,
                    purchase_date=purchase_date,
                    notes=row.get("notes") or None,
                )
            )
        except ValueError as exc:
            errors.append(f"Row {i}: {exc}")
        except Exception as exc:  # noqa: BLE001
            errors.append(f"Row {i}: unexpected error — {exc}")

    return rows, errors

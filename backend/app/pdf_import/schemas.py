from __future__ import annotations

from pydantic import BaseModel, Field


class ParsedHolding(BaseModel):
    name: str
    ticker: str | None = None
    isin: str | None = None
    asset_type: str = "stock"           # stock | etf | bond | crypto | cash | other
    quantity: float = 0.0
    avg_buy_price: float = 0.0
    current_value: float | None = None
    currency: str = "USD"
    notes: str | None = None


class PDFImportResult(BaseModel):
    broker_name: str | None = None      # detected broker name from the statement
    statement_date: str | None = None   # detected date string from the statement
    currency: str | None = None         # detected base currency
    holdings: list[ParsedHolding]
    raw_text_length: int                # chars of extracted text (for debugging)
    pages_parsed: int
    parse_notes: str | None = None      # any warnings/caveats from the AI


class PDFImportRequest(BaseModel):
    account_id: str = Field(..., description="Target investment account UUID to import into")

"""PDF Statement parser.

Flow:
  1. Extract raw text from all PDF pages using pypdf.
  2. Send text to Claude with a structured extraction prompt.
  3. Parse Claude's JSON response into ParsedHolding list.

Supports any broker format — Claude handles the unstructured table parsing.
Max PDF size: 10 MB. Max text sent to Claude: 12,000 chars (truncated from middle if larger).
"""
from __future__ import annotations

import json
import logging

import anthropic

from app.pdf_import.schemas import PDFImportResult, ParsedHolding

log = logging.getLogger(__name__)

_MAX_TEXT_CHARS = 12_000

_SYSTEM_PROMPT = """\
You are a financial data extraction assistant. Your only job is to parse brokerage PDF statement text
and extract holdings data as a structured JSON object.

Rules:
- Extract ALL holdings you can identify (stocks, ETFs, bonds, funds, crypto, cash positions).
- Use standard 3-character currency codes (USD, EUR, ILS, GBP, etc.).
- For asset_type use only: stock | etf | bond | crypto | cash | fund | option | other
- If a field is unknown or not present, use null (not 0, not empty string).
- quantity: number of shares/units. avg_buy_price: average purchase price per unit. current_value: total market value.
- Do NOT invent data. Only extract what is explicitly present in the text.
- Broker name and statement date: extract if clearly visible.

Respond ONLY with a valid JSON object — no markdown, no code fences:
{
  "broker_name": "<name or null>",
  "statement_date": "<YYYY-MM-DD or date string or null>",
  "currency": "<detected base currency or null>",
  "holdings": [
    {
      "name": "<full instrument name>",
      "ticker": "<ticker symbol or null>",
      "isin": "<ISIN or null>",
      "asset_type": "<stock|etf|bond|crypto|cash|fund|option|other>",
      "quantity": <number or null>,
      "avg_buy_price": <number or null>,
      "current_value": <number or null>,
      "currency": "<3-char code>",
      "notes": "<any relevant notes or null>"
    }
  ],
  "parse_notes": "<any caveats, warnings, or quality issues with the extraction — or null>"
}
"""


def _extract_text_from_pdf(pdf_bytes: bytes) -> tuple[str, int]:
    """Return (raw_text, page_count) from PDF bytes using pypdf."""
    import io
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(pdf_bytes))
    pages = []
    for page in reader.pages:
        text = page.extract_text() or ""
        pages.append(text)
    return "\n\n".join(pages), len(reader.pages)


def _truncate_text(text: str, max_chars: int = _MAX_TEXT_CHARS) -> str:
    """If text > max_chars, keep the first 60% and last 40% (header + footer/table)."""
    if len(text) <= max_chars:
        return text
    head = int(max_chars * 0.6)
    tail = max_chars - head
    return text[:head] + "\n\n[...middle of document truncated...]\n\n" + text[-tail:]


def parse_pdf_statement(pdf_bytes: bytes) -> PDFImportResult:
    """Extract text from PDF, send to Claude, return structured holdings."""
    raw_text, page_count = _extract_text_from_pdf(pdf_bytes)

    if not raw_text.strip():
        return PDFImportResult(
            holdings=[],
            raw_text_length=0,
            pages_parsed=page_count,
            parse_notes="No extractable text found in PDF. The file may be image-only (scanned). Try a text-based PDF.",
        )

    truncated = _truncate_text(raw_text)

    client = anthropic.Anthropic()
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2048,
        system=_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": f"Please extract the holdings from this brokerage statement:\n\n{truncated}",
            }
        ],
    )

    raw_response = message.content[0].text if message.content else ""

    try:
        data = json.loads(raw_response)
    except json.JSONDecodeError:
        log.warning("Claude PDF parser returned non-JSON: %s", raw_response[:200])
        return PDFImportResult(
            holdings=[],
            raw_text_length=len(raw_text),
            pages_parsed=page_count,
            parse_notes="AI parsing failed — could not parse the statement structure. Try re-uploading a cleaner PDF.",
        )

    holdings = []
    for h in data.get("holdings") or []:
        try:
            holdings.append(ParsedHolding(
                name=h.get("name") or "Unknown",
                ticker=h.get("ticker"),
                isin=h.get("isin"),
                asset_type=h.get("asset_type") or "stock",
                quantity=float(h["quantity"]) if h.get("quantity") is not None else 0.0,
                avg_buy_price=float(h["avg_buy_price"]) if h.get("avg_buy_price") is not None else 0.0,
                current_value=float(h["current_value"]) if h.get("current_value") is not None else None,
                currency=h.get("currency") or "USD",
                notes=h.get("notes"),
            ))
        except Exception as exc:
            log.warning("Skipping malformed holding from AI response: %s — %s", h, exc)

    return PDFImportResult(
        broker_name=data.get("broker_name"),
        statement_date=data.get("statement_date"),
        currency=data.get("currency"),
        holdings=holdings,
        raw_text_length=len(raw_text),
        pages_parsed=page_count,
        parse_notes=data.get("parse_notes"),
    )

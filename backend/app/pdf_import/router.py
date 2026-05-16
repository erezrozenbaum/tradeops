import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.holdings import service as holdings_service
from app.models.investment_account import HoldingAssetType
from app.pdf_import import extractor
from app.pdf_import.schemas import PDFImportResult
from app.schemas.investment_account import InvestmentHoldingCreate

router = APIRouter()

_MAX_PDF_BYTES = 10 * 1024 * 1024   # 10 MB
_ALLOWED_ASSET_TYPES = {t.value for t in HoldingAssetType}

_AI_ASSET_TYPE_MAP = {
    "stock":   "stock",
    "etf":     "etf",
    "bond":    "bond",
    "crypto":  "crypto",
    "cash":    "other",
    "fund":    "fund",
    "option":  "other",
    "other":   "other",
}


@router.post("/parse", response_model=PDFImportResult)
async def parse_pdf(
    investor_id: uuid.UUID,
    file: UploadFile = File(...),
):
    """Upload a PDF brokerage statement and extract holdings using AI.

    Returns a structured list of parsed holdings for user review.
    Does NOT write to the database — call /import to persist.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=422, detail="Only PDF files are accepted.")

    content = await file.read()
    if len(content) > _MAX_PDF_BYTES:
        raise HTTPException(status_code=413, detail="PDF file exceeds 10 MB limit.")
    if len(content) == 0:
        raise HTTPException(status_code=422, detail="Uploaded file is empty.")

    result = extractor.parse_pdf_statement(content)
    return result


@router.post("/import", status_code=201)
async def import_holdings(
    investor_id: uuid.UUID,
    account_id: uuid.UUID = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Parse PDF statement and immediately persist all extracted holdings to the given account.

    Returns count of successfully imported holdings.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=422, detail="Only PDF files are accepted.")

    content = await file.read()
    if len(content) > _MAX_PDF_BYTES:
        raise HTTPException(status_code=413, detail="PDF file exceeds 10 MB limit.")

    account = holdings_service.get_account(db, investor_id, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Investment account not found.")

    result = extractor.parse_pdf_statement(content)

    imported = 0
    skipped = 0
    for h in result.holdings:
        if not h.name:
            skipped += 1
            continue

        asset_type_val = _AI_ASSET_TYPE_MAP.get(h.asset_type, "other") if h.asset_type else "stock"

        try:
            holdings_service.add_holding(
                db,
                investor_id=investor_id,
                account_id=account_id,
                data=InvestmentHoldingCreate(
                    name=h.name[:200],
                    ticker=h.ticker[:20] if h.ticker else None,
                    isin=h.isin[:20] if h.isin else None,
                    asset_type=HoldingAssetType(asset_type_val),
                    quantity=h.quantity or 0.0,
                    avg_buy_price=h.avg_buy_price or 0.0,
                    currency=h.currency or account.currency,
                    current_value=h.current_value,
                    notes=h.notes,
                ),
            )
            imported += 1
        except Exception:
            skipped += 1

    return {
        "imported": imported,
        "skipped": skipped,
        "broker_name": result.broker_name,
        "statement_date": result.statement_date,
        "parse_notes": result.parse_notes,
    }

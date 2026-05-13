import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.broker_sync import service
from app.broker_sync.schemas import BrokerSyncResult

router = APIRouter()

_SUPPORTED_BROKERS = {"ibkr", "etoro", "altshuler_shaham", "altrade"}


def _get_parser(broker_type: str):
    if broker_type == "ibkr":
        from app.broker_sync.parsers import ibkr
        return ibkr.parse
    if broker_type == "etoro":
        from app.broker_sync.parsers import etoro
        return etoro.parse
    if broker_type == "altshuler_shaham":
        from app.broker_sync.parsers import altshuler_shaham
        return altshuler_shaham.parse
    if broker_type == "altrade":
        from app.broker_sync.parsers import altrade
        return altrade.parse
    return None


@router.post(
    "/{investor_id}/accounts/{account_id}/broker-sync",
    response_model=BrokerSyncResult,
    status_code=status.HTTP_200_OK,
)
async def broker_sync(
    investor_id: uuid.UUID,
    account_id: uuid.UUID,
    file: UploadFile = File(...),
    broker_type: str = Form(...),
    db: Session = Depends(get_db),
) -> BrokerSyncResult:
    broker_type = broker_type.lower().strip()

    if broker_type not in _SUPPORTED_BROKERS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported broker_type '{broker_type}'. Valid: {sorted(_SUPPORTED_BROKERS)}",
        )

    parser = _get_parser(broker_type)
    content = await file.read()
    filename = file.filename or ""

    rows, parse_errors = parser(content, filename)

    if not rows and parse_errors:
        raise HTTPException(
            status_code=422,
            detail={"message": "Could not parse file", "errors": parse_errors},
        )

    result = service.sync_holdings(db, account_id, investor_id, rows, broker_type)
    result.errors.extend(parse_errors)
    return result

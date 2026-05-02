import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.market_data.service import get_cached_price
from app.models.investor_profile import InvestorProfile
from app.models.watchlist import WatchlistItem
from app.watchlist.schemas import WatchlistItemCreate, WatchlistItemOut

router = APIRouter()


def _enrich(item: WatchlistItem, db: Session) -> WatchlistItemOut:
    snap = get_cached_price(db, item.ticker)
    age = None
    if snap:
        age = round((datetime.now(timezone.utc) - snap.fetched_at.replace(tzinfo=timezone.utc)).total_seconds() / 3600, 1)
    return WatchlistItemOut(
        id=item.id,
        investor_id=item.investor_id,
        ticker=item.ticker,
        name=item.name,
        asset_type=item.asset_type,
        notes=item.notes,
        added_at=item.added_at,
        current_price=snap.price if snap else None,
        price_currency=snap.currency if snap else None,
        price_age_hours=age,
    )


@router.get("", response_model=list[WatchlistItemOut])
def list_watchlist(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    items = (
        db.query(WatchlistItem)
        .filter(WatchlistItem.investor_id == investor_id)
        .order_by(WatchlistItem.added_at.desc())
        .all()
    )
    return [_enrich(i, db) for i in items]


@router.post("", response_model=WatchlistItemOut, status_code=status.HTTP_201_CREATED)
def add_to_watchlist(
    investor_id: uuid.UUID, data: WatchlistItemCreate, db: Session = Depends(get_db)
):
    if not db.get(InvestorProfile, investor_id):
        raise HTTPException(status_code=404, detail="Investor not found")
    item = WatchlistItem(
        id=uuid.uuid4(),
        investor_id=investor_id,
        ticker=data.ticker.upper().strip(),
        name=data.name,
        asset_type=data.asset_type,
        notes=data.notes,
    )
    db.add(item)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Ticker already on watchlist")
    db.refresh(item)
    return _enrich(item, db)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_from_watchlist(
    investor_id: uuid.UUID, item_id: uuid.UUID, db: Session = Depends(get_db)
):
    item = (
        db.query(WatchlistItem)
        .filter(WatchlistItem.id == item_id, WatchlistItem.investor_id == investor_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Watchlist item not found")
    db.delete(item)
    db.commit()

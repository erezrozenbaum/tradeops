import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.action_feed import engine
from app.action_feed.schemas import DailyActionFeed
from app.db.session import get_db

router = APIRouter()


@router.get("", response_model=DailyActionFeed)
def get_action_feed(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    """Return today's prioritised action feed for the investor.

    Aggregates signals from rebalancing, proactive insights, price alerts,
    goals analysis, and market signals into a single sorted list.
    No AI calls — deterministic, fast, always fresh.
    """
    return engine.build_action_feed(db, investor_id)

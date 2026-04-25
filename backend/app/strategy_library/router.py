from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.strategy import StrategyTemplateOut
from app.strategy_library import service

router = APIRouter()


@router.get("/", response_model=list[StrategyTemplateOut])
def list_templates(db: Session = Depends(get_db)):
    return service.get_all_active(db)

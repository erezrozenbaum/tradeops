import uuid

from sqlalchemy.orm import Session

from app.models.strategy_template import StrategyTemplate


def get_all_active(db: Session) -> list[StrategyTemplate]:
    return (
        db.query(StrategyTemplate)
        .filter(StrategyTemplate.is_active.is_(True))
        .order_by(StrategyTemplate.name)
        .all()
    )


def get(db: Session, template_id: uuid.UUID) -> StrategyTemplate | None:
    return db.get(StrategyTemplate, template_id)

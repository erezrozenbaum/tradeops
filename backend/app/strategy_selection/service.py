import uuid

from sqlalchemy.orm import Session

from app.audit import service as audit
from app.models.investor_profile import InvestorProfile
from app.models.strategy_recommendation import StrategyRecommendation
from app.risk_modeling import service as rm_service
from app.strategy_library import service as lib_service
from app.strategy_selection.engine import select_strategies


def generate(db: Session, investor_id: uuid.UUID) -> list[StrategyRecommendation] | None:
    investor = db.get(InvestorProfile, investor_id)
    if not investor:
        return None

    risk_model = rm_service.get_latest(db, investor_id)
    if not risk_model:
        return None

    templates = lib_service.get_all_active(db)
    matches = select_strategies(templates, investor, risk_model)

    # Delete previous recommendations for this investor to avoid stale data
    db.query(StrategyRecommendation).filter(
        StrategyRecommendation.investor_profile_id == investor_id
    ).delete(synchronize_session=False)

    recs = []
    for template, fit_score, notes in matches:
        rec = StrategyRecommendation(
            investor_profile_id=investor_id,
            risk_model_id=risk_model.id,
            strategy_template_id=template.id,
            fit_score=fit_score,
            notes=notes,
        )
        db.add(rec)
        recs.append(rec)

    db.flush()
    audit.log_event(
        db,
        event_type="strategy.recommendations_generated",
        description=(
            f"Generated {len(recs)} strategy recommendation(s) "
            f"based on risk model {risk_model.id}"
        ),
        investor_profile_id=investor_id,
        metadata={
            "risk_model_id": str(risk_model.id),
            "count": len(recs),
            "templates": [str(r.strategy_template_id) for r in recs],
        },
    )
    db.commit()
    for rec in recs:
        db.refresh(rec)

    return recs


def get_latest(db: Session, investor_id: uuid.UUID) -> list[StrategyRecommendation]:
    risk_model = rm_service.get_latest(db, investor_id)
    if not risk_model:
        return []

    return (
        db.query(StrategyRecommendation)
        .filter(
            StrategyRecommendation.investor_profile_id == investor_id,
            StrategyRecommendation.risk_model_id == risk_model.id,
        )
        .order_by(StrategyRecommendation.fit_score.desc())
        .all()
    )

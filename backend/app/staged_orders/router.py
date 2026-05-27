import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.staged_orders import service, templates as tmpl_svc
from app.staged_orders.schemas import (
    GenerateRebalanceResult,
    OrderTemplateOut,
    OutcomeComparisonOut,
    SmartSuggestResult,
    StagedOrderCreate,
    StagedOrderList,
    StagedOrderOut,
    TemplateApplyResult,
    TemplateSaveRequest,
)

router = APIRouter()


@router.get("", response_model=StagedOrderList)
def list_orders(
    investor_id: uuid.UUID,
    status: str | None = None,
    db: Session = Depends(get_db),
):
    return service.list_staged_orders(db, investor_id, status=status)


@router.post("", response_model=StagedOrderOut, status_code=201)
def create_order(
    investor_id: uuid.UUID,
    payload: StagedOrderCreate,
    db: Session = Depends(get_db),
):
    return service.create_staged_order(db, investor_id, payload)


@router.post("/generate-rebalance", response_model=GenerateRebalanceResult)
def generate_rebalance(
    investor_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """Generate the minimum set of orders to reach risk-model targets.

    Sells are sequenced before buys (tax-efficient) and each order includes
    pre-flight review and tax analysis.
    """
    try:
        return service.generate_minimum_rebalance(db, investor_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/{order_id}/execute", response_model=StagedOrderOut)
def execute_order(
    investor_id: uuid.UUID,
    order_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    try:
        return service.mark_executed(db, investor_id, order_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.delete("/{order_id}", response_model=StagedOrderOut)
def cancel_order(
    investor_id: uuid.UUID,
    order_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    try:
        return service.cancel_order(db, investor_id, order_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


# ── Templates ─────────────────────────────────────────────────────────────────

@router.get("/templates", response_model=list[OrderTemplateOut])
def list_templates(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    return tmpl_svc.list_templates(db, investor_id)


@router.post("/templates", response_model=OrderTemplateOut, status_code=201)
def save_template(
    investor_id: uuid.UUID,
    payload: TemplateSaveRequest,
    db: Session = Depends(get_db),
):
    return tmpl_svc.save_template(db, investor_id, payload.name, payload.description, payload.order_ids)


@router.post("/templates/{template_id}/apply", response_model=TemplateApplyResult)
def apply_template(
    investor_id: uuid.UUID,
    template_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    try:
        orders = tmpl_svc.apply_template(db, investor_id, template_id)
        return TemplateApplyResult(template_id=template_id, orders_created=len(orders), orders=orders)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.delete("/templates/{template_id}", status_code=204)
def delete_template(
    investor_id: uuid.UUID,
    template_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    try:
        tmpl_svc.delete_template(db, investor_id, template_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


# ── Outcome comparison ────────────────────────────────────────────────────────

@router.get("/outcomes", response_model=list[OutcomeComparisonOut])
def get_outcomes(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    """Return executed orders with their projected vs actual outcome snapshots."""
    return service.list_outcome_comparisons(db, investor_id)


# ── Smart Allocation Assistant ────────────────────────────────────────────────

@router.post("/smart-suggest", response_model=SmartSuggestResult)
def smart_suggest(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    """AI-powered allocation suggestions based on portfolio state, risk model, and goals."""
    from app.staged_orders.smart_suggest import smart_suggest as _suggest
    result = _suggest(db, investor_id)
    return SmartSuggestResult(**result)

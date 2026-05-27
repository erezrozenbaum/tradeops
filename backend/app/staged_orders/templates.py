"""Order template CRUD — save, list, apply, delete named allocation patterns."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.order_template import OrderTemplate
from app.staged_orders import service as order_svc
from app.staged_orders.schemas import StagedOrderCreate, StagedOrderOut


def list_templates(db: Session, investor_id: uuid.UUID) -> list[OrderTemplate]:
    return (
        db.query(OrderTemplate)
        .filter(OrderTemplate.investor_id == investor_id)
        .order_by(OrderTemplate.created_at.desc())
        .all()
    )


def save_template(
    db: Session,
    investor_id: uuid.UUID,
    name: str,
    description: str | None,
    order_ids: list[uuid.UUID],
) -> OrderTemplate:
    """Save a set of existing staged orders as a reusable template."""
    from app.models.staged_order import StagedOrder

    orders_data = []
    for oid in order_ids:
        o = (
            db.query(StagedOrder)
            .filter(StagedOrder.id == oid, StagedOrder.investor_id == investor_id)
            .first()
        )
        if o:
            orders_data.append({
                "ticker": o.ticker,
                "name": o.name,
                "action": o.action,
                "quantity": o.quantity,
                "unit_price": o.unit_price,
                "currency": o.currency,
                "asset_type": o.asset_type,
            })

    tmpl = OrderTemplate(
        investor_id=investor_id,
        name=name,
        description=description,
        orders=orders_data,
        times_applied=0,
    )
    db.add(tmpl)
    db.commit()
    db.refresh(tmpl)
    return tmpl


def apply_template(
    db: Session,
    investor_id: uuid.UUID,
    template_id: uuid.UUID,
) -> list[StagedOrderOut]:
    """Instantiate a template as a fresh set of staged orders."""
    tmpl = db.query(OrderTemplate).filter(
        OrderTemplate.id == template_id,
        OrderTemplate.investor_id == investor_id,
    ).first()
    if not tmpl:
        raise ValueError("Template not found")

    created: list[StagedOrderOut] = []
    for item in tmpl.orders:
        payload = StagedOrderCreate(
            ticker=item.get("ticker"),
            name=item["name"],
            action=item["action"],
            quantity=item["quantity"],
            unit_price=item["unit_price"],
            currency=item.get("currency", "ILS"),
            asset_type=item.get("asset_type"),
        )
        created.append(order_svc.create_staged_order(db, investor_id, payload))

    # Track usage
    tmpl.times_applied += 1
    tmpl.last_applied_at = datetime.now(timezone.utc)
    db.commit()

    return created


def delete_template(db: Session, investor_id: uuid.UUID, template_id: uuid.UUID) -> None:
    tmpl = db.query(OrderTemplate).filter(
        OrderTemplate.id == template_id,
        OrderTemplate.investor_id == investor_id,
    ).first()
    if not tmpl:
        raise ValueError("Template not found")
    db.delete(tmpl)
    db.commit()

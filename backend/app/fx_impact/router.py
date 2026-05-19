import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.fx_impact import engine
from app.fx_impact.schemas import FxImpactResultOut

router = APIRouter()


@router.get("/fx-impact", response_model=FxImpactResultOut)
def get_fx_impact(investor_id: uuid.UUID, db: Session = Depends(get_db)):
    """Decompose portfolio P&L into Asset P&L (price movement) and FX P&L (currency movement).

    Requires purchase_fx_rate to be captured on holdings — auto-populated since v0.64,
    corrected to use historical rate at purchase_date since v0.92.
    Holdings without purchase_fx_rate are counted in holdings_missing_fx_data.
    """
    result = engine.compute(db, investor_id)
    return FxImpactResultOut(
        investor_id=result.investor_id,
        base_currency=result.base_currency,
        holdings=[
            {
                "holding_id": h.holding_id,
                "name": h.name,
                "ticker": h.ticker,
                "asset_type": h.asset_type,
                "currency": h.currency,
                "base_currency": h.base_currency,
                "quantity": h.quantity,
                "avg_buy_price": h.avg_buy_price,
                "purchase_fx_rate": h.purchase_fx_rate,
                "current_fx_rate": h.current_fx_rate,
                "cost_basis_local": h.cost_basis_local,
                "cost_basis_base": h.cost_basis_base,
                "current_value_base": h.current_value_base,
                "asset_pnl": h.asset_pnl,
                "fx_pnl": h.fx_pnl,
                "total_pnl": h.total_pnl,
                "asset_pnl_pct": h.asset_pnl_pct,
                "fx_pnl_pct": h.fx_pnl_pct,
                "same_currency": h.same_currency,
                "fx_data_available": h.fx_data_available,
            }
            for h in result.holdings
        ],
        total_asset_pnl=result.total_asset_pnl,
        total_fx_pnl=result.total_fx_pnl,
        total_pnl=result.total_pnl,
        total_cost_basis=result.total_cost_basis,
        holdings_missing_fx_data=result.holdings_missing_fx_data,
    )

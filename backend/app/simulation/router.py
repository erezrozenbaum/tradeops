import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.simulation import service
from app.simulation.schemas import SimulationListResponse, SimulationRunCreate, SimulationRunResponse

router = APIRouter()


@router.post("", response_model=SimulationRunResponse, status_code=201)
def run_simulation(
    investor_id: uuid.UUID,
    payload: SimulationRunCreate,
    db: Session = Depends(get_db),
):
    return service.create_simulation(db, investor_id, payload)


@router.get("", response_model=SimulationListResponse)
def list_simulations(
    investor_id: uuid.UUID,
    saved_only: bool = False,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    return service.list_simulations(db, investor_id, saved_only=saved_only, limit=limit)


@router.get("/{simulation_id}", response_model=SimulationRunResponse)
def get_simulation(
    investor_id: uuid.UUID,
    simulation_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    result = service.get_simulation(db, investor_id, simulation_id)
    if not result:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return result


@router.post("/{simulation_id}/save", response_model=SimulationRunResponse)
def save_simulation(
    investor_id: uuid.UUID,
    simulation_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    result = service.save_simulation(db, investor_id, simulation_id)
    if not result:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return result

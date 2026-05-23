from __future__ import annotations

import random
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.financial_profile import FinancialProfile
from app.models.portfolio_snapshot import PortfolioSnapshot
from app.models.simulation_run import SimulationRun
from app.simulation.counterfactuals import (
    run_counterfactual_constraint,
    run_counterfactual_hold,
    run_counterfactual_rebalance,
)
from app.simulation.engine import (
    DISCLAIMER,
    run_debt_payoff,
    run_job_loss,
    run_market_crash,
    run_monte_carlo_growth,
    run_savings_increase,
)
from app.simulation.schemas import (
    SimulationListResponse,
    SimulationRunCreate,
    SimulationRunResponse,
)

_MONTE_CARLO = {"market_crash", "retirement", "custom"}
_COUNTERFACTUAL = {"counterfactual_rebalance", "counterfactual_constraint", "counterfactual_hold"}

_SCENARIO_NAMES = {
    "debt_payoff": "Accelerated Debt Payoff",
    "savings_increase": "Increased Savings",
    "job_loss": "Job Loss Impact",
    "market_crash": "Market Crash Scenario",
    "retirement": "Retirement Projection",
    "custom": "Custom Scenario",
    "counterfactual_rebalance": "What if I Had Rebalanced?",
    "counterfactual_constraint": "What if Constraint Was Enforced?",
    "counterfactual_hold": "What if I Hadn't Panic-Sold?",
}


# ─── Data snapshot helpers ────────────────────────────────────────────────────

def _load_data_snapshot(db: Session, investor_id: uuid.UUID) -> dict:
    fp: FinancialProfile | None = (
        db.query(FinancialProfile)
        .filter(FinancialProfile.investor_profile_id == investor_id)
        .first()
    )
    snap: PortfolioSnapshot | None = (
        db.query(PortfolioSnapshot)
        .filter(PortfolioSnapshot.investor_id == investor_id)
        .order_by(PortfolioSnapshot.snapshot_at.desc())
        .first()
    )

    portfolio_value = round(snap.total_value, 2) if snap else 0.0
    currency = (snap.currency if snap else (fp.currency if fp else "USD"))

    result: dict = {"portfolio_value": portfolio_value, "currency": currency}

    if fp:
        result.update({
            "monthly_income": fp.monthly_income,
            "monthly_expenses": fp.monthly_expenses,
            "liquid_savings": fp.liquid_savings,
        })
        if fp.liabilities:
            top = max(fp.liabilities, key=lambda l: l.outstanding_balance)
            result.update({
                "top_debt_balance": top.outstanding_balance,
                "top_debt_interest_rate_pct": top.interest_rate_pct or 5.0,
                "top_debt_monthly_payment": top.monthly_payment,
                "total_debt": sum(l.outstanding_balance for l in fp.liabilities),
            })
        else:
            result.update({
                "top_debt_balance": 0.0,
                "top_debt_interest_rate_pct": 5.0,
                "top_debt_monthly_payment": 0.0,
                "total_debt": 0.0,
            })
    else:
        result.update({
            "monthly_income": 0.0,
            "monthly_expenses": 0.0,
            "liquid_savings": 0.0,
            "top_debt_balance": 0.0,
            "top_debt_interest_rate_pct": 5.0,
            "top_debt_monthly_payment": 0.0,
            "total_debt": 0.0,
        })

    return result


# ─── Engine dispatch ──────────────────────────────────────────────────────────

def _run_engine(
    scenario_type: str,
    params: dict,
    snap: dict,
    random_seed: int,
    db: Session | None = None,
    investor_id: uuid.UUID | None = None,
) -> dict:
    portfolio = snap.get("portfolio_value", 0.0)
    liquid = snap.get("liquid_savings", 0.0)
    income = snap.get("monthly_income", 0.0)
    expenses = snap.get("monthly_expenses", 0.0)
    horizon = params.get("horizon_months", 60)
    annual_return = params.get("annual_return_rate_pct") or 7.0

    if scenario_type == "debt_payoff":
        return run_debt_payoff(
            initial_portfolio=portfolio,
            liquid_savings=liquid,
            debt_balance=params.get("debt_balance") or snap.get("top_debt_balance", 0.0),
            interest_rate_pct=params.get("debt_interest_rate_pct") or snap.get("top_debt_interest_rate_pct", 5.0),
            current_monthly_payment=params.get("current_monthly_payment") or snap.get("top_debt_monthly_payment", 0.0),
            extra_monthly_payment=params.get("extra_monthly_payment") or 500.0,
            horizon_months=horizon,
            annual_return_rate_pct=annual_return,
        )

    if scenario_type == "savings_increase":
        return run_savings_increase(
            initial=portfolio + liquid,
            monthly_savings_increase=params.get("monthly_savings_increase") or 500.0,
            annual_return_rate_pct=annual_return,
            horizon_months=horizon,
        )

    if scenario_type == "job_loss":
        return run_job_loss(
            monthly_income=income,
            monthly_expenses=expenses,
            liquid_savings=liquid,
            income_replacement_pct=params.get("income_replacement_pct") if params.get("income_replacement_pct") is not None else 0.0,
            expense_reduction_pct=params.get("expense_reduction_pct") if params.get("expense_reduction_pct") is not None else 0.0,
            horizon_months=horizon,
        )

    if scenario_type == "market_crash":
        return run_market_crash(
            initial=portfolio,
            annual_return_rate_pct=annual_return,
            annual_volatility_pct=params.get("annual_volatility_pct") or 15.0,
            crash_drawdown_pct=params.get("crash_drawdown_pct") or 30.0,
            crash_probability_pct=params.get("crash_probability_pct") or 15.0,
            horizon_months=horizon,
            random_seed=random_seed,
        )

    if scenario_type in ("retirement", "custom"):
        return run_monte_carlo_growth(
            initial=portfolio + liquid,
            annual_return_rate_pct=annual_return,
            annual_volatility_pct=params.get("annual_volatility_pct") or 12.0,
            monthly_contribution=params.get("monthly_contribution") or 0.0,
            horizon_months=horizon,
            random_seed=random_seed,
        )

    if scenario_type in _COUNTERFACTUAL:
        if db is None or investor_id is None:
            raise ValueError("Counterfactual scenarios require db and investor_id.")
        if scenario_type == "counterfactual_rebalance":
            decision_id_str = params.get("decision_id")
            if not decision_id_str:
                raise ValueError("counterfactual_rebalance requires decision_id parameter.")
            return run_counterfactual_rebalance(db, investor_id, uuid.UUID(decision_id_str))
        if scenario_type == "counterfactual_constraint":
            return run_counterfactual_constraint(db, investor_id)
        if scenario_type == "counterfactual_hold":
            event_id_str = params.get("event_id")
            if not event_id_str:
                raise ValueError("counterfactual_hold requires event_id parameter.")
            return run_counterfactual_hold(db, investor_id, uuid.UUID(event_id_str))

    raise ValueError(f"Unknown scenario_type: {scenario_type!r}")


# ─── ORM → schema ────────────────────────────────────────────────────────────

def _to_response(run: SimulationRun) -> SimulationRunResponse:
    return SimulationRunResponse(
        id=run.id,
        investor_id=run.investor_id,
        scenario_type=run.scenario_type,
        scenario_name=run.scenario_name,
        status=run.status,
        horizon_months=run.horizon_months,
        parameters=run.parameters,
        data_snapshot=run.data_snapshot,
        results=run.results,
        random_seed=run.random_seed,
        is_saved=run.is_saved,
        disclaimer=run.disclaimer,
        computed_at=run.computed_at,
    )


# ─── Public service API ───────────────────────────────────────────────────────

def create_simulation(
    db: Session,
    investor_id: uuid.UUID,
    payload: SimulationRunCreate,
) -> SimulationRunResponse:
    data_snapshot = _load_data_snapshot(db, investor_id)

    is_mc = payload.scenario_type in _MONTE_CARLO
    random_seed = random.randint(1, 2**31 - 1) if is_mc else None

    params = payload.parameters.model_dump(exclude_none=True)
    params["horizon_months"] = payload.horizon_months

    results = _run_engine(
        payload.scenario_type, params, data_snapshot, random_seed or 42,
        db=db, investor_id=investor_id,
    )

    run = SimulationRun(
        id=uuid.uuid4(),
        investor_id=investor_id,
        scenario_type=payload.scenario_type,
        scenario_name=payload.scenario_name or _SCENARIO_NAMES.get(payload.scenario_type, payload.scenario_type),
        status="completed",
        horizon_months=payload.horizon_months,
        parameters=params,
        data_snapshot=data_snapshot,
        results=results,
        random_seed=random_seed,
        is_saved=False,
        disclaimer=DISCLAIMER,
        computed_at=datetime.now(timezone.utc),
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return _to_response(run)


def list_simulations(
    db: Session,
    investor_id: uuid.UUID,
    saved_only: bool = False,
    limit: int = 20,
) -> SimulationListResponse:
    q = db.query(SimulationRun).filter(SimulationRun.investor_id == investor_id)
    if saved_only:
        q = q.filter(SimulationRun.is_saved.is_(True))
    runs = q.order_by(SimulationRun.computed_at.desc()).limit(limit).all()
    return SimulationListResponse(simulations=[_to_response(r) for r in runs], total=len(runs))


def get_simulation(
    db: Session,
    investor_id: uuid.UUID,
    simulation_id: uuid.UUID,
) -> SimulationRunResponse | None:
    run = (
        db.query(SimulationRun)
        .filter(SimulationRun.investor_id == investor_id, SimulationRun.id == simulation_id)
        .first()
    )
    return _to_response(run) if run else None


def save_simulation(
    db: Session,
    investor_id: uuid.UUID,
    simulation_id: uuid.UUID,
) -> SimulationRunResponse | None:
    run = (
        db.query(SimulationRun)
        .filter(SimulationRun.investor_id == investor_id, SimulationRun.id == simulation_id)
        .first()
    )
    if not run:
        return None
    run.is_saved = True
    db.commit()
    db.refresh(run)
    return _to_response(run)

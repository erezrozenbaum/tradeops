"""Weekly job: write Command Center delta anchors to command_center_checkpoints.

Runs Monday at 04:00 UTC — before the nightly AI pre-compute (05:00).
Anchors are used by the Evolution Feed to compute precise week-over-week
deltas rather than relying on fuzzy 8-day snapshot windows.
"""
import logging
import uuid
from datetime import datetime, timezone

log = logging.getLogger(__name__)


def write_command_center_checkpoints() -> None:
    from app.db.session import SessionLocal
    from app.models.investor_profile import InvestorProfile

    with SessionLocal() as db:
        investor_ids = [row[0] for row in db.query(InvestorProfile.id).all()]

    if not investor_ids:
        log.info("cc_checkpoint: no investors")
        return

    log.info("cc_checkpoint: writing checkpoints for %d investor(s)", len(investor_ids))
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    ok = err = 0

    for investor_id in investor_ids:
        try:
            _write_one(investor_id, now)
            ok += 1
        except Exception as exc:
            log.error("cc_checkpoint: failed for investor %s: %s", investor_id, exc)
            err += 1

    log.info("cc_checkpoint: done — %d ok, %d errors", ok, err)


def _write_one(investor_id: uuid.UUID, checkpoint_at: datetime) -> None:
    from app.db.session import SessionLocal
    from app.models.command_center_checkpoint import CommandCenterCheckpoint
    from app.models.financial_twin_snapshot import FinancialTwinSnapshot
    from app.models.investor_maturity_snapshot import InvestorMaturitySnapshot
    from app.models.behavioral_risk_event import BehavioralRiskEvent
    from app.models.investment_account import InvestmentAccount, InvestmentHolding
    from app.models.portfolio_snapshot import PortfolioSnapshot
    from sqlalchemy import func

    with SessionLocal() as db:
        # Skip if checkpoint already exists for this hour
        exists = (
            db.query(CommandCenterCheckpoint)
            .filter(
                CommandCenterCheckpoint.investor_id == investor_id,
                CommandCenterCheckpoint.checkpoint_at == checkpoint_at,
            )
            .first()
        )
        if exists:
            return

        twin = (
            db.query(FinancialTwinSnapshot)
            .filter(FinancialTwinSnapshot.investor_id == investor_id)
            .order_by(FinancialTwinSnapshot.computed_at.desc())
            .first()
        )
        maturity = (
            db.query(InvestorMaturitySnapshot)
            .filter(InvestorMaturitySnapshot.investor_id == investor_id)
            .order_by(InvestorMaturitySnapshot.computed_at.desc())
            .first()
        )
        active_risks = (
            db.query(func.count(BehavioralRiskEvent.id))
            .filter(
                BehavioralRiskEvent.investor_id == investor_id,
                BehavioralRiskEvent.status == "active",
            )
            .scalar()
        ) or 0

        snap = (
            db.query(PortfolioSnapshot)
            .filter(PortfolioSnapshot.investor_id == investor_id)
            .order_by(PortfolioSnapshot.snapshot_at.desc())
            .first()
        )

        # Top concentration pct
        rows = (
            db.query(InvestmentHolding.ticker, func.sum(InvestmentHolding.current_value).label("val"))
            .join(InvestmentAccount, InvestmentHolding.account_id == InvestmentAccount.id)
            .filter(InvestmentAccount.investor_id == investor_id)
            .group_by(InvestmentHolding.ticker)
            .all()
        )
        total_val = sum(r.val or 0 for r in rows)
        top_pct = None
        if total_val > 0 and rows:
            top_pct = round(max(r.val or 0 for r in rows) / total_val * 100, 1)

        # Stability score
        stab_score = None
        try:
            from app.financial_profiles.service import get_by_investor
            from app.financial_scoring.engine import calculate_stability_score
            from app.financial_scoring.schemas import FinancialScoringInput
            fp = get_by_investor(db, investor_id)
            if fp:
                total_liabilities = sum(li.outstanding_balance or 0 for li in fp.liabilities) if fp.liabilities else 0.0
                monthly_debt = sum(li.monthly_payment or 0 for li in fp.liabilities) if fp.liabilities else 0.0
                total_assets = sum(a.current_value or 0 for a in fp.assets) if fp.assets else 0.0
                inp = FinancialScoringInput(
                    monthly_income=fp.monthly_income,
                    monthly_expenses=fp.monthly_expenses,
                    emergency_fund_months=fp.emergency_fund_months,
                    total_monthly_debt_payments=monthly_debt,
                    total_assets=total_assets,
                    total_liabilities=total_liabilities,
                    job_stability=fp.job_stability,
                    income_trend=fp.income_trend,
                    dependents_count=fp.dependents_count or 0,
                )
                stab_score = calculate_stability_score(inp).score
        except Exception:
            pass

        checkpoint = CommandCenterCheckpoint(
            id=uuid.uuid4(),
            investor_id=investor_id,
            checkpoint_at=checkpoint_at,
            twin_overall_score=round(twin.overall_score, 2) if twin else None,
            maturity_composite_score=round(maturity.composite_score, 2) if maturity else None,
            stability_score=round(stab_score, 2) if stab_score is not None else None,
            net_worth=float(snap.total_value) if snap and snap.total_value else None,
            behavioral_discipline=round(twin.behavioral_discipline, 2) if twin else None,
            financial_resilience=round(twin.financial_resilience, 2) if twin else None,
            active_risk_count=active_risks,
            top_concentration_pct=top_pct,
        )
        db.add(checkpoint)
        db.commit()

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.household.schemas import (
    HouseholdAggregateMetrics,
    HouseholdMemberCard,
    HouseholdOut,
    HouseholdSummary,
)
from app.models.behavioral_risk_event import BehavioralRiskEvent
from app.models.financial_profile import FinancialProfile
from app.models.financial_twin_snapshot import FinancialTwinSnapshot
from app.models.household import Household
from app.models.investor_maturity_snapshot import InvestorMaturitySnapshot
from app.models.investor_profile import InvestorProfile
from app.models.net_worth import NetWorthSnapshot
from app.models.portfolio_snapshot import PortfolioSnapshot


def create_household(db: Session, investor_id: uuid.UUID, name: str) -> Household:
    household = Household(name=name)
    db.add(household)
    db.flush()
    investor = db.get(InvestorProfile, investor_id)
    investor.household_id = household.id
    db.commit()
    db.refresh(household)
    return household


def join_household(db: Session, investor_id: uuid.UUID, household_id: uuid.UUID) -> Household:
    household = db.get(Household, household_id)
    if not household:
        raise ValueError("Household not found")
    investor = db.get(InvestorProfile, investor_id)
    investor.household_id = household.id
    db.commit()
    return household


def leave_household(db: Session, investor_id: uuid.UUID) -> None:
    investor = db.get(InvestorProfile, investor_id)
    investor.household_id = None
    db.commit()


def get_summary(db: Session, investor_id: uuid.UUID) -> HouseholdSummary | None:
    investor = db.get(InvestorProfile, investor_id)
    if not investor or not investor.household_id:
        return None

    household = db.get(Household, investor.household_id)
    if not household:
        return None

    members_db = (
        db.query(InvestorProfile)
        .filter(InvestorProfile.household_id == investor.household_id)
        .all()
    )

    cards: list[HouseholdMemberCard] = []
    for m in members_db:
        maturity = (
            db.query(InvestorMaturitySnapshot)
            .filter(InvestorMaturitySnapshot.investor_id == m.id)
            .order_by(InvestorMaturitySnapshot.computed_at.desc())
            .first()
        )
        twin = (
            db.query(FinancialTwinSnapshot)
            .filter(FinancialTwinSnapshot.investor_id == m.id)
            .order_by(FinancialTwinSnapshot.computed_at.desc())
            .first()
        )
        stability_score = None
        stability_classification = None
        fp = db.query(FinancialProfile).filter(
            FinancialProfile.investor_profile_id == m.id
        ).first()
        if fp:
            try:
                from app.financial_scoring.engine import calculate_stability_score
                from app.financial_scoring.schemas import FinancialScoringInput
                total_liabilities = sum(li.outstanding_balance or 0 for li in fp.liabilities) if fp.liabilities else 0.0
                monthly_debt = sum(li.monthly_payment or 0 for li in fp.liabilities) if fp.liabilities else 0.0
                total_assets = sum(a.current_value or 0 for a in fp.assets) if fp.assets else 0.0
                result = calculate_stability_score(FinancialScoringInput(
                    monthly_income=fp.monthly_income,
                    monthly_expenses=fp.monthly_expenses,
                    emergency_fund_months=fp.emergency_fund_months,
                    total_monthly_debt_payments=monthly_debt,
                    total_assets=total_assets,
                    total_liabilities=total_liabilities,
                    job_stability=fp.job_stability,
                    income_trend=fp.income_trend,
                    dependents_count=fp.dependents_count or 0,
                ))
                stability_score = round(result.score, 1)
                stability_classification = result.classification
            except Exception:
                pass

        cards.append(HouseholdMemberCard(
            investor_id=m.id,
            full_name=m.full_name,
            maturity_stage=maturity.stage if maturity else "foundation",
            twin_overall_score=round(twin.overall_score, 1) if twin else None,
            stability_score=stability_score,
            stability_classification=stability_classification,
            is_self=(m.id == investor_id),
        ))

    return HouseholdSummary(
        household=HouseholdOut.model_validate(household),
        members=cards,
        member_count=len(cards),
    )


def get_aggregate_metrics(db: Session, investor_id: uuid.UUID) -> HouseholdAggregateMetrics | None:
    investor = db.get(InvestorProfile, investor_id)
    if not investor or not investor.household_id:
        return None

    members_db = (
        db.query(InvestorProfile)
        .filter(InvestorProfile.household_id == investor.household_id)
        .all()
    )

    combined_net_worth = 0.0
    combined_portfolio_value = 0.0
    combined_monthly_surplus = 0.0
    total_risks = 0

    for m in members_db:
        # Net worth — prefer NetWorthSnapshot, fall back to PortfolioSnapshot
        nw_snap = (
            db.query(NetWorthSnapshot)
            .filter(NetWorthSnapshot.investor_id == m.id)
            .order_by(NetWorthSnapshot.snapshot_at.desc())
            .first()
        )
        if nw_snap:
            combined_net_worth += float(nw_snap.net_worth or 0)
            combined_portfolio_value += float(nw_snap.portfolio_value or 0)
        else:
            port_snap = (
                db.query(PortfolioSnapshot)
                .filter(PortfolioSnapshot.investor_id == m.id)
                .order_by(PortfolioSnapshot.snapshot_at.desc())
                .first()
            )
            if port_snap:
                val = float(port_snap.total_value or 0)
                combined_net_worth += val
                combined_portfolio_value += val

        fp = db.query(FinancialProfile).filter(
            FinancialProfile.investor_profile_id == m.id
        ).first()
        if fp:
            combined_monthly_surplus += max(0.0, fp.monthly_income - fp.monthly_expenses)

        total_risks += (
            db.query(BehavioralRiskEvent)
            .filter(
                BehavioralRiskEvent.investor_id == m.id,
                BehavioralRiskEvent.status == "active",
            )
            .count()
        )

    return HouseholdAggregateMetrics(
        combined_net_worth=round(combined_net_worth, 2),
        combined_portfolio_value=round(combined_portfolio_value, 2),
        combined_monthly_surplus=round(combined_monthly_surplus, 2),
        total_active_behavioral_risks=total_risks,
        member_count=len(members_db),
        currency=investor.base_currency,
    )

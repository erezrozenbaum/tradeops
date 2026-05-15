import uuid

from sqlalchemy.orm import Session

from app.financial_profiles import service as fp_service
from app.financial_scoring.engine import calculate_stability_score
from app.financial_scoring.schemas import FinancialScoringInput
from app.goals import service as goals_service
from app.models.investment_account import InvestmentAccount, InvestmentHolding
from app.models.investor_profile import InvestorProfile
from app.risk_modeling import service as rm_service
from app.schemas.dashboard import (
    DashboardCashFlow,
    DashboardGoal,
    DashboardInvestor,
    DashboardNetWorth,
    DashboardOut,
    DashboardRiskModel,
    DashboardStability,
)


def get_dashboard(db: Session, investor_id: uuid.UUID) -> DashboardOut | None:
    investor = db.get(InvestorProfile, investor_id)
    if not investor:
        return None

    fp = fp_service.get_by_investor(db, investor_id)

    net_worth_section = None
    cash_flow_section = None
    stability_section = None

    if fp:
        total_assets = sum(a.current_value for a in fp.assets)
        total_liabilities = sum(l.outstanding_balance for l in fp.liabilities)
        net_worth = total_assets - total_liabilities
        liquid_capital = fp.liquid_savings + sum(
            a.current_value for a in fp.assets if a.is_liquid
        )

        net_worth_section = DashboardNetWorth(
            total_assets=round(total_assets, 2),
            total_liabilities=round(total_liabilities, 2),
            net_worth=round(net_worth, 2),
            liquid_capital=round(liquid_capital, 2),
            currency=fp.currency,
        )

        monthly_surplus = fp.monthly_income - fp.monthly_expenses
        savings_rate_pct = (
            round(monthly_surplus / fp.monthly_income * 100, 2)
            if fp.monthly_income > 0
            else 0.0
        )
        # Compute effective emergency fund months: take the max of the manually
        # entered profile value and the value derived from flagged holdings/accounts.
        effective_ef_months = fp.emergency_fund_months
        if fp.monthly_expenses > 0:
            ef_holdings = (
                db.query(InvestmentHolding)
                .join(InvestmentAccount, InvestmentHolding.account_id == InvestmentAccount.id)
                .filter(
                    InvestmentAccount.investor_id == investor_id,
                    InvestmentHolding.is_emergency_fund.is_(True),
                )
                .all()
            )
            if not ef_holdings:
                ef_accounts = (
                    db.query(InvestmentAccount)
                    .filter(
                        InvestmentAccount.investor_id == investor_id,
                        InvestmentAccount.is_emergency_fund.is_(True),
                    )
                    .all()
                )
                ef_holdings = [h for acc in ef_accounts for h in acc.holdings]
            if ef_holdings:
                ef_total = sum(h.current_balance or h.current_value or 0.0 for h in ef_holdings)
                computed = ef_total / fp.monthly_expenses
                effective_ef_months = max(effective_ef_months, computed)

        cash_flow_section = DashboardCashFlow(
            monthly_income=fp.monthly_income,
            monthly_expenses=fp.monthly_expenses,
            monthly_surplus=round(monthly_surplus, 2),
            savings_rate_pct=savings_rate_pct,
            emergency_fund_months=round(effective_ef_months, 1),
            currency=fp.currency,
        )

        scoring_input = FinancialScoringInput(
            monthly_income=fp.monthly_income,
            monthly_expenses=fp.monthly_expenses,
            emergency_fund_months=effective_ef_months,
            total_monthly_debt_payments=sum(l.monthly_payment for l in fp.liabilities),
            total_assets=total_assets,
            total_liabilities=total_liabilities,
            job_stability=fp.job_stability,
            income_trend=fp.income_trend,
            dependents_count=fp.dependents_count,
        )
        score = calculate_stability_score(scoring_input)
        stability_section = DashboardStability(
            score=score.score,
            classification=score.classification,
            risk_modifier=score.risk_modifier,
            recommendations=score.recommendations,
        )

    risk_model_section = None
    rm = rm_service.get_latest(db, investor_id)
    if rm:
        risk_model_section = DashboardRiskModel(
            investable_capital=rm.investable_capital,
            low_risk_pct=rm.low_risk_pct,
            growth_pct=rm.growth_pct,
            high_risk_pct=rm.high_risk_pct,
            low_risk_amount=round(rm.investable_capital * rm.low_risk_pct / 100, 2),
            growth_amount=round(rm.investable_capital * rm.growth_pct / 100, 2),
            high_risk_amount=round(rm.investable_capital * rm.high_risk_pct / 100, 2),
            max_drawdown_pct=rm.max_drawdown_pct,
            currency=rm.currency,
            generated_at=rm.generated_at,
        )

    raw_goals = goals_service.get_by_investor(db, investor_id)
    goals = [
        DashboardGoal(
            id=g.id,
            name=g.name,
            goal_type=g.goal_type,
            target_amount=g.target_amount,
            current_amount=g.current_amount,
            progress_pct=g.progress_pct,
            target_date=g.target_date,
            priority=g.priority,
            currency=g.currency,
        )
        for g in raw_goals
    ]

    return DashboardOut(
        investor=DashboardInvestor(
            id=investor.id,
            full_name=investor.full_name,
            base_currency=investor.base_currency,
            experience_level=investor.experience_level.value,
            is_minor=investor.is_minor,
        ),
        net_worth=net_worth_section,
        cash_flow=cash_flow_section,
        stability=stability_section,
        risk_model=risk_model_section,
        goals=goals,
    )

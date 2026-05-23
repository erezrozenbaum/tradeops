from __future__ import annotations

import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.command_center.action_engine import generate_top_actions
from app.command_center.evolution import generate_evolution_feed
from app.command_center.replay_selector import select_best_replay
from app.command_center.schemas import (
    BehavioralRiskCard,
    CommandCenterReport,
    FinancialStatusHeader,
    FuturesPath,
    FuturesPreview,
    GoalProgressItem,
    HealthRadarPoint,
    InvestorProgression,
    ProgressionStage,
    TwinInsight,
    TwinInsightsData,
)
from app.models.behavioral_risk_event import BehavioralRiskEvent
from app.models.financial_twin_snapshot import FinancialHealthScore, FinancialTwinSnapshot
from app.models.investor_maturity_snapshot import InvestorMaturitySnapshot
from app.models.simulation_run import SimulationRun


_STAGE_ORDER = ["foundation", "discipline", "optimization", "advanced_cognition"]
_STAGE_LABELS = {
    "foundation": "Foundation",
    "discipline": "Discipline",
    "optimization": "Optimization",
    "advanced_cognition": "Advanced Cognition",
}
_STAGE_THRESHOLDS = {"foundation": 0, "discipline": 25, "optimization": 50, "advanced_cognition": 75}
_NEXT_UNLOCK: dict[str, str] = {
    "foundation": "behavioral_intel",
    "discipline": "simulation",
    "optimization": "health_radar",
    "advanced_cognition": "",
}

_HEALTH_LABELS = {
    "stability": "Stability",
    "liquidity": "Liquidity",
    "discipline": "Discipline",
    "diversification": "Diversification",
    "emotional_control": "Emotional Control",
    "contribution_consistency": "Contributions",
    "tax_efficiency": "Tax Efficiency",
    "risk_alignment": "Risk Alignment",
    "resilience": "Resilience",
}


def _build_header(
    db: Session,
    investor_id: uuid.UUID,
    maturity: InvestorMaturitySnapshot | None,
    twin_current: FinancialTwinSnapshot | None,
    twin_prev: FinancialTwinSnapshot | None,
    active_risk_count: int,
) -> FinancialStatusHeader:
    from app.financial_profiles.service import get_by_investor
    from app.financial_scoring.engine import calculate_stability_score
    from app.financial_scoring.schemas import FinancialScoringInput
    from app.models.financial_profile import FinancialProfile

    # Stability score
    stab_score = 0.0
    stab_class = "unknown"
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
        result = calculate_stability_score(inp)
        stab_score = result.score
        stab_class = result.classification

    # Net worth trend (12m)
    from app.models.portfolio_snapshot import PortfolioSnapshot
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    snap_now = (
        db.query(PortfolioSnapshot)
        .filter(PortfolioSnapshot.investor_id == investor_id)
        .order_by(PortfolioSnapshot.snapshot_at.desc())
        .first()
    )
    snap_12m = (
        db.query(PortfolioSnapshot)
        .filter(
            PortfolioSnapshot.investor_id == investor_id,
            PortfolioSnapshot.snapshot_at <= now - timedelta(days=350),
        )
        .order_by(PortfolioSnapshot.snapshot_at.desc())
        .first()
    )
    nw_change_pct = None
    if snap_now and snap_12m and snap_12m.total_value and snap_12m.total_value > 0:
        nw_change_pct = (snap_now.total_value - snap_12m.total_value) / snap_12m.total_value * 100

    twin_score = twin_current.overall_score if twin_current else 0.0
    twin_delta = None
    twin_trend = "flat"
    if twin_current and twin_prev:
        twin_delta = round(twin_current.overall_score - twin_prev.overall_score, 1)
        twin_trend = "up" if twin_delta > 1 else ("down" if twin_delta < -1 else "flat")

    return FinancialStatusHeader(
        twin_overall_score=round(twin_score, 1),
        twin_score_delta_7d=twin_delta,
        twin_trend=twin_trend,
        maturity_stage=maturity.stage if maturity else "foundation",
        maturity_stage_label=_STAGE_LABELS.get(maturity.stage if maturity else "foundation", "Foundation"),
        stability_classification=stab_class,
        stability_score=round(stab_score, 1),
        net_worth_change_pct_12m=round(nw_change_pct, 1) if nw_change_pct is not None else None,
        active_behavioral_risk_count=active_risk_count,
    )


def _build_health_radar(db: Session, investor_id: uuid.UUID) -> list[HealthRadarPoint]:
    from app.financial_twin.service import get_or_compute_health_response
    try:
        health = get_or_compute_health_response(db, investor_id)
        dims = health.dimensions
        return [
            HealthRadarPoint(dimension=k, label=_HEALTH_LABELS.get(k, k.replace("_", " ").title()), value=round(v, 1))
            for k, v in dims.model_dump().items()
        ]
    except Exception:
        return []


def _build_twin_insights(twin: FinancialTwinSnapshot | None) -> TwinInsightsData:
    if not twin:
        return TwinInsightsData(positive_drivers=[], drag_factors=[])

    dims = {
        "Financial Stability": twin.financial_stability,
        "Behavioral Discipline": twin.behavioral_discipline,
        "Emotional Control": 100.0 - (twin.emotional_risk or 0),  # invert: lower emotional risk = better
        "Portfolio Consistency": twin.portfolio_consistency,
        "Financial Resilience": twin.financial_resilience,
        "Risk Alignment": twin.risk_alignment,
        "Long-Term Discipline": twin.long_term_discipline,
        "Contribution Momentum": twin.contribution_momentum,
    }

    sorted_dims = sorted(dims.items(), key=lambda x: x[1], reverse=True)
    positive = [TwinInsight(label=k, value=round(v, 1)) for k, v in sorted_dims if v >= 60][:3]
    drag = [TwinInsight(label=k, value=round(v, 1)) for k, v in sorted_dims if v < 50][-3:]

    return TwinInsightsData(positive_drivers=positive, drag_factors=drag)


def _build_futures_preview(db: Session, investor_id: uuid.UUID) -> FuturesPreview:
    _PREVIEW_TYPES = ["savings_increase", "debt_payoff", "market_crash"]
    paths: list[FuturesPath] = []
    colors = {"savings_increase": "#10B981", "debt_payoff": "#3B82F6", "market_crash": "#F59E0B"}
    labels = {"savings_increase": "High Savings Path", "debt_payoff": "Debt-Free Path", "market_crash": "Market Crash Scenario"}

    for scenario in _PREVIEW_TYPES:
        run = (
            db.query(SimulationRun)
            .filter(
                SimulationRun.investor_id == investor_id,
                SimulationRun.scenario_type == scenario,
                SimulationRun.status == "completed",
            )
            .order_by(SimulationRun.computed_at.desc())
            .first()
        )
        if run and run.results:
            trajectory = run.results.get("p50") or run.results.get("trajectory") or []
            if trajectory:
                # Downsample to 12 points for preview
                step = max(1, len(trajectory) // 12)
                simplified = trajectory[::step][:12]
                paths.append(FuturesPath(
                    label=labels.get(scenario, scenario),
                    values=[round(v, 0) for v in simplified],
                    color=colors.get(scenario, "#6B7280"),
                ))

    return FuturesPreview(paths=paths, fi_probability=None, has_data=len(paths) > 0)


def _build_goal_progress(db: Session, investor_id: uuid.UUID) -> list[GoalProgressItem]:
    from app.goals_analysis.service import get_analysis

    try:
        result = get_analysis(db, investor_id)
        if not result or not result.goals:
            return []

        # Sort: at_risk first, then by largest relative gap (most behind)
        def _priority(g):
            status_rank = 0 if g.status == "at_risk" else (1 if g.status == "on_track" else 2)
            gap_ratio = (g.target_amount - g.current_amount) / g.target_amount if g.target_amount > 0 else 0
            return (status_rank, -gap_ratio)

        sorted_goals = sorted(result.goals, key=_priority)[:2]
        return [
            GoalProgressItem(
                id=str(g.id),
                name=g.name,
                goal_type=g.goal_type,
                progress_pct=round(g.progress_pct, 1),
                months_to_target=round(g.months_to_target, 1) if g.months_to_target is not None else None,
                on_track=g.on_track,
                status=g.status,
                currency=g.currency,
                target_amount=g.target_amount,
                current_amount=g.current_amount,
                monthly_contribution_needed=round(g.monthly_contribution_needed, 0) if g.monthly_contribution_needed is not None else None,
            )
            for g in sorted_goals
        ]
    except Exception:
        return []


def _build_progression(maturity: InvestorMaturitySnapshot | None) -> InvestorProgression:
    from app.investor_maturity.schemas import FEATURES_BY_STAGE

    stage = maturity.stage if maturity else "foundation"
    score = maturity.composite_score if maturity else 0.0
    features = maturity.features_unlocked if maturity else FEATURES_BY_STAGE.get("foundation", [])

    stage_idx = _STAGE_ORDER.index(stage) if stage in _STAGE_ORDER else 0
    stages = [
        ProgressionStage(
            key=s,
            label=_STAGE_LABELS[s],
            is_current=(s == stage),
            is_complete=(i < stage_idx),
        )
        for i, s in enumerate(_STAGE_ORDER)
    ]

    # Score to next stage
    next_threshold = None
    if stage_idx < len(_STAGE_ORDER) - 1:
        next_stage = _STAGE_ORDER[stage_idx + 1]
        next_threshold = _STAGE_THRESHOLDS[next_stage] - score

    return InvestorProgression(
        stages=stages,
        current_stage=stage,
        current_stage_label=_STAGE_LABELS.get(stage, stage),
        composite_score=round(score, 1),
        features_unlocked=features if isinstance(features, list) else [],
        next_unlock_feature=_NEXT_UNLOCK.get(stage) or None,
        score_to_next_stage=round(next_threshold, 1) if next_threshold is not None and next_threshold > 0 else None,
    )


def build(db: Session, investor_id: uuid.UUID, verbosity: str = "standard") -> CommandCenterReport:
    from datetime import timedelta
    from app.investment_agent import engine as agent_engine

    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=8)

    def _fetch_maturity():
        return (
            db.query(InvestorMaturitySnapshot)
            .filter(InvestorMaturitySnapshot.investor_id == investor_id)
            .order_by(InvestorMaturitySnapshot.computed_at.desc())
            .first()
        )

    def _fetch_twin_current():
        return (
            db.query(FinancialTwinSnapshot)
            .filter(FinancialTwinSnapshot.investor_id == investor_id)
            .order_by(FinancialTwinSnapshot.computed_at.desc())
            .first()
        )

    def _fetch_twin_prev():
        return (
            db.query(FinancialTwinSnapshot)
            .filter(
                FinancialTwinSnapshot.investor_id == investor_id,
                FinancialTwinSnapshot.computed_at <= week_ago,
            )
            .order_by(FinancialTwinSnapshot.computed_at.desc())
            .first()
        )

    def _fetch_active_risks():
        return (
            db.query(BehavioralRiskEvent)
            .filter(
                BehavioralRiskEvent.investor_id == investor_id,
                BehavioralRiskEvent.status == "active",
            )
            .order_by(BehavioralRiskEvent.detected_at.desc())
            .limit(3)
            .all()
        )

    def _fetch_goals():
        from app.goals_analysis.service import get_analysis
        return get_analysis(db, investor_id)

    with ThreadPoolExecutor(max_workers=7) as executor:
        f_maturity = executor.submit(_fetch_maturity)
        f_twin = executor.submit(_fetch_twin_current)
        f_twin_prev = executor.submit(_fetch_twin_prev)
        f_risks = executor.submit(_fetch_active_risks)
        f_evolution = executor.submit(generate_evolution_feed, db, investor_id)
        f_replay = executor.submit(select_best_replay, db, investor_id)
        f_goals = executor.submit(_fetch_goals)

        maturity = f_maturity.result()
        twin_current = f_twin.result()
        twin_prev = f_twin_prev.result()
        active_risks = f_risks.result()
        evolution_feed = f_evolution.result()
        replay_highlight = f_replay.result()
        goals_result = f_goals.result()

    stage = maturity.stage if maturity else "foundation"

    header = _build_header(db, investor_id, maturity, twin_current, twin_prev, len(active_risks))
    top_actions = generate_top_actions(db, investor_id, stage, goals_result)
    health_radar = _build_health_radar(db, investor_id)
    twin_insights = _build_twin_insights(twin_current)
    behavioral_risks = [
        BehavioralRiskCard(
            event_type=r.event_type,
            severity=r.severity,
            description=r.description or "",
            recommendation=r.recommendation or "",
        )
        for r in active_risks
    ]
    futures_preview = _build_futures_preview(db, investor_id)
    progression = _build_progression(maturity)
    goal_progress = _build_goal_progress(db, investor_id)

    # AI summary — check Redis cache first, fall back to live call
    from app.command_center.ai_cache import get_cached, set_cached
    from app.command_center.ai_memory import write_entry as write_memory

    ai_summary = ""
    ai_verbosity = verbosity
    cached = get_cached(investor_id, verbosity)
    if cached:
        ai_summary = cached
    else:
        try:
            report = agent_engine.run_agent(db, investor_id, verbosity=verbosity)
            ai_summary = report.portfolio_assessment or ""
            ai_verbosity = report.verbosity_used
            if ai_summary:
                set_cached(investor_id, verbosity, ai_summary)
                # Build key_metrics snapshot for longitudinal memory
                from app.models.financial_profile import FinancialProfile
                from app.models.portfolio_snapshot import PortfolioSnapshot
                key_metrics: dict = {
                    "twin_overall_score": round(twin_current.overall_score, 1) if twin_current else None,
                    "maturity_stage": stage,
                    "stability_score": header.stability_score,
                }
                fp_mem = db.query(FinancialProfile).filter(
                    FinancialProfile.investor_profile_id == investor_id
                ).first()
                if fp_mem:
                    key_metrics["ef_months"] = fp_mem.emergency_fund_months
                snap_mem = (
                    db.query(PortfolioSnapshot)
                    .filter(PortfolioSnapshot.investor_id == investor_id)
                    .order_by(PortfolioSnapshot.snapshot_at.desc())
                    .first()
                )
                if snap_mem:
                    key_metrics["net_worth"] = float(snap_mem.total_value)
                try:
                    write_memory(
                        db=db,
                        investor_id=investor_id,
                        verbosity=verbosity,
                        portfolio_assessment=ai_summary,
                        key_metrics=key_metrics,
                    )
                except Exception:
                    pass  # memory write failure must never break the report
        except Exception:
            ai_summary = "AI summary unavailable. Configure ANTHROPIC_API_KEY to enable."

    return CommandCenterReport(
        header=header,
        top_actions=top_actions,
        evolution_feed=evolution_feed,
        health_radar=health_radar,
        twin_insights=twin_insights,
        behavioral_risks=behavioral_risks,
        futures_preview=futures_preview,
        replay_highlight=replay_highlight,
        ai_summary=ai_summary,
        ai_summary_verbosity=ai_verbosity,
        progression=progression,
        goal_progress=goal_progress,
        maturity_stage=stage,
        generated_at=now,
    )

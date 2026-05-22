"""AI Coach service.

Generates and stores proactive financial insights for the investor.
Two tiers:
  1. Rule-based (deterministic, no AI) — runs always
  2. AI narrative layer (optional) — adds human-readable insight + action text

Insight deduplication: within a 7-day window, dismissed insights with the
same dedup_key are not recreated. Non-dismissed insights are replaced on
refresh so the message stays current.
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

log = logging.getLogger(__name__)

TAX_RATE = 0.25  # Israeli flat capital-gains rate used for estimates


@dataclass
class InsightCandidate:
    dedup_key: str
    insight_type: str
    severity: str  # info | warning | danger
    title: str
    message: str
    action_text: str | None
    link: str | None


# ── Public API ──────────────────────────────────────────────────────────────

def get_insights(db: Session, investor_id: uuid.UUID) -> list:
    from app.models.coach_insight import CoachInsight
    return (
        db.query(CoachInsight)
        .filter(
            CoachInsight.investor_id == investor_id,
            CoachInsight.is_dismissed == False,  # noqa: E712
        )
        .order_by(CoachInsight.generated_at.desc())
        .all()
    )


def refresh_insights(db: Session, investor_id: uuid.UUID, api_key: str | None = None) -> list:
    """Regenerate insights: run all rules, persist new findings, return active insights."""
    candidates = _run_rules(db, investor_id)

    if api_key and candidates:
        candidates = _enrich_with_ai(candidates, api_key)

    _persist(db, investor_id, candidates)
    return get_insights(db, investor_id)


def dismiss_insight(db: Session, investor_id: uuid.UUID, insight_id: uuid.UUID) -> bool:
    from app.models.coach_insight import CoachInsight
    row = db.query(CoachInsight).filter(
        CoachInsight.id == insight_id,
        CoachInsight.investor_id == investor_id,
    ).first()
    if not row:
        return False
    row.is_dismissed = True
    row.dismissed_at = datetime.now(timezone.utc)
    db.commit()
    return True


# ── Rule engine ─────────────────────────────────────────────────────────────

def _run_rules(db: Session, investor_id: uuid.UUID) -> list[InsightCandidate]:
    candidates: list[InsightCandidate] = []

    candidates += _rule_emergency_fund(db, investor_id)
    candidates += _rule_idle_cash(db, investor_id)
    candidates += _rule_goal_behind(db, investor_id)
    candidates += _rule_portfolio_drift(db, investor_id)
    candidates += _rule_tax_loss_harvest(db, investor_id)
    candidates += _rule_paper_trading_milestone(db, investor_id)
    candidates += _rule_high_interest_debt(db, investor_id)

    return candidates


def _rule_emergency_fund(db: Session, investor_id: uuid.UUID) -> list[InsightCandidate]:
    try:
        from app.models.financial_profile import FinancialProfile
        fp = db.query(FinancialProfile).filter(
            FinancialProfile.investor_profile_id == investor_id
        ).first()
        if not fp:
            return []
        if fp.emergency_fund_months < 3:
            gap_months = 3 - fp.emergency_fund_months
            gap_amount = gap_months * fp.monthly_expenses
            return [InsightCandidate(
                dedup_key="emergency_fund_low",
                insight_type="emergency_fund",
                severity="danger",
                title="Emergency fund is below target",
                message=(
                    f"You have {fp.emergency_fund_months:.1f} months of expenses covered "
                    f"but the recommended minimum is 3 months. "
                    f"You need approximately {fp.currency} {gap_amount:,.0f} more."
                ),
                action_text="Build your emergency fund before increasing investment risk.",
                link="/financial",
            )]
    except Exception as exc:
        log.debug("coach rule emergency_fund: %s", exc)
    return []


def _rule_idle_cash(db: Session, investor_id: uuid.UUID) -> list[InsightCandidate]:
    try:
        from app.models.financial_profile import FinancialProfile
        from app.models.portfolio_snapshot import PortfolioSnapshot
        fp = db.query(FinancialProfile).filter(
            FinancialProfile.investor_profile_id == investor_id
        ).first()
        if not fp or fp.liquid_savings <= 0:
            return []
        snap = (
            db.query(PortfolioSnapshot)
            .filter(PortfolioSnapshot.investor_id == investor_id)
            .order_by(PortfolioSnapshot.snapshot_at.desc())
            .first()
        )
        portfolio_value = snap.total_value if snap else 0.0
        total_assets = fp.liquid_savings + portfolio_value
        cash_pct = fp.liquid_savings / total_assets * 100 if total_assets > 0 else 0
        if cash_pct > 40 and fp.liquid_savings > fp.monthly_expenses * 6:
            # Excess beyond 6-month emergency fund
            excess = fp.liquid_savings - fp.monthly_expenses * 6
            opportunity_cost = excess * 0.07  # rough 7% annual opportunity cost
            return [InsightCandidate(
                dedup_key="idle_cash_high",
                insight_type="idle_cash",
                severity="warning",
                title="Large cash position sitting idle",
                message=(
                    f"You hold {fp.currency} {fp.liquid_savings:,.0f} in liquid savings "
                    f"({cash_pct:.0f}% of total assets). Beyond a 6-month emergency fund, "
                    f"~{fp.currency} {excess:,.0f} could be working harder — "
                    f"estimated opportunity cost: {fp.currency} {opportunity_cost:,.0f}/yr at 7%."
                ),
                action_text="Consider deploying excess cash per your risk model allocation.",
                link="/risk",
            )]
    except Exception as exc:
        log.debug("coach rule idle_cash: %s", exc)
    return []


def _rule_goal_behind(db: Session, investor_id: uuid.UUID) -> list[InsightCandidate]:
    try:
        from app.goals_analysis.service import get_analysis
        result = get_analysis(db, investor_id)
        if not result:
            return []
        candidates = []
        for g in result.goals:
            if g.status == "at_risk":
                gap = abs(g.gap or 0)
                candidates.append(InsightCandidate(
                    dedup_key=f"goal_behind_{g.goal_id}",
                    insight_type="goal_behind",
                    severity="warning",
                    title=f"Goal at risk: {g.goal_name}",
                    message=(
                        f"'{g.goal_name}' needs {g.monthly_contribution_needed:,.0f}/mo "
                        f"but you only have {g.monthly_surplus_available:,.0f}/mo available. "
                        f"Monthly gap: {gap:,.0f}."
                    ),
                    action_text="Review your budget or adjust the goal timeline.",
                    link="/goals",
                ))
        return candidates
    except Exception as exc:
        log.debug("coach rule goal_behind: %s", exc)
    return []


def _rule_portfolio_drift(db: Session, investor_id: uuid.UUID) -> list[InsightCandidate]:
    try:
        from app.proactive_insights.engine import detect_drift
        report = detect_drift(db, investor_id)
        candidates = []
        for event in report.drift_events:
            if event.event_type == "concentration":
                candidates.append(InsightCandidate(
                    dedup_key=f"concentration_{event.ticker}",
                    insight_type="concentration",
                    severity=event.severity,
                    title=f"Concentration risk: {event.ticker}",
                    message=(
                        f"{event.ticker} is {event.value_pct:.1f}% of your portfolio "
                        f"(threshold: 20%). High single-asset exposure amplifies volatility."
                    ),
                    action_text=f"Consider trimming {event.ticker} to reduce concentration below 20%.",
                    link="/investments",
                ))
            elif event.event_type == "tier_drift":
                direction = "overweight" if (event.delta_pct or 0) > 0 else "underweight"
                candidates.append(InsightCandidate(
                    dedup_key=f"tier_drift_{event.tier}",
                    insight_type="tier_drift",
                    severity=event.severity,
                    title=f"Allocation drift: {event.name}",
                    message=(
                        f"Your {event.name} tier is {direction} by "
                        f"{abs(event.delta_pct or 0):.1f}% vs your risk model target."
                    ),
                    action_text="Go to Investments → Rebalancing to see suggested trades.",
                    link="/investments",
                ))
        return candidates
    except Exception as exc:
        log.debug("coach rule portfolio_drift: %s", exc)
    return []


def _rule_tax_loss_harvest(db: Session, investor_id: uuid.UUID) -> list[InsightCandidate]:
    try:
        from app.models.investment_account import InvestmentAccount
        accounts = db.query(InvestmentAccount).filter(
            InvestmentAccount.investor_id == investor_id
        ).all()
        candidates_data = []
        for acc in accounts:
            for h in acc.holdings:
                if h.current_value is None or h.quantity <= 0:
                    continue
                cost = h.avg_buy_price * h.quantity
                loss = h.current_value - cost
                if loss < -500:  # at least $500 loss to be worth flagging
                    saving = abs(loss) * TAX_RATE
                    candidates_data.append((h.name or h.ticker or "?", loss, saving, h.currency))
        if not candidates_data:
            return []
        candidates_data.sort(key=lambda x: x[1])  # worst losses first
        top = candidates_data[:3]
        names = ", ".join(f"{n} ({c} {abs(l):,.0f})" for n, l, _, c in top)
        total_saving = sum(s for _, _, s, _ in top)
        return [InsightCandidate(
            dedup_key="tax_loss_harvest",
            insight_type="tax_loss_harvest",
            severity="info",
            title="Tax-loss harvesting opportunity",
            message=(
                f"You have unrealized losses in: {names}. "
                f"Realizing these losses could save ~{top[0][3]} {total_saving:,.0f} in taxes."
            ),
            action_text="Review tax-loss harvesting candidates in your portfolio.",
            link="/investments",
        )]
    except Exception as exc:
        log.debug("coach rule tax_loss_harvest: %s", exc)
    return []


def _rule_paper_trading_milestone(db: Session, investor_id: uuid.UUID) -> list[InsightCandidate]:
    try:
        from app.models.paper_trade import PaperPortfolio, PortfolioStatus
        from app.models.live_trading import LiveTradingSession
        from datetime import date

        # Check if already live-trading approved
        live = db.query(LiveTradingSession).filter(
            LiveTradingSession.investor_id == investor_id,
            LiveTradingSession.is_active == True,  # noqa: E712
        ).first()
        if live:
            return []

        portfolios = db.query(PaperPortfolio).filter(
            PaperPortfolio.investor_id == investor_id,
            PaperPortfolio.status == PortfolioStatus.active,
        ).all()

        qualified = []
        for p in portfolios:
            if not p.created_at:
                continue
            age_days = (date.today() - p.created_at.date()).days
            if age_days >= 30 and (p.sharpe_ratio or 0) >= 0.5:
                qualified.append(p)

        if qualified:
            best = max(qualified, key=lambda p: p.sharpe_ratio or 0)
            return [InsightCandidate(
                dedup_key="paper_trading_milestone",
                insight_type="paper_trading_milestone",
                severity="info",
                title="Paper trading milestone reached",
                message=(
                    f"Your paper portfolio '{best.name}' has a Sharpe ratio of "
                    f"{best.sharpe_ratio:.2f} over 30+ days — you meet the minimum "
                    f"track record for live trading review."
                ),
                action_text="Apply for live trading access via the Live Trading page.",
                link="/live-trading",
            )]
    except Exception as exc:
        log.debug("coach rule paper_trading_milestone: %s", exc)
    return []


def _rule_high_interest_debt(db: Session, investor_id: uuid.UUID) -> list[InsightCandidate]:
    try:
        from app.models.financial_profile import FinancialProfile
        fp = db.query(FinancialProfile).filter(
            FinancialProfile.investor_profile_id == investor_id
        ).first()
        if not fp:
            return []
        high_cost = [
            li for li in fp.liabilities
            if li.interest_rate_pct and li.interest_rate_pct > 10
        ]
        if not high_cost:
            return []
        total_balance = sum(li.outstanding_balance for li in high_cost)
        avg_rate = sum(li.interest_rate_pct for li in high_cost) / len(high_cost)  # type: ignore[arg-type]
        annual_interest = total_balance * avg_rate / 100
        return [InsightCandidate(
            dedup_key="high_interest_debt",
            insight_type="high_interest_debt",
            severity="warning",
            title="High-interest debt costs more than typical returns",
            message=(
                f"You carry {fp.currency} {total_balance:,.0f} in debt averaging "
                f"{avg_rate:.1f}% interest (~{fp.currency} {annual_interest:,.0f}/yr). "
                f"Paying this down delivers a guaranteed {avg_rate:.1f}% return."
            ),
            action_text="Prioritize paying down high-interest debt before increasing investment risk.",
            link="/debt-planner",
        )]
    except Exception as exc:
        log.debug("coach rule high_interest_debt: %s", exc)
    return []


# ── Persistence ──────────────────────────────────────────────────────────────

def _persist(db: Session, investor_id: uuid.UUID, candidates: list[InsightCandidate]) -> None:
    from app.models.coach_insight import CoachInsight

    now = datetime.now(timezone.utc)
    dismissed_cutoff = now - timedelta(days=7)

    # Load recently dismissed keys (within 7 days) — don't re-create them
    recently_dismissed = set(
        row.dedup_key
        for row in db.query(CoachInsight.dedup_key).filter(
            CoachInsight.investor_id == investor_id,
            CoachInsight.is_dismissed == True,  # noqa: E712
            CoachInsight.dismissed_at >= dismissed_cutoff,
        ).all()
    )

    # Delete all existing non-dismissed insights for this investor (they'll be replaced)
    db.query(CoachInsight).filter(
        CoachInsight.investor_id == investor_id,
        CoachInsight.is_dismissed == False,  # noqa: E712
    ).delete()

    for c in candidates:
        if c.dedup_key in recently_dismissed:
            continue
        db.add(CoachInsight(
            investor_id=investor_id,
            insight_type=c.insight_type,
            dedup_key=c.dedup_key,
            severity=c.severity,
            title=c.title,
            message=c.message,
            action_text=c.action_text,
            link=c.link,
            generated_at=now,
        ))

    db.commit()


# ── Optional AI enrichment ───────────────────────────────────────────────────

_AI_SYSTEM = """\
You are a concise financial coach. For each insight provided, write:
- "insight": one sentence explaining why this matters to the investor personally
- "action": one concrete step they can take today

Rules: be specific, never guarantee returns, keep each field under 40 words.
Respond with valid JSON array only: [{"dedup_key":"...","insight":"...","action":"..."}, ...]
"""


def _enrich_with_ai(candidates: list[InsightCandidate], api_key: str) -> list[InsightCandidate]:
    import json
    try:
        import anthropic
        from app.core.tracing import trace_ai_call
        payload = [
            {"dedup_key": c.dedup_key, "title": c.title, "message": c.message}
            for c in candidates
        ]
        client = anthropic.Anthropic(api_key=api_key)
        with trace_ai_call(
            "ai_coach",
            model="claude-haiku-4-5-20251001",
            input_data={"candidate_count": len(candidates)},
        ) as span:
            msg = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=1024,
                system=_AI_SYSTEM,
                messages=[{"role": "user", "content": json.dumps(payload)}],
            )
            span.set_output(msg.content[0].text[:2000])
            span.set_tokens(msg.usage.input_tokens, msg.usage.output_tokens)
        items = json.loads(msg.content[0].text.strip())
        enriched = {i["dedup_key"]: i for i in items}
        result = []
        for c in candidates:
            if c.dedup_key in enriched:
                e = enriched[c.dedup_key]
                result.append(InsightCandidate(
                    dedup_key=c.dedup_key,
                    insight_type=c.insight_type,
                    severity=c.severity,
                    title=c.title,
                    message=e.get("insight", c.message),
                    action_text=e.get("action", c.action_text),
                    link=c.link,
                ))
            else:
                result.append(c)
        return result
    except Exception as exc:
        log.warning("coach AI enrichment failed: %s", exc)
        return candidates

"""Resilience Stress-Test Engine — life-event depletion simulation."""
import uuid
from datetime import datetime, timezone

from app.liquidity_runway.schemas import LiquidityHolding
from app.resilience.schemas import DepletionStep, LifeEventRequest, ResilienceResult


def _survival_score(months_covered: int, duration_months: int, tier3_breach: bool) -> int:
    if not tier3_breach:
        return 100
    if duration_months <= 0:
        return 100
    return min(99, int(months_covered / duration_months * 100))


def _survival_verdict(score: int) -> str:
    if score >= 80:
        return "Safe"
    if score >= 50:
        return "At Risk"
    return "Critical"


def simulate_depletion(
    monthly_burn: float,
    duration_months: int,
    cash_reserve: float,
    liquidatable_holdings: list[LiquidityHolding],
) -> tuple[list[DepletionStep], int, bool]:
    """Pure simulation — no DB calls.

    Returns (depletion_path, months_covered, tier3_breach).
    Drains cash reserve first (Tier 0), then Tier 1, then Tier 2 in cost-efficiency order.
    Stops before touching Tier 3 (locked) assets.
    """
    if monthly_burn <= 0:
        return [], duration_months, False

    wallet = cash_reserve
    pool = list(liquidatable_holdings)  # already sorted cheapest-to-liquidate first
    steps: list[DepletionStep] = []
    months_covered = 0
    tier3_breach = False
    cumulative_raised = cash_reserve

    for month in range(1, duration_months + 1):
        wallet -= monthly_burn

        # Liquidate cheapest available holdings until wallet is non-negative or pool is empty
        while wallet < 0 and pool:
            h = pool.pop(0)
            wallet += h.net_to_pocket
            cumulative_raised += h.net_to_pocket
            steps.append(DepletionStep(
                month=month,
                source_label=h.tier_label,
                holding_name=h.name,
                holding_ticker=h.ticker,
                gross_sold=round(h.gross_value, 2),
                tax_paid=round(h.estimated_tax, 2),
                net_received=round(h.net_to_pocket, 2),
                cumulative_net_raised=round(cumulative_raised, 2),
            ))

        if wallet < 0:
            # All liquidatable assets exhausted — Tier 3 breach required at this month
            tier3_breach = True
            months_covered = month - 1
            break

        months_covered = month

    return steps, months_covered, tier3_breach


def _build_ai_prompt(result: ResilienceResult) -> str:
    label = result.scenario_label
    score = result.survival_score
    verdict = result.survival_verdict
    burn = result.monthly_burn
    months = result.duration_months
    covered = result.months_covered
    currency = result.currency

    prompt = (
        f"An investor is stress-testing a life event scenario: '{label}'. "
        f"Duration: {months} months. Monthly cash deficit: {burn:,.0f} {currency}. "
        f"Survival score: {score}/100 ({verdict}). "
    )

    if not result.tier3_breach:
        prompt += (
            "Their liquid assets fully cover the scenario with no need to touch locked funds. "
            "Provide a concise (2–3 sentence) encouraging but honest recommendation: "
            "what they are doing right and what buffer they should consider maintaining."
        )
    else:
        prompt += (
            f"Their liquid assets only cover {covered} of {months} months before locked funds must be broken. "
            f"Locked assets (pension/real estate) total {result.tier3_total_gross:,.0f} {currency}. "
            f"Provide a concise (2–3 sentence) actionable recommendation: "
            f"how much additional cash buffer they need, which asset tier to target, "
            f"and one specific action to improve resilience. "
            f"Do NOT guarantee returns or recommend leverage."
        )
    return prompt


def _call_claude(prompt: str, api_key: str) -> str | None:
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        msg = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )
        return msg.content[0].text.strip() if msg.content else None
    except Exception:
        return None


def compute_resilience(
    portfolio,           # PortfolioSummary
    financial_profile,   # FinancialProfile | None
    investor_id: uuid.UUID,
    country: str,
    request: LifeEventRequest,
    api_key: str | None = None,
) -> ResilienceResult:
    from app.liquidity_runway.engine import compute_liquidity_runway

    # Baseline financials — default to 0 if no financial profile
    monthly_income = getattr(financial_profile, "monthly_income", 0.0) or 0.0
    monthly_expenses = getattr(financial_profile, "monthly_expenses", 0.0) or 0.0
    cash_reserve = getattr(financial_profile, "liquid_savings", 0.0) or 0.0

    # Net monthly cash deficit after scenario adjustments
    effective_income = max(0.0, monthly_income - request.monthly_income_loss)
    effective_expenses = monthly_expenses + request.monthly_expense_increase
    monthly_burn = max(0.0, effective_expenses - effective_income)

    # Reuse liquidity runway to get tiered, sorted holdings
    runway = compute_liquidity_runway(portfolio, investor_id, country)

    # Tier 3 total (locked — excluded from simulation)
    tier3_total = sum(h.gross_value for h in runway.holdings if h.tier == 3)

    # Liquidatable holdings already sorted cheapest-first by runway engine
    liquidatable = [h for h in runway.holdings if h.tier < 3]

    label = request.scenario_label or f"{request.duration_months}-Month Life Event"

    depletion_path, months_covered, tier3_breach = simulate_depletion(
        monthly_burn=monthly_burn,
        duration_months=request.duration_months,
        cash_reserve=cash_reserve,
        liquidatable_holdings=liquidatable,
    )

    score = _survival_score(months_covered, request.duration_months, tier3_breach)
    verdict = _survival_verdict(score)

    result = ResilienceResult(
        investor_id=investor_id,
        currency=portfolio.base_currency,
        scenario_label=label,
        duration_months=request.duration_months,
        monthly_income=round(monthly_income, 2),
        monthly_expenses=round(monthly_expenses, 2),
        monthly_income_loss=round(request.monthly_income_loss, 2),
        monthly_expense_increase=round(request.monthly_expense_increase, 2),
        monthly_burn=round(monthly_burn, 2),
        total_cash_needed=round(monthly_burn * request.duration_months, 2),
        cash_reserve=round(cash_reserve, 2),
        tier3_total_gross=round(tier3_total, 2),
        months_covered=months_covered,
        tier3_breach=tier3_breach,
        survival_score=score,
        survival_verdict=verdict,
        depletion_path=depletion_path,
        ai_recommendation=None,
        computed_at=datetime.now(timezone.utc),
    )

    if api_key:
        prompt = _build_ai_prompt(result)
        result.ai_recommendation = _call_claude(prompt, api_key)

    return result

"""Liquidity Runway Engine — tiers, net-to-pocket, emergency lever greedy selection."""
import uuid
from datetime import datetime, timezone

from app.liquidity_runway.schemas import LiquidityBucket, LiquidityHolding, LiquidityRunway

# Tier 1 = liquidatable in 1-3 days, Tier 2 = 1 week, Tier 3 = locked
_ASSET_TIER: dict[str, tuple[int, str]] = {
    "stock":        (1, "T+2 Settlement"),
    "etf":          (1, "T+2 Settlement"),
    "crypto":       (1, "1–3 Days"),
    "bond":         (2, "1 Week"),
    "fund":         (2, "3–7 Days"),
    "call_option":  (1, "T+2 Settlement"),
    "put_option":   (1, "T+2 Settlement"),
    "real_estate":  (3, "Locked"),
    "pension_fund": (3, "Locked"),
    "study_fund":   (3, "Locked"),
    "other":        (2, "Varies"),
}

# Account types that override any holding tier to locked
_LOCKED_ACCOUNT_TYPES = {"pension", "keren_hishtalmut"}

# Market impact buffer by tier (% of gross value)
_IMPACT_PCT: dict[int, float] = {
    1: 0.5,  # stocks/ETFs/crypto: bid-ask + slippage estimate
    2: 0.0,  # bonds/funds: redeemed at NAV
    3: 0.0,  # locked: not liquidatable
}

_BUCKET_LABELS: dict[int, str] = {
    1: "1–3 Days",
    2: "1 Week",
    3: "Locked",
}


def _get_tier(asset_type: str, account_type: str) -> tuple[int, str]:
    if account_type in _LOCKED_ACCOUNT_TYPES:
        return 3, "Locked"
    return _ASSET_TIER.get(asset_type, (2, "Varies"))


def _compute_tax(unrealized_pnl: float, tax_rate_pct: float) -> float:
    """Estimated capital gains tax on positive unrealized gains."""
    if unrealized_pnl <= 0:
        return 0.0
    return unrealized_pnl * tax_rate_pct / 100.0


def compute_liquidity_runway(
    portfolio,  # PortfolioSummary
    investor_id: uuid.UUID,
    country: str,
    target_amount: float | None = None,
) -> LiquidityRunway:
    from app.tax_harvesting.service import _capital_gains_rate

    currency = portfolio.base_currency
    tax_rate = _capital_gains_rate(country)
    now = datetime.now(timezone.utc)

    holdings: list[LiquidityHolding] = []

    for acc in portfolio.accounts:
        account_label = acc.account_name or acc.provider_name
        account_type = acc.account_type

        for h in acc.holdings:
            gross = h.current_value_base
            if gross <= 0:
                continue

            tier, tier_label = _get_tier(h.asset_type, account_type)

            if tier == 3:
                # Locked: include in bucket totals only
                holdings.append(LiquidityHolding(
                    holding_id=h.id,
                    name=h.name,
                    ticker=h.ticker,
                    asset_type=h.asset_type,
                    account_name=account_label,
                    gross_value=round(gross, 2),
                    estimated_tax=0.0,
                    market_impact=0.0,
                    net_to_pocket=0.0,
                    tier=3,
                    tier_label=tier_label,
                    selected_for_target=False,
                ))
                continue

            tax = _compute_tax(h.unrealized_pnl, tax_rate)
            impact = gross * _IMPACT_PCT[tier] / 100.0
            net = max(0.0, gross - tax - impact)

            holdings.append(LiquidityHolding(
                holding_id=h.id,
                name=h.name,
                ticker=h.ticker,
                asset_type=h.asset_type,
                account_name=account_label,
                gross_value=round(gross, 2),
                estimated_tax=round(tax, 2),
                market_impact=round(impact, 2),
                net_to_pocket=round(net, 2),
                tier=tier,
                tier_label=tier_label,
                selected_for_target=False,
            ))

    # Sort liquidatable holdings by cost ratio (cheapest to liquidate first)
    liquidatable = [h for h in holdings if h.tier < 3]
    locked = [h for h in holdings if h.tier == 3]
    liquidatable.sort(
        key=lambda h: (h.estimated_tax + h.market_impact) / h.gross_value if h.gross_value > 0 else 1.0
    )

    # Emergency lever greedy selection
    lever_total_gross = 0.0
    lever_total_net = 0.0
    target_met: bool | None = None

    if target_amount is not None:
        accumulated_net = 0.0
        for h in liquidatable:
            if accumulated_net >= target_amount:
                break
            h.selected_for_target = True
            accumulated_net += h.net_to_pocket
            lever_total_gross += h.gross_value
            lever_total_net += h.net_to_pocket
        target_met = accumulated_net >= target_amount

    lever_total_gross = round(lever_total_gross, 2)
    lever_total_net = round(lever_total_net, 2)

    # Bucket aggregation
    bucket_gross: dict[int, float] = {1: 0.0, 2: 0.0, 3: 0.0}
    bucket_net: dict[int, float] = {1: 0.0, 2: 0.0, 3: 0.0}
    bucket_count: dict[int, int] = {1: 0, 2: 0, 3: 0}

    for h in holdings:
        bucket_gross[h.tier] += h.gross_value
        bucket_net[h.tier] += h.net_to_pocket
        bucket_count[h.tier] += 1

    buckets = [
        LiquidityBucket(
            tier=t,
            label=_BUCKET_LABELS[t],
            total_gross=round(bucket_gross[t], 2),
            total_net_to_pocket=round(bucket_net[t], 2),
            holding_count=bucket_count[t],
        )
        for t in (1, 2, 3)
    ]

    total_gross = round(sum(h.gross_value for h in holdings), 2)
    total_net = round(sum(h.net_to_pocket for h in liquidatable), 2)

    return LiquidityRunway(
        investor_id=investor_id,
        currency=currency,
        buckets=buckets,
        total_gross=total_gross,
        total_net_to_pocket=total_net,
        target_amount=target_amount,
        target_met=target_met,
        lever_total_gross=lever_total_gross,
        lever_total_net=lever_total_net,
        holdings=liquidatable + locked,  # liquidatable first (sorted), then locked
        computed_at=now,
    )

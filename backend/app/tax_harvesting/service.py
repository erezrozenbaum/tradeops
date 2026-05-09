"""Tax-loss harvesting opportunity detection."""
import uuid
from datetime import date, datetime, timezone

from app.portfolio_analysis.schemas import PortfolioSummary
from app.tax_harvesting.schemas import (
    GainOffset,
    HarvestOpportunity,
    TaxOpportunityResult,
)

_MIN_LOSS_THRESHOLD_PCT = 5.0   # only flag losses > 5%
_GAIN_THRESHOLD_PCT = 2.5       # flag gains > 2.5% as offset candidates
_WASH_SALE_DAYS = 30            # warn if purchased within last 30 days
_SHORT_TERM_DAYS = 365          # < 365 days = short-term holding


def _capital_gains_rate(country: str) -> float:
    """Return the representative CGT rate (%) for a country."""
    from app.tax_rules.rules import TAX_RULES
    rules = TAX_RULES.get(country.upper(), {})
    cg = rules.get("capital_gains", {})
    # Flat-rate countries (IL, DE, FR)
    if "rate_pct" in cg:
        return float(cg["rate_pct"])
    if "effective_rate_pct" in cg:
        return float(cg["effective_rate_pct"])
    if "flat_rate_pct" in cg:
        return float(cg["flat_rate_pct"])
    # US: use middle long-term bracket (15%)
    if "long_term" in cg:
        brackets = cg["long_term"].get("brackets_2024", [])
        for b in brackets:
            if b.get("rate_pct", 0) > 0:
                return float(b["rate_pct"])
    return 25.0  # conservative default


def compute_opportunities(
    portfolio: PortfolioSummary | None,
    investor_id: uuid.UUID,
    country: str,
) -> TaxOpportunityResult:
    now = datetime.now(timezone.utc)
    tax_rate = _capital_gains_rate(country)

    if portfolio is None or portfolio.total_current_value <= 0:
        return TaxOpportunityResult(
            investor_id=investor_id,
            currency="USD",
            harvest_opportunities=[],
            gain_offsets=[],
            total_harvestable_loss=0.0,
            total_estimated_tax_saving=0.0,
            capital_gains_rate_pct=tax_rate,
            min_loss_threshold_pct=_MIN_LOSS_THRESHOLD_PCT,
            computed_at=now,
        )

    today = date.today()
    harvest_ops: list[HarvestOpportunity] = []
    gain_offsets: list[GainOffset] = []

    for acc in portfolio.accounts:
        account_label = acc.account_name or acc.provider_name
        for h in acc.holdings:
            if h.cost_basis <= 0:
                continue

            loss_pct = h.unrealized_pnl_pct  # already in % from service

            if loss_pct < -_MIN_LOSS_THRESHOLD_PCT:
                holding_days: int | None = None
                if h.purchase_date:
                    holding_days = (today - h.purchase_date).days

                is_short_term = holding_days < _SHORT_TERM_DAYS if holding_days is not None else True
                wash_sale_risk = holding_days is not None and holding_days < _WASH_SALE_DAYS

                estimated_saving = abs(h.unrealized_pnl) * tax_rate / 100.0

                harvest_ops.append(HarvestOpportunity(
                    holding_id=h.id,
                    name=h.name,
                    ticker=h.ticker,
                    asset_type=h.asset_type,
                    account_name=account_label,
                    unrealized_loss=round(h.unrealized_pnl, 2),
                    unrealized_loss_pct=round(loss_pct, 2),
                    holding_days=holding_days,
                    is_short_term=is_short_term,
                    wash_sale_risk=wash_sale_risk,
                    estimated_tax_saving=round(estimated_saving, 2),
                ))

            elif loss_pct > _GAIN_THRESHOLD_PCT:
                gain_offsets.append(GainOffset(
                    holding_id=h.id,
                    name=h.name,
                    ticker=h.ticker,
                    asset_type=h.asset_type,
                    unrealized_gain=round(h.unrealized_pnl, 2),
                    unrealized_gain_pct=round(loss_pct, 2),
                ))

    # Sort by loss magnitude (most negative first)
    harvest_ops.sort(key=lambda x: x.unrealized_loss)
    # Sort gain offsets by gain magnitude (largest first)
    gain_offsets.sort(key=lambda x: x.unrealized_gain, reverse=True)

    total_loss = sum(op.unrealized_loss for op in harvest_ops)
    total_saving = sum(op.estimated_tax_saving for op in harvest_ops)

    return TaxOpportunityResult(
        investor_id=investor_id,
        currency=portfolio.base_currency,
        harvest_opportunities=harvest_ops,
        gain_offsets=gain_offsets[:5],
        total_harvestable_loss=round(total_loss, 2),
        total_estimated_tax_saving=round(total_saving, 2),
        capital_gains_rate_pct=tax_rate,
        min_loss_threshold_pct=_MIN_LOSS_THRESHOLD_PCT,
        computed_at=now,
    )

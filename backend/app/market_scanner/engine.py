"""
Pure market scanner engine — no DB access.

Filters and ranks catalog instruments based on:
  - Investment readiness classification
  - Risk model allocation and enforcement
  - Investor's preferred assets
  - Existing portfolio diversification
  - Time horizon alignment
  - Experience level
"""
from app.market_scanner.catalog import CATALOG, CatalogInstrument
from app.market_scanner.schemas import InstrumentSuggestion
from app.models.investor_profile import InvestorProfile
from app.models.risk_model import RiskModel

_RISK_ORDER = ["low", "moderate", "high", "very_high"]


def _risk_index(level: str) -> int:
    try:
        return _RISK_ORDER.index(level)
    except ValueError:
        return 1


def _investor_preferred_risk(risk_model: RiskModel) -> str:
    if risk_model.high_risk_pct >= 20:
        return "very_high"
    if risk_model.high_risk_pct >= 10 or risk_model.growth_pct >= 35:
        return "high"
    if risk_model.growth_pct >= 20:
        return "moderate"
    return "low"


def _risk_alignment_score(instrument_risk: str, preferred_risk: str) -> float:
    dist = abs(_risk_index(instrument_risk) - _risk_index(preferred_risk))
    return {0: 40.0, 1: 25.0, 2: 10.0}.get(dist, 0.0)


def _diversification_score(asset_type: str, asset_allocation: dict[str, float]) -> float:
    if not asset_allocation:
        return 15.0
    pct = asset_allocation.get(asset_type, 0.0)
    if pct == 0.0:
        return 30.0
    if pct < 25.0:
        return 20.0
    if pct < 50.0:
        return 10.0
    return 0.0


def _horizon_score(instrument_horizon: str, investor_horizon: str | None) -> float:
    if not investor_horizon:
        return 10.0
    _H = ["short_term", "medium_term", "long_term"]
    try:
        dist = abs(_H.index(instrument_horizon) - _H.index(investor_horizon))
    except ValueError:
        return 10.0
    return {0: 20.0, 1: 10.0}.get(dist, 0.0)


def _beginner_score(instr: CatalogInstrument, experience_level: str) -> float:
    if experience_level == "beginner" and not instr.suitable_for_beginners:
        return 0.0
    return 10.0


def _build_rationale(
    instr: CatalogInstrument,
    preferred_risk: str,
    asset_allocation: dict[str, float],
    investor_horizon: str | None,
) -> str:
    parts = [instr.brief_rationale]

    if asset_allocation:
        pct = asset_allocation.get(instr.asset_type, 0.0)
        if pct == 0.0:
            parts.append(f"Adds {instr.asset_type} exposure not yet in your portfolio.")
        elif pct < 25.0:
            parts.append(f"Diversifies your {instr.asset_type} allocation (currently {pct:.0f}%).")

    if instr.risk_level == preferred_risk:
        label = preferred_risk.replace("_", " ")
        parts.append(f"Risk level matches your {label} profile.")

    if investor_horizon and investor_horizon == instr.typical_horizon:
        label = investor_horizon.replace("_", " ")
        parts.append(f"Horizon aligned with your {label} outlook.")

    return " ".join(parts)


def scan(
    investor: InvestorProfile,
    risk_model: RiskModel | None,
    readiness_classification: str,
    asset_allocation: dict[str, float],
) -> tuple[list[InstrumentSuggestion], list[str]]:
    """
    Returns (suggestions sorted by fit_score desc, scan_notes).
    """
    notes: list[str] = []

    if readiness_classification == "not_ready":
        notes.append(
            "Financial stability score is too low for active investing — showing capital preservation "
            "instruments only (educational). Prioritise your emergency fund and reducing debt first."
        )
        readiness_classification = "education_only"

    # Resolve allowed risk levels and blocked families from risk model
    allowed_risk_levels: set[str]
    blocked_families: list[str] = []
    preferred_risk = "low"

    if risk_model:
        blocked_families = risk_model.blocked_strategy_families or []
        preferred_risk = _investor_preferred_risk(risk_model)
        age_tier = risk_model.age_tier

        if age_tier == "retirement":
            allowed_risk_levels = {"low", "moderate"}
            notes.append("Risk levels capped at moderate for retirement-stage investors.")
        elif age_tier == "pre_retirement":
            allowed_risk_levels = {"low", "moderate", "high"}
            notes.append("Very high-risk instruments excluded for pre-retirement investors.")
        elif risk_model.high_risk_pct == 0 and risk_model.growth_pct == 0:
            allowed_risk_levels = {"low"}
        elif risk_model.high_risk_pct == 0:
            allowed_risk_levels = {"low", "moderate"}
        else:
            allowed_risk_levels = {"low", "moderate", "high", "very_high"}
    else:
        allowed_risk_levels = {"low", "moderate"}
        notes.append(
            "No risk model found — showing conservative instruments only. "
            "Generate a risk model for personalised suggestions."
        )

    if readiness_classification == "education_only":
        notes.append("Showing full instrument list. Start small — even 500 ILS/month builds momentum.")

    if investor.preferred_assets:
        notes.append(f"Filtered to preferred assets: {', '.join(investor.preferred_assets)}.")

    preferred_categories: set[str] | None = (
        set(investor.preferred_assets) if investor.preferred_assets else None
    )

    scored: list[tuple[CatalogInstrument, float]] = []

    for instr in CATALOG:
        # Risk level gate
        if instr.risk_level not in allowed_risk_levels:
            continue

        # Blocked families gate
        if instr.asset_family in blocked_families:
            continue
        if "crypto" in blocked_families and instr.asset_type == "crypto":
            continue
        if "aggressive" in blocked_families and instr.risk_level == "very_high":
            continue

        # Preferred assets filter (if set)
        if preferred_categories is not None:
            if not set(instr.categories).intersection(preferred_categories):
                continue

        fit_score = round(
            _risk_alignment_score(instr.risk_level, preferred_risk)
            + _diversification_score(instr.asset_type, asset_allocation)
            + _horizon_score(instr.typical_horizon, investor.time_horizon)
            + _beginner_score(instr, investor.experience_level.value),
            2,
        )
        scored.append((instr, fit_score))

    scored.sort(key=lambda x: x[1], reverse=True)

    suggestions = [
        InstrumentSuggestion(
            ticker=instr.ticker,
            name=instr.name,
            asset_type=instr.asset_type,
            market=instr.market,
            currency=instr.currency,
            risk_level=instr.risk_level,
            typical_horizon=instr.typical_horizon,
            asset_family=instr.asset_family,
            fit_score=fit_score,
            rationale=_build_rationale(instr, preferred_risk, asset_allocation, investor.time_horizon),
            tags=list(instr.categories),
        )
        for instr, fit_score in scored
    ]

    return suggestions, notes

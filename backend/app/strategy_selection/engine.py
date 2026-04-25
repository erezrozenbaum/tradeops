from app.models.investor_profile import ExperienceLevel, InvestorProfile
from app.models.risk_model import RiskModel
from app.models.strategy_template import StrategyTemplate

_EXPERIENCE_ORDER: dict[str, int] = {
    ExperienceLevel.beginner.value: 0,
    ExperienceLevel.intermediate.value: 1,
    ExperienceLevel.advanced.value: 2,
}

_CLASSIFICATION_TO_MODIFIER: dict[str, str] = {
    "unstable": "reduce",
    "fragile": "reduce",
    "stable": "neutral",
    "strong": "allow_growth",
}


def _compute_fit_score(
    template: StrategyTemplate,
    investor: InvestorProfile,
    risk_model: RiskModel,
) -> float:
    """
    Score breakdown (max 100):
      - Experience alignment: 0–30 pts (exact match = 30, overqualified by 1 = 20, by 2 = 10)
      - Stability score margin: 0–40 pts (min(margin/50 * 40, 40))
      - Capital margin: 0–30 pts (proportional to how much capital exceeds minimum)
    """
    investor_exp = _EXPERIENCE_ORDER[investor.experience_level.value]
    template_exp = _EXPERIENCE_ORDER.get(template.min_experience_level, 0)
    exp_diff = investor_exp - template_exp
    exp_pts = max(30 - exp_diff * 10, 10)

    stability_margin = risk_model.stability_score - template.min_stability_score
    stability_pts = min(stability_margin / 50 * 40, 40)

    if template.min_investable_capital <= 0:
        capital_pts = 30.0
    else:
        ratio = risk_model.investable_capital / template.min_investable_capital
        capital_pts = min((ratio - 1) / 4 * 30, 30)

    return round(exp_pts + stability_pts + capital_pts, 2)


def _build_notes(
    template: StrategyTemplate,
    investor: InvestorProfile,
    risk_model: RiskModel,
    fit_score: float,
) -> str:
    capital_str = f"{risk_model.investable_capital:,.2f} {risk_model.currency}"
    min_capital_str = f"{template.min_investable_capital:,.2f}"
    return (
        f"Strategy: {template.strategy_type.value}. "
        f"Stability {risk_model.stability_score}/100 (min {template.min_stability_score}). "
        f"Experience: {investor.experience_level.value} (min {template.min_experience_level}). "
        f"Investable capital: {capital_str} (min {min_capital_str}). "
        f"Fit score: {fit_score:.1f}/100."
    )


def select_strategies(
    templates: list[StrategyTemplate],
    investor: InvestorProfile,
    risk_model: RiskModel,
) -> list[tuple[StrategyTemplate, float, str]]:
    """
    Filter templates by hard eligibility constraints, score each, and return
    (template, fit_score, notes) sorted by fit_score descending.
    """
    risk_modifier = _CLASSIFICATION_TO_MODIFIER.get(
        risk_model.stability_classification, "reduce"
    )
    investor_exp = _EXPERIENCE_ORDER[investor.experience_level.value]

    results = []
    for template in templates:
        if not template.is_active:
            continue
        if investor.is_minor and not template.suitable_for_minors:
            continue
        if not investor.is_minor and template.suitable_for_minors and template.strategy_type.value == "education_only":
            # Education-only templates are reserved for minors
            continue
        template_exp = _EXPERIENCE_ORDER.get(template.min_experience_level, 0)
        if investor_exp < template_exp:
            continue
        if risk_model.stability_score < template.min_stability_score:
            continue
        if risk_modifier not in template.allowed_risk_modifiers:
            continue
        if risk_model.investable_capital < template.min_investable_capital:
            continue

        fit_score = _compute_fit_score(template, investor, risk_model)
        notes = _build_notes(template, investor, risk_model, fit_score)
        results.append((template, fit_score, notes))

    results.sort(key=lambda x: x[1], reverse=True)
    return results

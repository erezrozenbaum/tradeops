import uuid
from unittest.mock import MagicMock

import pytest

from app.models.investor_profile import ExperienceLevel, InvestorProfile
from app.models.risk_model import RiskModel
from app.models.strategy_template import StrategyTemplate, StrategyType
from app.strategy_selection.engine import (
    _CLASSIFICATION_TO_MODIFIER,
    _compute_fit_score,
    select_strategies,
)


def _make_investor(
    experience_level: ExperienceLevel = ExperienceLevel.beginner,
    is_minor: bool = False,
) -> InvestorProfile:
    investor = MagicMock(spec=InvestorProfile)
    investor.experience_level = experience_level
    investor.is_minor = is_minor
    return investor


def _make_risk_model(
    stability_score: int = 60,
    stability_classification: str = "stable",
    investable_capital: float = 10000.0,
    currency: str = "USD",
) -> RiskModel:
    rm = MagicMock(spec=RiskModel)
    rm.stability_score = stability_score
    rm.stability_classification = stability_classification
    rm.investable_capital = investable_capital
    rm.currency = currency
    return rm


def _make_template(
    strategy_type: StrategyType = StrategyType.balanced,
    min_stability_score: int = 40,
    allowed_risk_modifiers: list[str] | None = None,
    min_experience_level: str = "beginner",
    suitable_for_minors: bool = False,
    min_investable_capital: float = 0.0,
    is_active: bool = True,
) -> StrategyTemplate:
    t = MagicMock(spec=StrategyTemplate)
    t.strategy_type = strategy_type
    t.min_stability_score = min_stability_score
    t.allowed_risk_modifiers = allowed_risk_modifiers or ["neutral", "allow_growth"]
    t.min_experience_level = min_experience_level
    t.suitable_for_minors = suitable_for_minors
    t.min_investable_capital = min_investable_capital
    t.is_active = is_active
    t.name = strategy_type.value
    t.description = ""
    t.asset_classes = []
    t.markets = []
    t.id = uuid.uuid4()
    return t


class TestClassificationToModifier:
    def test_unstable_maps_to_reduce(self):
        assert _CLASSIFICATION_TO_MODIFIER["unstable"] == "reduce"

    def test_fragile_maps_to_reduce(self):
        assert _CLASSIFICATION_TO_MODIFIER["fragile"] == "reduce"

    def test_stable_maps_to_neutral(self):
        assert _CLASSIFICATION_TO_MODIFIER["stable"] == "neutral"

    def test_strong_maps_to_allow_growth(self):
        assert _CLASSIFICATION_TO_MODIFIER["strong"] == "allow_growth"


class TestMinorFiltering:
    def test_minor_only_sees_suitable_for_minors_templates(self):
        investor = _make_investor(is_minor=True)
        rm = _make_risk_model(stability_score=50, stability_classification="stable")

        adult_template = _make_template(suitable_for_minors=False)
        minor_template = _make_template(
            strategy_type=StrategyType.education_only,
            suitable_for_minors=True,
            min_stability_score=0,
            allowed_risk_modifiers=["reduce", "neutral", "allow_growth"],
        )

        results = select_strategies([adult_template, minor_template], investor, rm)
        assert len(results) == 1
        assert results[0][0] is minor_template

    def test_minor_sees_no_templates_if_none_suitable(self):
        investor = _make_investor(is_minor=True)
        rm = _make_risk_model()
        templates = [_make_template(suitable_for_minors=False) for _ in range(3)]
        results = select_strategies(templates, investor, rm)
        assert results == []

    def test_adult_does_not_see_education_only_template(self):
        investor = _make_investor(is_minor=False)
        rm = _make_risk_model(stability_score=60, stability_classification="stable")
        education_template = _make_template(
            strategy_type=StrategyType.education_only,
            suitable_for_minors=True,
            min_stability_score=0,
            allowed_risk_modifiers=["reduce", "neutral", "allow_growth"],
        )
        results = select_strategies([education_template], investor, rm)
        assert results == []


class TestHardConstraints:
    def test_inactive_template_excluded(self):
        investor = _make_investor()
        rm = _make_risk_model()
        template = _make_template(is_active=False)
        assert select_strategies([template], investor, rm) == []

    def test_stability_score_below_minimum_excluded(self):
        investor = _make_investor()
        rm = _make_risk_model(stability_score=30, stability_classification="fragile")
        template = _make_template(
            min_stability_score=50,
            allowed_risk_modifiers=["reduce"],
        )
        assert select_strategies([template], investor, rm) == []

    def test_stability_score_at_minimum_included(self):
        investor = _make_investor()
        rm = _make_risk_model(stability_score=50, stability_classification="fragile")
        template = _make_template(
            min_stability_score=50,
            allowed_risk_modifiers=["reduce"],
        )
        results = select_strategies([template], investor, rm)
        assert len(results) == 1

    def test_wrong_risk_modifier_excluded(self):
        investor = _make_investor()
        # stable → neutral modifier
        rm = _make_risk_model(stability_score=60, stability_classification="stable")
        template = _make_template(
            min_stability_score=0,
            allowed_risk_modifiers=["allow_growth"],  # requires allow_growth, investor has neutral
        )
        assert select_strategies([template], investor, rm) == []

    def test_correct_risk_modifier_included(self):
        investor = _make_investor()
        rm = _make_risk_model(stability_score=60, stability_classification="stable")
        template = _make_template(
            min_stability_score=0,
            allowed_risk_modifiers=["neutral"],
        )
        results = select_strategies([template], investor, rm)
        assert len(results) == 1

    def test_experience_below_minimum_excluded(self):
        investor = _make_investor(experience_level=ExperienceLevel.beginner)
        rm = _make_risk_model(stability_score=80, stability_classification="strong")
        template = _make_template(
            min_experience_level="advanced",
            allowed_risk_modifiers=["allow_growth"],
            min_stability_score=0,
        )
        assert select_strategies([template], investor, rm) == []

    def test_experience_at_minimum_included(self):
        investor = _make_investor(experience_level=ExperienceLevel.intermediate)
        rm = _make_risk_model(stability_score=60, stability_classification="stable")
        template = _make_template(
            min_experience_level="intermediate",
            allowed_risk_modifiers=["neutral"],
            min_stability_score=0,
        )
        results = select_strategies([template], investor, rm)
        assert len(results) == 1

    def test_investable_capital_below_minimum_excluded(self):
        investor = _make_investor()
        rm = _make_risk_model(
            stability_score=60, stability_classification="stable", investable_capital=4000.0
        )
        template = _make_template(
            min_investable_capital=5000.0,
            allowed_risk_modifiers=["neutral"],
            min_stability_score=0,
        )
        assert select_strategies([template], investor, rm) == []

    def test_investable_capital_at_minimum_included(self):
        investor = _make_investor()
        rm = _make_risk_model(
            stability_score=60, stability_classification="stable", investable_capital=5000.0
        )
        template = _make_template(
            min_investable_capital=5000.0,
            allowed_risk_modifiers=["neutral"],
            min_stability_score=0,
        )
        results = select_strategies([template], investor, rm)
        assert len(results) == 1


class TestFitScore:
    def test_exact_experience_match_scores_higher(self):
        rm = _make_risk_model(stability_score=80, stability_classification="strong")

        beginner_investor = _make_investor(ExperienceLevel.beginner)
        advanced_investor = _make_investor(ExperienceLevel.advanced)

        template = _make_template(
            min_experience_level="beginner",
            allowed_risk_modifiers=["allow_growth"],
            min_stability_score=0,
        )

        score_beginner = _compute_fit_score(template, beginner_investor, rm)
        score_advanced = _compute_fit_score(template, advanced_investor, rm)
        assert score_beginner > score_advanced

    def test_higher_stability_margin_scores_higher(self):
        investor = _make_investor()
        template = _make_template(
            min_stability_score=20,
            allowed_risk_modifiers=["neutral"],
        )

        rm_low_margin = _make_risk_model(stability_score=25, stability_classification="stable")
        rm_high_margin = _make_risk_model(stability_score=70, stability_classification="stable")

        score_low = _compute_fit_score(template, investor, rm_low_margin)
        score_high = _compute_fit_score(template, investor, rm_high_margin)
        assert score_high > score_low

    def test_zero_min_capital_gives_max_capital_points(self):
        investor = _make_investor()
        rm = _make_risk_model(stability_score=60, stability_classification="stable", investable_capital=100.0)
        template = _make_template(min_investable_capital=0.0, allowed_risk_modifiers=["neutral"])
        score = _compute_fit_score(template, investor, rm)
        # capital component should be 30 (max) when min is 0
        assert score >= 30.0

    def test_fit_score_bounded_0_to_100(self):
        investor = _make_investor(ExperienceLevel.beginner)
        rm = _make_risk_model(stability_score=100, stability_classification="strong", investable_capital=1_000_000)
        template = _make_template(
            min_stability_score=0,
            min_experience_level="beginner",
            min_investable_capital=0,
            allowed_risk_modifiers=["allow_growth"],
        )
        score = _compute_fit_score(template, investor, rm)
        assert 0 <= score <= 100


class TestResultOrdering:
    def test_results_sorted_by_fit_score_descending(self):
        investor = _make_investor(ExperienceLevel.advanced)
        rm = _make_risk_model(
            stability_score=80, stability_classification="strong", investable_capital=50000.0
        )

        t1 = _make_template(
            strategy_type=StrategyType.conservative,
            min_stability_score=0,
            min_experience_level="advanced",
            min_investable_capital=0,
            allowed_risk_modifiers=["allow_growth"],
        )
        t2 = _make_template(
            strategy_type=StrategyType.speculative,
            min_stability_score=70,
            min_experience_level="advanced",
            min_investable_capital=25000.0,
            allowed_risk_modifiers=["allow_growth"],
        )
        t3 = _make_template(
            strategy_type=StrategyType.balanced,
            min_stability_score=40,
            min_experience_level="beginner",
            min_investable_capital=5000.0,
            allowed_risk_modifiers=["allow_growth"],
        )

        results = select_strategies([t1, t2, t3], investor, rm)
        assert len(results) == 3
        scores = [r[1] for r in results]
        assert scores == sorted(scores, reverse=True)

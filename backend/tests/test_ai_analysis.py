"""Tests for AI analysis module (pure logic — no DB, no real API calls)."""
from datetime import date, datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.ai_analysis.analyzer import _age_from_dob, build_context, generate_report


def _investor(dob=date(1990, 1, 15), experience="beginner", is_minor=False):
    return SimpleNamespace(
        full_name="Test User",
        date_of_birth=dob,
        country="IL",
        base_currency="ILS",
        experience_level=SimpleNamespace(value=experience),
        is_minor=is_minor,
    )


def _fp(income=10_000, expenses=6_000, savings=30_000, emf=3.0, assets=None, liabilities=None):
    return SimpleNamespace(
        monthly_income=income,
        spouse_income=None,
        monthly_expenses=expenses,
        liquid_savings=savings,
        emergency_fund_months=emf,
        job_stability=SimpleNamespace(value="stable"),
        income_trend=SimpleNamespace(value="growing"),
        dependents_count=1,
        investable_capital_pct=20.0,
        currency="ILS",
        assets=assets or [],
        liabilities=liabilities or [],
    )


def _risk_model(score=65, classification="stable"):
    return SimpleNamespace(
        stability_score=score,
        stability_classification=classification,
        total_net_worth=200_000,
        liquid_capital=50_000,
        investable_capital=10_000,
        currency="ILS",
        low_risk_pct=60.0,
        growth_pct=30.0,
        high_risk_pct=10.0,
        max_drawdown_pct=15.0,
    )


def _goal(name="Retirement", gtype="retirement", target=500_000, current=50_000):
    return SimpleNamespace(
        name=name,
        goal_type=SimpleNamespace(value=gtype),
        target_amount=target,
        current_amount=current,
        progress_pct=round(current / target * 100, 2),
        target_date=date(2045, 1, 1),
        priority=1,
        currency="ILS",
    )


def _backtest(name="Conservative Strategy", period=24, ret=8.5, drawdown=4.2, sharpe=1.1, win_rate=60.0):
    return SimpleNamespace(
        template=SimpleNamespace(name=name),
        period_months=period,
        initial_capital=10_000,
        final_capital=round(10_000 * (1 + ret / 100), 2),
        total_return_pct=ret,
        annualized_return_pct=round((1 + ret / 100) ** (12 / period) - 1, 4) * 100,
        max_drawdown_pct=drawdown,
        sharpe_ratio=sharpe,
        win_rate_pct=win_rate,
        currency="ILS",
    )


def _portfolio(name="Balanced Strategy", ret=5.2, ticks=6):
    return SimpleNamespace(
        template=SimpleNamespace(name=name),
        initial_capital=10_000,
        current_value=round(10_000 * (1 + ret / 100), 2),
        total_return_pct=ret,
        status=SimpleNamespace(value="active"),
        ticks=[object()] * ticks,
        currency="ILS",
    )


class TestAgeFromDob:
    def test_calculates_age(self):
        dob = date(1990, 1, 1)
        age = _age_from_dob(dob)
        assert age >= 35

    def test_birthday_not_yet_this_year(self):
        dob = date(1990, 12, 31)
        age = _age_from_dob(dob)
        today = date.today()
        if today.month < 12 or (today.month == 12 and today.day < 31):
            expected = today.year - 1990 - 1
        else:
            expected = today.year - 1990
        assert age == expected


class TestBuildContext:
    def test_investor_always_present(self):
        ctx = build_context(_investor(), None, None, [], [], [])
        assert "investor" in ctx
        assert ctx["investor"]["country"] == "IL"
        assert ctx["investor"]["base_currency"] == "ILS"
        assert isinstance(ctx["investor"]["age"], int)
        assert ctx["investor"]["age"] > 0

    def test_no_financial_profile_omits_key(self):
        ctx = build_context(_investor(), None, None, [], [], [])
        assert "financial_profile" not in ctx

    def test_financial_profile_included(self):
        fp = _fp(income=10_000, expenses=6_000)
        ctx = build_context(_investor(), fp, None, [], [], [])
        assert "financial_profile" in ctx
        fp_ctx = ctx["financial_profile"]
        assert fp_ctx["monthly_income"] == 10_000
        assert fp_ctx["monthly_surplus"] == 4_000
        assert fp_ctx["savings_rate_pct"] == 40.0

    def test_savings_rate_zero_when_no_income(self):
        fp = _fp(income=0, expenses=0)
        ctx = build_context(_investor(), fp, None, [], [], [])
        assert ctx["financial_profile"]["savings_rate_pct"] == 0.0

    def test_assets_serialized(self):
        asset = SimpleNamespace(
            name="Savings Account",
            asset_type=SimpleNamespace(value="cash"),
            current_value=30_000,
            currency="ILS",
            is_liquid=True,
        )
        fp = _fp(assets=[asset])
        ctx = build_context(_investor(), fp, None, [], [], [])
        assert len(ctx["financial_profile"]["assets"]) == 1
        assert ctx["financial_profile"]["assets"][0]["name"] == "Savings Account"

    def test_liabilities_serialized(self):
        liability = SimpleNamespace(
            name="Mortgage",
            liability_type=SimpleNamespace(value="mortgage"),
            outstanding_balance=250_000,
            monthly_payment=3_000,
            currency="ILS",
        )
        fp = _fp(liabilities=[liability])
        ctx = build_context(_investor(), fp, None, [], [], [])
        assert len(ctx["financial_profile"]["liabilities"]) == 1
        assert ctx["financial_profile"]["liabilities"][0]["outstanding_balance"] == 250_000

    def test_risk_model_included(self):
        rm = _risk_model()
        ctx = build_context(_investor(), None, rm, [], [], [])
        assert "risk_model" in ctx
        assert ctx["risk_model"]["stability_score"] == 65
        assert ctx["risk_model"]["allocation"]["low_risk_pct"] == 60.0

    def test_no_risk_model_omits_key(self):
        ctx = build_context(_investor(), None, None, [], [], [])
        assert "risk_model" not in ctx

    def test_goals_included(self):
        goals = [_goal("Retirement"), _goal("Education", "child_education")]
        ctx = build_context(_investor(), None, None, goals, [], [])
        assert "goals" in ctx
        assert len(ctx["goals"]) == 2
        assert ctx["goals"][0]["name"] == "Retirement"

    def test_empty_goals_omits_key(self):
        ctx = build_context(_investor(), None, None, [], [], [])
        assert "goals" not in ctx

    def test_backtest_runs_included(self):
        runs = [_backtest()]
        ctx = build_context(_investor(), None, None, [], runs, [])
        assert "backtest_runs" in ctx
        assert ctx["backtest_runs"][0]["total_return_pct"] == 8.5

    def test_backtest_capped_at_three(self):
        runs = [_backtest(name=f"Strategy {i}") for i in range(6)]
        ctx = build_context(_investor(), None, None, [], runs, [])
        assert len(ctx["backtest_runs"]) == 3

    def test_empty_backtests_omits_key(self):
        ctx = build_context(_investor(), None, None, [], [], [])
        assert "backtest_runs" not in ctx

    def test_paper_portfolios_included(self):
        portfolios = [_portfolio()]
        ctx = build_context(_investor(), None, None, [], [], portfolios)
        assert "paper_portfolios" in ctx
        assert ctx["paper_portfolios"][0]["months_simulated"] == 6

    def test_paper_portfolios_capped_at_three(self):
        portfolios = [_portfolio(name=f"Portfolio {i}") for i in range(5)]
        ctx = build_context(_investor(), None, None, [], [], portfolios)
        assert len(ctx["paper_portfolios"]) == 3

    def test_empty_portfolios_omits_key(self):
        ctx = build_context(_investor(), None, None, [], [], [])
        assert "paper_portfolios" not in ctx

    def test_minor_flag_propagated(self):
        ctx = build_context(_investor(is_minor=True), None, None, [], [], [])
        assert ctx["investor"]["is_minor"] is True

    def test_full_context_has_all_sections(self):
        fp = _fp()
        rm = _risk_model()
        goals = [_goal()]
        runs = [_backtest()]
        portfolios = [_portfolio()]
        ctx = build_context(_investor(), fp, rm, goals, runs, portfolios)
        for key in ("investor", "financial_profile", "risk_model", "goals", "backtest_runs", "paper_portfolios"):
            assert key in ctx


class TestGenerateReport:
    def test_calls_anthropic_and_parses_json(self):
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text='{"summary":"ok","financial_health":"good","risk_profile":"low","strategy_analysis":"balanced","backtest_insights":"N/A","paper_trading_performance":"N/A","recommendations":"save more"}')]

        with patch("app.ai_analysis.analyzer.anthropic.Anthropic") as mock_cls:
            mock_cls.return_value.messages.create.return_value = mock_response
            result = generate_report({"investor": {"age": 35}}, api_key="test-key")

        assert result["summary"] == "ok"
        assert result["financial_health"] == "good"
        assert "recommendations" in result

    def test_strips_markdown_code_fences(self):
        raw = '```json\n{"summary":"s","financial_health":"h","risk_profile":"r","strategy_analysis":"a","backtest_insights":"b","paper_trading_performance":"p","recommendations":"rec"}\n```'
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text=raw)]

        with patch("app.ai_analysis.analyzer.anthropic.Anthropic") as mock_cls:
            mock_cls.return_value.messages.create.return_value = mock_response
            result = generate_report({}, api_key="test-key")

        assert result["summary"] == "s"

    def test_returns_fallback_on_invalid_json(self):
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="not valid json at all")]

        with patch("app.ai_analysis.analyzer.anthropic.Anthropic") as mock_cls:
            mock_cls.return_value.messages.create.return_value = mock_response
            result = generate_report({}, api_key="test-key")

        assert "summary" in result
        assert "recommendations" in result

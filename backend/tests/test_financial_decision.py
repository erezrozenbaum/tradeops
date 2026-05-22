from types import SimpleNamespace


from app.financial_decision.engine import evaluate


def make_investor(**overrides):
    defaults = dict(is_minor=False, investment_goal=None)
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def make_fp(**overrides):
    defaults = dict(
        monthly_income=10_000,
        monthly_expenses=6_000,
        emergency_fund_months=4,
        liquid_savings=40_000,
        investable_capital_pct=20,
        assets=[SimpleNamespace(current_value=100_000, is_liquid=True)],
        liabilities=[],
        currency="USD",
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def make_risk_model(**overrides):
    defaults = dict(
        age_tier="adult",
        stability_score=72,
        investable_capital=28_000,
        high_risk_pct=10.0,
        live_trading_allowed=True,
        blocked_strategy_families=[],
        requires_paper_trading=False,
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


# ── Test cases ────────────────────────────────────────────────────────────────


class TestNoFinancialProfile:
    def test_no_fp_returns_not_ready(self):
        decision = evaluate(make_investor(), financial_profile=None, risk_model=None, goals=[])
        assert decision.can_invest is False
        assert decision.readiness_classification == "not_ready"
        assert "complete_financial_profile" in decision.required_actions


class TestLowStability:
    def test_stability_below_30_cannot_invest(self):
        rm = make_risk_model(stability_score=20)
        decision = evaluate(make_investor(), make_fp(emergency_fund_months=2), rm, goals=[])
        assert decision.can_invest is False
        assert decision.readiness_classification == "not_ready"
        assert "improve_financial_stability" in decision.required_actions

    def test_no_emergency_fund_cannot_invest(self):
        rm = make_risk_model(stability_score=55)
        decision = evaluate(make_investor(), make_fp(emergency_fund_months=0), rm, goals=[])
        assert decision.can_invest is False
        assert decision.readiness_classification == "not_ready"
        assert "build_emergency_fund" in decision.required_actions


class TestMinorInvestor:
    def test_minor_flag_yields_education_only(self):
        decision = evaluate(make_investor(is_minor=True), make_fp(), make_risk_model(), goals=[])
        assert decision.can_invest is True
        assert decision.readiness_classification == "education_only"
        assert "live_trading" in decision.blocked_actions

    def test_minor_age_tier_yields_education_only(self):
        rm = make_risk_model(age_tier="minor")
        decision = evaluate(make_investor(), make_fp(), rm, goals=[])
        assert decision.can_invest is True
        assert decision.readiness_classification == "education_only"

    def test_education_goal_yields_education_only(self):
        decision = evaluate(
            make_investor(investment_goal="education"), make_fp(), make_risk_model(), goals=[]
        )
        assert decision.can_invest is True
        assert decision.readiness_classification == "education_only"


class TestReadyInvestor:
    def test_strong_profile_is_ready(self):
        rm = make_risk_model(
            stability_score=80,
            live_trading_allowed=True,
            requires_paper_trading=False,
            blocked_strategy_families=[],
        )
        fp = make_fp(emergency_fund_months=6, liabilities=[])
        decision = evaluate(make_investor(), fp, rm, goals=[])
        assert decision.can_invest is True
        assert decision.readiness_classification == "ready"
        assert "live_trading" not in decision.blocked_actions

    def test_recommended_pct_is_positive(self):
        decision = evaluate(make_investor(), make_fp(), make_risk_model(), goals=[])
        assert decision.recommended_investment_pct > 0


class TestReadyWithLimits:
    def test_moderate_stability_is_ready_with_limits(self):
        rm = make_risk_model(stability_score=45)
        fp = make_fp(emergency_fund_months=4)
        decision = evaluate(make_investor(), fp, rm, goals=[])
        assert decision.can_invest is True
        assert decision.readiness_classification == "ready_with_limits"

    def test_high_debt_ratio_is_ready_with_limits(self):
        rm = make_risk_model(stability_score=70)
        # monthly debt = 5000 on income 10000 = 50% → above 40% threshold
        liabilities = [SimpleNamespace(outstanding_balance=50_000, monthly_payment=5_000)]
        fp = make_fp(liabilities=liabilities, emergency_fund_months=4)
        decision = evaluate(make_investor(), fp, rm, goals=[])
        assert decision.can_invest is True
        assert decision.readiness_classification == "ready_with_limits"
        assert "reduce_debt" in decision.required_actions
        assert any("debt" in w.lower() for w in decision.warnings)

    def test_low_emergency_fund_is_ready_with_limits(self):
        rm = make_risk_model(stability_score=70)
        fp = make_fp(emergency_fund_months=1.5)
        decision = evaluate(make_investor(), fp, rm, goals=[])
        assert decision.can_invest is True
        assert decision.readiness_classification == "ready_with_limits"
        assert "grow_emergency_fund" in decision.required_actions


class TestEnforcementFields:
    def test_live_trading_blocked_appears_in_blocked_actions(self):
        rm = make_risk_model(stability_score=80, live_trading_allowed=False)
        decision = evaluate(make_investor(), make_fp(), rm, goals=[])
        assert "live_trading" in decision.blocked_actions

    def test_paper_trading_required_appears_in_required_actions(self):
        rm = make_risk_model(stability_score=80, requires_paper_trading=True)
        fp = make_fp(emergency_fund_months=6)
        decision = evaluate(make_investor(), fp, rm, goals=[])
        assert "complete_paper_trading_first" in decision.required_actions

    def test_aggressive_blocked_family_appears_in_blocked_actions(self):
        rm = make_risk_model(
            stability_score=80,
            blocked_strategy_families=["aggressive"],
            live_trading_allowed=True,
            requires_paper_trading=False,
        )
        fp = make_fp(emergency_fund_months=6)
        decision = evaluate(make_investor(), fp, rm, goals=[])
        assert "aggressive_strategies" in decision.blocked_actions

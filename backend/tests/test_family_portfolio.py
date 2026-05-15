"""Tests for family portfolio aggregation (pure logic — no DB)."""
import uuid
from types import SimpleNamespace

import pytest

from app.family_portfolio.engine import generation_for, is_minor, build_family_summary
from app.family_portfolio.schemas import FamilyPortfolioSummary


# ── Helpers ───────────────────────────────────────────────────────────────────

def _member(*, name, rel, age=None, is_primary=False, mid=None):
    return SimpleNamespace(
        id=mid or uuid.uuid4(),
        name=name,
        relationship_type=rel,
        age=age,
        is_primary=is_primary,
        individual_risk_tolerance=None,
        investor_profile_id=None,
    )


def _family(*, members, fid=None, investor_id=None):
    return SimpleNamespace(
        id=fid or uuid.uuid4(),
        name="Test Family",
        primary_investor_id=investor_id or uuid.uuid4(),
        base_currency="USD",
        members=members,
    )


def _holding(*, name, ticker=None, asset_type="stock", current_value_base=10_000.0,
             unrealized_pnl=1_000.0, hid=None):
    return SimpleNamespace(
        id=hid or uuid.uuid4(),
        name=name,
        ticker=ticker,
        asset_type=asset_type,
        current_value_base=current_value_base,
        unrealized_pnl=unrealized_pnl,
        live_price=None,
    )


def _account(holdings, *, aid=None, provider_name="Broker", account_name="Main",
             account_type="brokerage", currency="USD"):
    total_val = sum(h.current_value_base for h in holdings)
    total_pnl = sum(h.unrealized_pnl for h in holdings)
    cost = total_val - total_pnl
    return SimpleNamespace(
        id=aid or uuid.uuid4(),
        provider_name=provider_name,
        account_name=account_name,
        account_type=account_type,
        currency=currency,
        total_current_value=total_val,
        total_cost_basis=cost,
        unrealized_pnl=total_pnl,
        unrealized_pnl_pct=round(total_pnl / cost * 100 if cost else 0, 2),
        holdings=holdings,
    )


def _portfolio(accounts, *, currency="USD"):
    total_val = sum(a.total_current_value for a in accounts)
    total_cost = sum(a.total_cost_basis for a in accounts)
    total_pnl = sum(a.unrealized_pnl for a in accounts)
    return SimpleNamespace(
        base_currency=currency,
        total_current_value=total_val,
        total_cost_basis=total_cost,
        unrealized_pnl=total_pnl,
        accounts=accounts,
    )


# ── generation_for ────────────────────────────────────────────────────────────

class TestGenerationFor:
    def test_self_maps_to_primary(self):
        assert generation_for("self") == "primary"

    def test_spouse_maps_to_partners(self):
        assert generation_for("spouse") == "partners"

    def test_partner_maps_to_partners(self):
        assert generation_for("partner") == "partners"

    def test_child_maps_to_children(self):
        assert generation_for("child") == "children"

    def test_son_maps_to_children(self):
        assert generation_for("son") == "children"

    def test_daughter_maps_to_children(self):
        assert generation_for("daughter") == "children"

    def test_parent_maps_to_parents(self):
        assert generation_for("parent") == "parents"

    def test_grandparent_maps_to_grandparents(self):
        assert generation_for("grandparent") == "grandparents"

    def test_sibling_maps_to_siblings(self):
        assert generation_for("sibling") == "siblings"

    def test_unknown_maps_to_other(self):
        assert generation_for("cousin") == "other"
        assert generation_for("") == "other"


# ── is_minor ──────────────────────────────────────────────────────────────────

class TestIsMinor:
    def test_age_below_18_is_minor(self):
        assert is_minor(17) is True
        assert is_minor(0) is True

    def test_age_18_is_not_minor(self):
        assert is_minor(18) is False

    def test_age_above_18_is_not_minor(self):
        assert is_minor(35) is False

    def test_none_age_is_not_minor(self):
        assert is_minor(None) is False


# ── build_family_summary ──────────────────────────────────────────────────────

class TestBuildFamilySummary:

    def test_primary_only_no_attributed_accounts(self):
        """All accounts unattributed (family_member_id=None) → single primary bucket."""
        member_id = uuid.uuid4()
        primary = _member(name="Alice", rel="self", is_primary=True, mid=member_id)
        family = _family(members=[primary])

        acc_id = uuid.uuid4()
        acc = _account(
            [_holding(name="VTI", ticker="VTI", current_value_base=50_000.0, unrealized_pnl=5_000.0)],
            aid=acc_id,
        )
        portfolio = _portfolio([acc])
        acct_map = {str(acc_id): None}

        result = build_family_summary(family, portfolio, acct_map)

        assert isinstance(result, FamilyPortfolioSummary)
        assert result.total_current_value == 50_000.0
        assert len(result.members) == 1
        assert result.members[0].total_current_value == 50_000.0

    def test_generation_grouping(self):
        """spouse account → 'partners', child account → 'children' in by_generation."""
        spouse_mid = uuid.uuid4()
        child_mid = uuid.uuid4()
        spouse = _member(name="Bob", rel="spouse", mid=spouse_mid)
        child = _member(name="Charlie", rel="child", age=10, mid=child_mid)
        family = _family(members=[spouse, child])

        acc1_id = uuid.uuid4()
        acc2_id = uuid.uuid4()
        acc1 = _account(
            [_holding(name="VTI", current_value_base=100_000.0, unrealized_pnl=10_000.0)],
            aid=acc1_id,
        )
        acc2 = _account(
            [_holding(name="VOO", current_value_base=30_000.0, unrealized_pnl=3_000.0)],
            aid=acc2_id,
        )
        portfolio = _portfolio([acc1, acc2])
        acct_map = {str(acc1_id): spouse_mid, str(acc2_id): child_mid}

        result = build_family_summary(family, portfolio, acct_map)

        assert "partners" in result.by_generation
        assert "children" in result.by_generation
        assert result.by_generation["partners"] == pytest.approx(100_000.0)
        assert result.by_generation["children"] == pytest.approx(30_000.0)

    def test_minor_member_gets_education_mode(self):
        child_mid = uuid.uuid4()
        child = _member(name="Kid", rel="child", age=10, mid=child_mid)
        family = _family(members=[child])

        acc_id = uuid.uuid4()
        acc = _account(
            [_holding(name="AAPL", current_value_base=5_000.0, unrealized_pnl=500.0)],
            aid=acc_id,
        )
        portfolio = _portfolio([acc])
        acct_map = {str(acc_id): child_mid}

        result = build_family_summary(family, portfolio, acct_map)

        kid = next(m for m in result.members if m.member_name == "Kid")
        assert kid.is_minor is True
        assert kid.education_mode is True

    def test_adult_member_no_education_mode(self):
        adult_mid = uuid.uuid4()
        adult = _member(name="Adult", rel="spouse", age=35, mid=adult_mid)
        family = _family(members=[adult])

        acc_id = uuid.uuid4()
        acc = _account(
            [_holding(name="VTI", current_value_base=80_000.0, unrealized_pnl=8_000.0)],
            aid=acc_id,
        )
        portfolio = _portfolio([acc])
        acct_map = {str(acc_id): adult_mid}

        result = build_family_summary(family, portfolio, acct_map)

        assert result.members[0].education_mode is False

    def test_has_minors_true_when_minor_member(self):
        child_mid = uuid.uuid4()
        child = _member(name="Kid", rel="child", age=8, mid=child_mid)
        family = _family(members=[child])

        acc_id = uuid.uuid4()
        acc = _account(
            [_holding(name="VTI", current_value_base=1_000.0, unrealized_pnl=100.0)],
            aid=acc_id,
        )
        portfolio = _portfolio([acc])
        acct_map = {str(acc_id): child_mid}

        result = build_family_summary(family, portfolio, acct_map)
        assert result.has_minors is True

    def test_has_minors_false_when_all_adults(self):
        adult_mid = uuid.uuid4()
        adult = _member(name="Adult", rel="spouse", age=40, mid=adult_mid)
        family = _family(members=[adult])

        acc_id = uuid.uuid4()
        acc = _account(
            [_holding(name="VTI", current_value_base=100_000.0, unrealized_pnl=10_000.0)],
            aid=acc_id,
        )
        portfolio = _portfolio([acc])
        acct_map = {str(acc_id): adult_mid}

        result = build_family_summary(family, portfolio, acct_map)
        assert result.has_minors is False

    def test_cross_member_overlap_detected(self):
        """Two members holding the same ticker → appears in cross_member_overlap."""
        mid1 = uuid.uuid4()
        mid2 = uuid.uuid4()
        m1 = _member(name="Alice", rel="self", mid=mid1)
        m2 = _member(name="Bob", rel="spouse", mid=mid2)
        family = _family(members=[m1, m2])

        acc1_id = uuid.uuid4()
        acc2_id = uuid.uuid4()
        acc1 = _account(
            [_holding(name="Apple", ticker="AAPL", current_value_base=10_000.0, unrealized_pnl=1_000.0)],
            aid=acc1_id,
        )
        acc2 = _account(
            [_holding(name="Apple", ticker="AAPL", current_value_base=5_000.0, unrealized_pnl=500.0)],
            aid=acc2_id,
        )
        portfolio = _portfolio([acc1, acc2])
        acct_map = {str(acc1_id): mid1, str(acc2_id): mid2}

        result = build_family_summary(family, portfolio, acct_map)

        assert len(result.cross_member_overlap) == 1
        overlap = result.cross_member_overlap[0]
        assert overlap.ticker == "AAPL"
        assert overlap.combined_value == pytest.approx(15_000.0)
        assert len(overlap.member_names) == 2

    def test_no_overlap_when_different_tickers(self):
        mid1 = uuid.uuid4()
        mid2 = uuid.uuid4()
        m1 = _member(name="Alice", rel="self", mid=mid1)
        m2 = _member(name="Bob", rel="spouse", mid=mid2)
        family = _family(members=[m1, m2])

        acc1_id = uuid.uuid4()
        acc2_id = uuid.uuid4()
        acc1 = _account(
            [_holding(name="Apple", ticker="AAPL", current_value_base=10_000.0, unrealized_pnl=1_000.0)],
            aid=acc1_id,
        )
        acc2 = _account(
            [_holding(name="Google", ticker="GOOGL", current_value_base=8_000.0, unrealized_pnl=800.0)],
            aid=acc2_id,
        )
        portfolio = _portfolio([acc1, acc2])
        acct_map = {str(acc1_id): mid1, str(acc2_id): mid2}

        result = build_family_summary(family, portfolio, acct_map)
        assert len(result.cross_member_overlap) == 0

    def test_household_asset_allocation_sums_all_members(self):
        mid1 = uuid.uuid4()
        mid2 = uuid.uuid4()
        m1 = _member(name="Alice", rel="self", mid=mid1)
        m2 = _member(name="Bob", rel="spouse", mid=mid2)
        family = _family(members=[m1, m2])

        acc1_id = uuid.uuid4()
        acc2_id = uuid.uuid4()
        acc1 = _account(
            [_holding(name="VTI", ticker="VTI", asset_type="etf",
                      current_value_base=60_000.0, unrealized_pnl=6_000.0)],
            aid=acc1_id,
        )
        acc2 = _account(
            [_holding(name="AGG", ticker="AGG", asset_type="bond",
                      current_value_base=40_000.0, unrealized_pnl=4_000.0)],
            aid=acc2_id,
        )
        portfolio = _portfolio([acc1, acc2])
        acct_map = {str(acc1_id): mid1, str(acc2_id): mid2}

        result = build_family_summary(family, portfolio, acct_map)

        assert result.household_asset_allocation.get("etf", 0) == pytest.approx(60_000.0)
        assert result.household_asset_allocation.get("bond", 0) == pytest.approx(40_000.0)

    def test_unrealized_pnl_pct_calculation(self):
        mid = uuid.uuid4()
        m = _member(name="Alice", rel="self", mid=mid)
        family = _family(members=[m])

        acc_id = uuid.uuid4()
        # cost = 80_000, value = 100_000, pnl = 20_000 → pnl_pct = 25%
        h = _holding(name="VTI", current_value_base=100_000.0, unrealized_pnl=20_000.0)
        acc = _account([h], aid=acc_id)
        acc.total_cost_basis = 80_000.0
        portfolio = _portfolio([acc])
        portfolio.total_cost_basis = 80_000.0
        portfolio.unrealized_pnl = 20_000.0
        acct_map = {str(acc_id): mid}

        result = build_family_summary(family, portfolio, acct_map)
        assert result.total_unrealized_pnl_pct == pytest.approx(25.0, rel=1e-2)

    def test_member_count_from_family_members_list(self):
        """member_count reflects family.members, even if some have no accounts."""
        mid1 = uuid.uuid4()
        mid2 = uuid.uuid4()
        m1 = _member(name="Alice", rel="self", mid=mid1)
        m2 = _member(name="Bob", rel="spouse", mid=mid2)  # no accounts
        family = _family(members=[m1, m2])

        acc_id = uuid.uuid4()
        acc = _account(
            [_holding(name="VTI", current_value_base=50_000.0, unrealized_pnl=5_000.0)],
            aid=acc_id,
        )
        portfolio = _portfolio([acc])
        acct_map = {str(acc_id): mid1}

        result = build_family_summary(family, portfolio, acct_map)
        assert result.member_count == 2

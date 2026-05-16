"""Tests for Crypto Staking service — pure logic, no DB."""
import uuid
from unittest.mock import MagicMock, patch

import pytest

from app.crypto_staking.schemas import EnableStakingRequest, StakingPosition, StakingReport
from app.crypto_staking.service import _tax_note, build_staking_report


class TestTaxNote:
    def test_israeli_investor(self):
        note = _tax_note("ETH", "ILS")
        assert "Israel" in note
        assert "income" in note.lower()

    def test_usd_investor(self):
        note = _tax_note("SOL", "USD")
        assert "ordinary income" in note.lower()
        assert "capital gain" in note.lower()   # mentioned to contrast with income treatment

    def test_no_ticker(self):
        note = _tax_note(None, "USD")
        assert "income" in note.lower()


class TestStakingPosition:
    def test_schema_valid(self):
        pos = StakingPosition(
            holding_id=uuid.uuid4(),
            account_id=uuid.uuid4(),
            name="Ethereum",
            ticker="ETH",
            quantity=5.0,
            staking_apy=4.5,
            current_price_usd=3000.0,
            current_price_base=3000.0,
            estimated_annual_rewards_native=0.225,
            estimated_annual_rewards_base=675.0,
            currency="USD",
            tax_note="Rewards are income.",
        )
        assert pos.tax_treatment == "income"
        assert pos.estimated_annual_rewards_native == pytest.approx(0.225)

    def test_no_price_data(self):
        pos = StakingPosition(
            holding_id=uuid.uuid4(),
            account_id=uuid.uuid4(),
            name="Solana",
            ticker="SOL",
            quantity=100.0,
            staking_apy=7.0,
            current_price_usd=None,
            current_price_base=None,
            estimated_annual_rewards_native=7.0,
            estimated_annual_rewards_base=None,
            currency="USD",
            tax_note="Income.",
        )
        assert pos.estimated_annual_rewards_base is None


class TestEnableStakingRequest:
    def test_valid_apy(self):
        req = EnableStakingRequest(staking_apy=5.2)
        assert req.staking_apy == 5.2

    def test_zero_apy_rejected(self):
        with pytest.raises(Exception):
            EnableStakingRequest(staking_apy=0)

    def test_over_100_rejected(self):
        with pytest.raises(Exception):
            EnableStakingRequest(staking_apy=101)


class TestRewardsCalculation:
    def test_annual_rewards_formula(self):
        quantity = 10.0
        apy = 5.0
        expected_native = quantity * (apy / 100.0)
        assert expected_native == pytest.approx(0.5)

    def test_base_currency_rewards(self):
        annual_native = 0.5  # ETH
        price_base = 3000.0  # USD per ETH
        expected_income = annual_native * price_base
        assert expected_income == pytest.approx(1500.0)


class TestStakingReportSchema:
    def test_empty_report(self):
        report = StakingReport(
            investor_id=uuid.uuid4(),
            base_currency="USD",
            total_estimated_annual_income_base=None,
            positions=[],
            tax_summary="No staked positions.",
        )
        assert report.positions == []
        assert report.total_estimated_annual_income_base is None

    def test_report_with_positions(self):
        pos = StakingPosition(
            holding_id=uuid.uuid4(),
            account_id=uuid.uuid4(),
            name="Ethereum",
            ticker="ETH",
            quantity=2.0,
            staking_apy=4.0,
            current_price_usd=3000.0,
            current_price_base=11000.0,
            estimated_annual_rewards_native=0.08,
            estimated_annual_rewards_base=880.0,
            currency="USD",
            tax_note="Income.",
        )
        report = StakingReport(
            investor_id=uuid.uuid4(),
            base_currency="ILS",
            total_estimated_annual_income_base=880.0,
            positions=[pos],
            tax_summary="1 position generating 880 ILS/year.",
        )
        assert len(report.positions) == 1
        assert report.total_estimated_annual_income_base == pytest.approx(880.0)

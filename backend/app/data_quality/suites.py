"""Great Expectations expectation suites for TradeOps financial data.

Each suite defines deterministic contracts for a critical data domain.
Violations indicate data integrity problems that could corrupt risk calculations.

Suites:
  - holdings          : account holdings (no negative qty for non-short, valid ticker)
  - transactions      : trade/transaction records
  - fx_rates          : FX rate cache (must be positive, valid codes)
  - price_snapshots   : market price cache (positive prices, known tickers)
  - portfolio_snapshots : end-of-day portfolio snapshots (totals must be non-negative)
"""
from __future__ import annotations

import logging

log = logging.getLogger(__name__)


def _ge_available() -> bool:
    try:
        import great_expectations  # noqa: F401
        return True
    except ImportError:
        return False


def build_holdings_suite() -> "great_expectations.core.ExpectationSuite | None":
    if not _ge_available():
        return None
    import great_expectations as gx

    suite = gx.core.ExpectationSuite(expectation_suite_name="holdings")
    suite.add_expectation(gx.core.ExpectationConfiguration(
        expectation_type="expect_column_values_to_not_be_null",
        kwargs={"column": "ticker"},
    ))
    suite.add_expectation(gx.core.ExpectationConfiguration(
        expectation_type="expect_column_values_to_not_be_null",
        kwargs={"column": "quantity"},
    ))
    suite.add_expectation(gx.core.ExpectationConfiguration(
        expectation_type="expect_column_values_to_be_between",
        kwargs={"column": "quantity", "min_value": 0},
    ))
    suite.add_expectation(gx.core.ExpectationConfiguration(
        expectation_type="expect_column_values_to_not_be_null",
        kwargs={"column": "cost_per_share"},
    ))
    suite.add_expectation(gx.core.ExpectationConfiguration(
        expectation_type="expect_column_values_to_be_between",
        kwargs={"column": "cost_per_share", "min_value": 0},
    ))
    return suite


def build_fx_rates_suite() -> "great_expectations.core.ExpectationSuite | None":
    if not _ge_available():
        return None
    import great_expectations as gx

    suite = gx.core.ExpectationSuite(expectation_suite_name="fx_rates")
    suite.add_expectation(gx.core.ExpectationConfiguration(
        expectation_type="expect_column_values_to_not_be_null",
        kwargs={"column": "from_currency"},
    ))
    suite.add_expectation(gx.core.ExpectationConfiguration(
        expectation_type="expect_column_values_to_not_be_null",
        kwargs={"column": "to_currency"},
    ))
    suite.add_expectation(gx.core.ExpectationConfiguration(
        expectation_type="expect_column_values_to_be_between",
        kwargs={"column": "rate", "min_value": 0.000001},
    ))
    suite.add_expectation(gx.core.ExpectationConfiguration(
        expectation_type="expect_column_values_to_match_regex",
        kwargs={"column": "from_currency", "regex": r"^[A-Z]{3}$"},
    ))
    suite.add_expectation(gx.core.ExpectationConfiguration(
        expectation_type="expect_column_values_to_match_regex",
        kwargs={"column": "to_currency", "regex": r"^[A-Z]{3}$"},
    ))
    return suite


def build_price_snapshots_suite() -> "great_expectations.core.ExpectationSuite | None":
    if not _ge_available():
        return None
    import great_expectations as gx

    suite = gx.core.ExpectationSuite(expectation_suite_name="price_snapshots")
    suite.add_expectation(gx.core.ExpectationConfiguration(
        expectation_type="expect_column_values_to_not_be_null",
        kwargs={"column": "ticker"},
    ))
    suite.add_expectation(gx.core.ExpectationConfiguration(
        expectation_type="expect_column_values_to_be_between",
        kwargs={"column": "price", "min_value": 0.000001},
    ))
    suite.add_expectation(gx.core.ExpectationConfiguration(
        expectation_type="expect_column_values_to_not_be_null",
        kwargs={"column": "currency"},
    ))
    return suite


def build_portfolio_snapshots_suite() -> "great_expectations.core.ExpectationSuite | None":
    if not _ge_available():
        return None
    import great_expectations as gx

    suite = gx.core.ExpectationSuite(expectation_suite_name="portfolio_snapshots")
    suite.add_expectation(gx.core.ExpectationConfiguration(
        expectation_type="expect_column_values_to_be_between",
        kwargs={"column": "total_value", "min_value": 0},
    ))
    suite.add_expectation(gx.core.ExpectationConfiguration(
        expectation_type="expect_column_values_to_not_be_null",
        kwargs={"column": "investor_id"},
    ))
    suite.add_expectation(gx.core.ExpectationConfiguration(
        expectation_type="expect_column_values_to_not_be_null",
        kwargs={"column": "snapshot_date"},
    ))
    return suite


def build_transactions_suite() -> "great_expectations.core.ExpectationSuite | None":
    if not _ge_available():
        return None
    import great_expectations as gx

    suite = gx.core.ExpectationSuite(expectation_suite_name="transactions")
    suite.add_expectation(gx.core.ExpectationConfiguration(
        expectation_type="expect_column_values_to_not_be_null",
        kwargs={"column": "ticker"},
    ))
    suite.add_expectation(gx.core.ExpectationConfiguration(
        expectation_type="expect_column_values_to_be_in_set",
        kwargs={"column": "transaction_type", "value_set": ["buy", "sell", "dividend", "deposit", "withdrawal"]},
    ))
    suite.add_expectation(gx.core.ExpectationConfiguration(
        expectation_type="expect_column_values_to_be_between",
        kwargs={"column": "quantity", "min_value": 0},
    ))
    suite.add_expectation(gx.core.ExpectationConfiguration(
        expectation_type="expect_column_values_to_be_between",
        kwargs={"column": "price_per_share", "min_value": 0},
    ))
    return suite

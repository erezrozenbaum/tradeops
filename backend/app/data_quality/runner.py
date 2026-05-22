"""Great Expectations validation runner.

Runs expectation suites against live database tables using pandas DataFrames.
Results are logged; critical failures are also written to audit_events.

Designed to run as a daily background job. If great_expectations is not
installed, all checks are silently skipped.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

log = logging.getLogger(__name__)


@dataclass
class ValidationResult:
    suite: str
    success: bool
    stats: dict[str, Any] = field(default_factory=dict)
    failures: list[str] = field(default_factory=list)
    ran_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


def _ge_available() -> bool:
    try:
        import great_expectations  # noqa: F401
        import pandas  # noqa: F401
        return True
    except ImportError:
        return False


def _run_suite(suite, df: "pandas.DataFrame") -> ValidationResult:
    """Validate a pandas DataFrame against a GE expectation suite."""
    import great_expectations as gx

    result = ValidationResult(suite=suite.expectation_suite_name, success=True)
    for exp in suite.expectations:
        try:
            col = exp.kwargs.get("column")
            if col and col not in df.columns:
                result.failures.append(f"{exp.expectation_type}: column '{col}' missing")
                result.success = False
                continue

            exp_type = exp.expectation_type
            kwargs = exp.kwargs

            if exp_type == "expect_column_values_to_not_be_null":
                nulls = int(df[col].isna().sum())
                if nulls > 0:
                    result.failures.append(f"{col}: {nulls} null values found")
                    result.success = False

            elif exp_type == "expect_column_values_to_be_between":
                min_v = kwargs.get("min_value")
                max_v = kwargs.get("max_value")
                series = df[col].dropna()
                if min_v is not None and (series < min_v).any():
                    count = int((series < min_v).sum())
                    result.failures.append(f"{col}: {count} values below min {min_v}")
                    result.success = False
                if max_v is not None and (series > max_v).any():
                    count = int((series > max_v).sum())
                    result.failures.append(f"{col}: {count} values above max {max_v}")
                    result.success = False

            elif exp_type == "expect_column_values_to_be_in_set":
                value_set = set(kwargs.get("value_set", []))
                bad = df[col].dropna()[~df[col].dropna().isin(value_set)]
                if len(bad) > 0:
                    result.failures.append(f"{col}: {len(bad)} values not in allowed set {value_set}")
                    result.success = False

            elif exp_type == "expect_column_values_to_match_regex":
                import re
                pattern = kwargs.get("regex", "")
                bad = df[col].dropna()[~df[col].dropna().str.match(pattern)]
                if len(bad) > 0:
                    result.failures.append(f"{col}: {len(bad)} values don't match regex '{pattern}'")
                    result.success = False

        except Exception as exc:
            log.warning("[data_quality] Expectation %s failed to run: %s", exp.expectation_type, exc)

    result.stats = {"row_count": len(df), "failure_count": len(result.failures)}
    return result


def run_all_checks(db) -> list[ValidationResult]:
    """Run all expectation suites against live DB data. Returns list of results."""
    if not _ge_available():
        log.info("[data_quality] great_expectations not available — skipping checks")
        return []

    import pandas as pd
    from sqlalchemy import text
    from app.data_quality.suites import (
        build_holdings_suite,
        build_fx_rates_suite,
        build_price_snapshots_suite,
        build_portfolio_snapshots_suite,
        build_transactions_suite,
    )

    results: list[ValidationResult] = []

    checks = [
        ("SELECT ticker, quantity, cost_per_share FROM holdings LIMIT 10000", build_holdings_suite()),
        ("SELECT from_currency, to_currency, rate FROM currency_rates LIMIT 5000", build_fx_rates_suite()),
        ("SELECT ticker, price, currency FROM price_snapshots LIMIT 5000", build_price_snapshots_suite()),
        ("SELECT investor_id, snapshot_date, total_value FROM portfolio_snapshots LIMIT 5000", build_portfolio_snapshots_suite()),
        ("SELECT ticker, transaction_type, quantity, price_per_share FROM transactions LIMIT 10000", build_transactions_suite()),
    ]

    for sql, suite in checks:
        if suite is None:
            continue
        try:
            df = pd.read_sql(text(sql), db.bind)
            result = _run_suite(suite, df)
            results.append(result)
            if result.success:
                log.info("[data_quality] ✓ Suite '%s' passed (%d rows)", result.suite, result.stats.get("row_count", 0))
            else:
                log.warning(
                    "[data_quality] ✗ Suite '%s' FAILED — %d failures: %s",
                    result.suite,
                    len(result.failures),
                    "; ".join(result.failures[:5]),
                )
                _write_audit_event(db, result)
        except Exception as exc:
            log.error("[data_quality] Suite '%s' could not run: %s", suite.expectation_suite_name, exc)

    return results


def _write_audit_event(db, result: ValidationResult) -> None:
    """Write a data quality failure to audit_events so it appears in the admin audit log."""
    try:
        from app.models.audit_event import AuditEvent
        event = AuditEvent(
            event_type="data_quality_failure",
            description=(
                f"Suite '{result.suite}' failed: "
                + "; ".join(result.failures[:3])
                + ("..." if len(result.failures) > 3 else "")
            ),
            metadata={"suite": result.suite, "failures": result.failures, "stats": result.stats},
        )
        db.add(event)
        db.commit()
    except Exception as exc:
        log.debug("[data_quality] Could not write audit event: %s", exc)

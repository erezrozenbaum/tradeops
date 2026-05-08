"""Tax rules service — resolves tax context for an investor."""
from app.tax_rules.rules import get_rules, get_summary_text


def get_tax_context_for_investor(investor) -> dict:
    """Return structured tax context and AI-ready text for the investor's tax residency.

    Falls back to country if tax_residency is not set.
    """
    country_code = (
        getattr(investor, "tax_residency", None)
        or getattr(investor, "country", None)
        or ""
    )
    # Normalise to 2-letter ISO code
    code = (country_code or "")[:2].upper()

    rules = get_rules(code)
    summary = get_summary_text(code)

    return {
        "country_code": code,
        "has_specific_rules": rules is not None,
        "summary_text": summary,
        "rules": rules or {},
    }

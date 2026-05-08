"""Structured tax rules by country/residency for AI-context injection.

Sources: Israeli Tax Authority (ITA), IRS Publication 550, HMRC CG manual, BZSt.
All figures are approximate and subject to annual legislative changes.
This is NOT legal or tax advice — it is structured reference data for AI guidance.
"""

TAX_RULES: dict[str, dict] = {

    # ─────────────────────────────────────────────────────────────────────────
    # ISRAEL
    # ─────────────────────────────────────────────────────────────────────────
    "IL": {
        "country": "Israel",
        "currency": "ILS",
        "overview": (
            "Israel applies a flat 25% capital gains tax (CGT) on stocks, ETFs, bonds, "
            "and crypto. However, several account types have special rules that dramatically "
            "reduce or eliminate tax — particularly Keren Hishtalmut (study fund) after 6 years "
            "and pension funds at retirement."
        ),
        "capital_gains": {
            "rate_pct": 25,
            "basis": "real gain after CPI adjustment (or nominal — whichever is lower)",
            "applies_to": ["stocks", "ETFs", "bonds", "mutual funds", "crypto", "foreign securities"],
            "loss_offset": "Capital losses can offset capital gains in the same tax year",
            "foreign_tax_credit": "Foreign withholding tax can be credited up to 25%",
        },
        "dividends": {
            "rate_pct": 25,
            "substantial_shareholder_rate_pct": 30,
            "substantial_shareholder_threshold_pct": 10,
            "note": "Israeli-listed stocks may have 15–25% withholding at source",
        },
        "crypto": {
            "rate_pct": 25,
            "classification": "Financial asset (not currency)",
            "reporting": "Every sale/exchange is a taxable event; annual report to Israeli Tax Authority required",
            "note": "Mining and staking income is treated as ordinary income",
        },
        "account_types": {
            "keren_hishtalmut": {
                "name": "Keren Hishtalmut (Study Fund / קרן השתלמות)",
                "tax_status_after_6_years": "TAX-FREE — all investment gains are completely exempt",
                "tax_status_before_6_years": "25% CGT on gains if withdrawn early",
                "study_withdrawal_3_to_6_years": "Tax-free withdrawal permitted for educational purposes (broad definition)",
                "employee_contribution": {
                    "max_deductible_pct_of_salary": 2.5,
                    "salary_ceiling_ils": 188544,
                    "note": "Contributions above ceiling are not deductible",
                },
                "employer_contribution": {
                    "max_tax_free_pct_of_salary": 7.5,
                    "salary_ceiling_ils": 188544,
                    "note": "Employer contributions above ceiling are treated as taxable income",
                },
                "key_insight": (
                    "After 6 years, Keren Hishtalmut is one of the best tax-sheltered investment "
                    "vehicles in Israel. Gains compound entirely tax-free. Maximising contributions "
                    "here before investing in taxable accounts is highly recommended."
                ),
            },
            "pension_fund": {
                "name": "Pension Fund (קרן פנסיה)",
                "tax_at_retirement": (
                    "Monthly pension is taxed as ORDINARY INCOME — NOT at the 25% CGT rate. "
                    "However, retirees receive a monthly tax exemption of approximately 8,900 ILS/month "
                    "(2024, indexed annually). Income below this threshold is fully exempt."
                ),
                "monthly_exemption_ils_2024": 8900,
                "lump_sum_capitalization": (
                    "Partial or full lump-sum withdrawal at retirement is subject to a special "
                    "capitalization formula that provides significant tax relief. Not taxed at 25% flat."
                ),
                "early_withdrawal_before_retirement": (
                    "Taxed as ordinary income PLUS an additional 35% tax on the investment gains "
                    "component. Strongly discouraged before retirement age."
                ),
                "retirement_age": {"male": 67, "female": 65},
                "employer_contribution": {
                    "max_tax_free_pct_of_salary": 7.5,
                    "note": "Mandatory employer contribution — tax-free up to this limit",
                },
                "employee_contribution": {
                    "max_deductible_pct_of_salary": 7.0,
                    "note": "Deductible from income tax up to this limit",
                },
                "key_insight": (
                    "The common misconception is that pension withdrawals are taxed at 25%. "
                    "They are not — they are taxed as income, but with a substantial monthly "
                    "exemption that means many retirees pay zero or very little tax on their pension."
                ),
            },
            "provident_fund": {
                "name": "Provident Fund / Gemel (קרן גמל)",
                "tax_at_retirement": "Same rules as pension — taxed as income with monthly exemption",
                "gemel_lehashkaa": (
                    "Investment gemel (not for retirement) withdrawals taxed at 25% CGT after age 60"
                ),
            },
        },
        "real_estate": {
            "primary_residence_cgt": (
                "Generally exempt if seller owned and lived there, has no other residential property, "
                "and the previous tax-exempt sale was more than 18 months ago (conditions apply)"
            ),
            "investment_property": (
                "Linear depreciation formula applies — effective rate varies by years held and acquisition date"
            ),
            "rental_income": {
                "flat_tax_rate_pct": 10,
                "monthly_threshold_ils_2024": 5654,
                "note": "Rental income above threshold is taxed at marginal income rates or 31% flat",
            },
        },
        "annual_reporting": (
            "Israeli residents with foreign investments must file an annual capital gains report "
            "with the Israeli Tax Authority. Brokerage income from Israeli sources is usually "
            "reported automatically by the broker."
        ),
    },

    # ─────────────────────────────────────────────────────────────────────────
    # UNITED STATES
    # ─────────────────────────────────────────────────────────────────────────
    "US": {
        "country": "United States",
        "currency": "USD",
        "overview": (
            "The US distinguishes between short-term and long-term capital gains. "
            "Assets held over 1 year qualify for preferential long-term rates (0–20%). "
            "Tax-advantaged accounts (401k, IRA) provide powerful compounding benefits. "
            "Crypto is taxed as property — every sale or exchange is a taxable event."
        ),
        "capital_gains": {
            "short_term": {
                "holding_period": "1 year or less",
                "rate": "Ordinary income tax rates (10–37% depending on total income)",
                "note": "Treated identically to wages for tax purposes",
            },
            "long_term": {
                "holding_period": "More than 1 year",
                "brackets_2024": [
                    {"rate_pct": 0, "income_single_usd_max": 47025, "income_mfj_usd_max": 94050},
                    {"rate_pct": 15, "income_single_usd_max": 518900, "income_mfj_usd_max": 583750},
                    {"rate_pct": 20, "income_single_usd_min": 518900, "note": "High earners"},
                ],
                "niit": {
                    "rate_pct": 3.8,
                    "applies_above_magi_single_usd": 200000,
                    "applies_above_magi_mfj_usd": 250000,
                    "note": "Net Investment Income Tax — additional 3.8% for high earners on all investment income",
                },
            },
            "wash_sale_rule": (
                "Cannot claim a capital loss if you buy the same (or substantially identical) "
                "security within 30 days before or after the sale. The loss is deferred, not eliminated."
            ),
        },
        "dividends": {
            "qualified": "Taxed at long-term capital gains rates (0–20%)",
            "non_qualified": "Taxed as ordinary income",
            "qualification": "Must hold stock >60 days around ex-dividend date; most major US stocks qualify",
        },
        "crypto": {
            "classification": "Property (not currency) per IRS Notice 2014-21",
            "short_term_rate": "Ordinary income rates if held ≤1 year",
            "long_term_rate": "Preferential LTCG rates if held >1 year",
            "taxable_events": ["Sale for USD", "Exchange for another crypto", "Purchase of goods/services"],
            "reporting": "Form 8949 + Schedule D; exchanges issue 1099-DA starting 2025",
        },
        "account_types": {
            "401k_traditional": {
                "name": "401(k) Traditional",
                "contributions": "Pre-tax (reduces current taxable income)",
                "growth": "Tax-deferred",
                "withdrawals": "Taxed as ordinary income",
                "contribution_limit_2024_usd": 23000,
                "catch_up_limit_50_plus_usd": 7500,
                "early_withdrawal_penalty": "10% penalty + income tax if withdrawn before age 59½",
                "rmd_age": 73,
            },
            "401k_roth": {
                "name": "401(k) Roth",
                "contributions": "After-tax",
                "growth": "Tax-free",
                "qualified_withdrawals": "Tax-free after age 59½ with 5-year rule",
                "contribution_limit_2024_usd": 23000,
                "note": "Same combined limit as traditional 401k — you split between the two",
            },
            "ira_traditional": {
                "name": "IRA Traditional",
                "contributions": "Deductible (income limits apply if covered by workplace plan)",
                "growth": "Tax-deferred",
                "withdrawals": "Taxed as ordinary income",
                "contribution_limit_2024_usd": 7000,
                "catch_up_50_plus_usd": 1000,
                "deductibility_phase_out_single_2024": "Income $77k–$87k if covered by employer plan",
            },
            "ira_roth": {
                "name": "IRA Roth",
                "contributions": "After-tax, non-deductible",
                "growth": "Tax-free",
                "qualified_withdrawals": "Tax-free after age 59½",
                "contribution_limit_2024_usd": 7000,
                "income_limit_single_2024": "Phase out $146k–$161k; ineligible above $161k",
                "income_limit_mfj_2024": "Phase out $230k–$240k",
                "backdoor_roth": "High earners can use a backdoor Roth IRA conversion",
            },
        },
        "state_taxes": (
            "Most US states also tax investment income. California has no preferential LTCG rate "
            "(taxed as ordinary income up to 13.3%). States like Texas, Florida, Nevada have no "
            "state income tax."
        ),
    },

    # ─────────────────────────────────────────────────────────────────────────
    # UNITED KINGDOM
    # ─────────────────────────────────────────────────────────────────────────
    "GB": {
        "country": "United Kingdom",
        "currency": "GBP",
        "overview": (
            "UK CGT rates depend on your income tax band. The annual CGT exempt amount was reduced "
            "to £3,000 in 2024. ISA accounts provide completely tax-free growth with an annual "
            "£20,000 contribution limit — the primary tax planning tool for UK investors."
        ),
        "capital_gains": {
            "annual_exempt_amount_gbp_2024": 3000,
            "basic_rate_taxpayer_pct": 10,
            "higher_rate_taxpayer_pct": 20,
            "residential_property_basic_rate_pct": 18,
            "residential_property_higher_rate_pct": 24,
        },
        "dividends": {
            "annual_exempt_amount_gbp_2024": 500,
            "basic_rate_pct": 8.75,
            "higher_rate_pct": 33.75,
            "additional_rate_pct": 39.35,
        },
        "account_types": {
            "isa": {
                "name": "Individual Savings Account (ISA)",
                "tax_status": "ALL gains and income are TAX-FREE",
                "annual_contribution_limit_gbp": 20000,
                "types": ["Cash ISA", "Stocks & Shares ISA", "Innovative Finance ISA", "Lifetime ISA"],
                "lifetime_isa_bonus": "25% government bonus on up to £4,000/year (for first home or retirement)",
            },
            "sipp": {
                "name": "Self-Invested Personal Pension (SIPP)",
                "contributions": "Tax relief at your marginal income tax rate",
                "growth": "Tax-free within the pension",
                "withdrawals": "25% tax-free lump sum; remainder taxed as income",
            },
        },
    },

    # ─────────────────────────────────────────────────────────────────────────
    # GERMANY
    # ─────────────────────────────────────────────────────────────────────────
    "DE": {
        "country": "Germany",
        "currency": "EUR",
        "overview": (
            "Germany applies a flat Abgeltungssteuer of 25% on all investment income (capital gains, "
            "dividends, interest) plus a 5.5% solidarity surcharge, giving an effective rate of ~26.4%. "
            "Each person has an annual exempt amount (Sparerpauschbetrag) of €1,000 (€2,000 for couples). "
            "The holding period does not affect the tax rate."
        ),
        "capital_gains": {
            "flat_rate_pct": 25,
            "solidarity_surcharge_pct": 5.5,
            "effective_rate_pct": 26.375,
            "annual_exempt_amount_eur": 1000,
            "couples_exempt_amount_eur": 2000,
            "holding_period_benefit": "No preferential rate for long-term holdings (unlike US)",
        },
        "account_types": {
            "riester": {
                "name": "Riester-Rente",
                "contributions": "Up to €2,100/year deductible; government bonuses available",
                "withdrawals": "Fully taxed as income at retirement",
            },
        },
    },

    # ─────────────────────────────────────────────────────────────────────────
    # FRANCE
    # ─────────────────────────────────────────────────────────────────────────
    "FR": {
        "country": "France",
        "currency": "EUR",
        "overview": (
            "France applies a 30% flat tax (Prélèvement Forfaitaire Unique / PFU) on all capital gains "
            "and dividends: 12.8% income tax + 17.2% social contributions. Alternatively, taxpayers "
            "can opt for the progressive income tax scale if it is more favourable."
        ),
        "capital_gains": {
            "flat_rate_pct": 30,
            "income_tax_component_pct": 12.8,
            "social_charges_pct": 17.2,
            "alternative": "Can opt for progressive income tax if lower — applies to all investment income",
        },
        "account_types": {
            "pea": {
                "name": "Plan d'Épargne en Actions (PEA)",
                "tax_status_after_5_years": "Gains and dividends are TAX-FREE (only social charges 17.2% apply)",
                "annual_contribution_limit_eur": 150000,
                "restriction": "Only European equities qualify",
            },
            "per": {
                "name": "Plan d'Épargne Retraite (PER)",
                "contributions": "Deductible from income up to annual limits",
                "withdrawals": "Taxed as income at retirement",
            },
        },
    },
}


def get_rules(country: str) -> dict | None:
    """Return tax rules for a country code (ISO 3166-1 alpha-2)."""
    return TAX_RULES.get(country.upper())


def get_summary_text(country: str) -> str:
    """Return a concise plain-text summary suitable for AI context injection."""
    rules = get_rules(country)
    if not rules:
        return (
            f"No specific tax rules are encoded for country '{country}'. "
            "Provide general guidance about capital gains tax, dividend tax, and any "
            "tax-advantaged accounts available in the investor's country."
        )

    lines: list[str] = [f"=== TAX RULES FOR {rules['country'].upper()} ===", rules["overview"], ""]

    cg = rules.get("capital_gains", {})
    if "rate_pct" in cg:
        lines.append(f"CAPITAL GAINS TAX: {cg['rate_pct']}% flat rate on stocks, ETFs, bonds, and crypto.")
        if "basis" in cg:
            lines.append(f"  Basis: {cg['basis']}")
        if "loss_offset" in cg:
            lines.append(f"  Losses: {cg['loss_offset']}")
    elif "short_term" in cg:
        lines.append(f"CAPITAL GAINS TAX (SHORT-TERM, ≤1 year): {cg['short_term']['rate']}")
        brackets = cg.get("long_term", {}).get("brackets_2024", [])
        if brackets:
            rates = ", ".join(f"{b['rate_pct']}%" for b in brackets)
            lines.append(f"CAPITAL GAINS TAX (LONG-TERM, >1 year): {rates} depending on income bracket")
        niit = cg.get("long_term", {}).get("niit", {})
        if niit:
            lines.append(f"  +{niit['rate_pct']}% NIIT for high earners (MAGI > ${niit['applies_above_magi_single_usd']:,} single)")
        if "wash_sale_rule" in cg:
            lines.append(f"  WASH-SALE RULE: {cg['wash_sale_rule']}")
    elif "flat_rate_pct" in cg:
        lines.append(f"CAPITAL GAINS TAX: {cg['flat_rate_pct']}% + {cg.get('solidarity_surcharge_pct', 0)}% surcharge = {cg.get('effective_rate_pct', cg['flat_rate_pct'])}% effective rate.")
        if "annual_exempt_amount_eur" in cg:
            lines.append(f"  Annual exempt amount: €{cg['annual_exempt_amount_eur']:,} per person.")
    elif "flat_rate_pct" in cg:
        lines.append(f"CAPITAL GAINS TAX: {cg['flat_rate_pct']}% flat (PFU).")

    lines.append("")

    # Account types
    accounts = rules.get("account_types", {})
    if accounts:
        lines.append("TAX-ADVANTAGED ACCOUNTS:")
        for key, acc in accounts.items():
            name = acc.get("name", key)
            lines.append(f"\n  {name}:")
            for field, value in acc.items():
                if field == "name":
                    continue
                if isinstance(value, str):
                    lines.append(f"    - {field.replace('_', ' ').title()}: {value}")
                elif isinstance(value, dict):
                    lines.append(f"    - {field.replace('_', ' ').title()}:")
                    for k, v in value.items():
                        lines.append(f"        • {k.replace('_', ' ')}: {v}")

    # Crypto
    crypto = rules.get("crypto", {})
    if crypto:
        lines.append(f"\nCRYPTO TAX: {crypto.get('classification', 'Varies')}")
        if "rate_pct" in crypto:
            lines.append(f"  Rate: {crypto['rate_pct']}%")
        if "reporting" in crypto:
            lines.append(f"  Reporting: {crypto['reporting']}")

    # Annual reporting
    if "annual_reporting" in rules:
        lines.append(f"\nREPORTING: {rules['annual_reporting']}")

    return "\n".join(lines)

"""Pre-built historical crash scenarios with per-asset-class drawdown assumptions."""
from dataclasses import dataclass


@dataclass(frozen=True)
class Scenario:
    id: str
    name: str
    description: str
    year: str
    # Drawdown % (negative = loss) by risk tier
    low_risk_drawdown: float   # bonds, funds, pension
    growth_drawdown: float     # equities, ETFs, real estate
    high_risk_drawdown: float  # crypto
    # FX shock for ILS investors (USD/ILS change %)
    ils_fx_shock: float        # positive = shekel weakens (USD gets more expensive → foreign assets gain)
    # Historical months to full recovery from trough (None = not yet recovered / hypothetical)
    recovery_months: int | None = None


SCENARIOS: list[Scenario] = [
    Scenario(
        id="2008_gfc",
        name="2008 Financial Crisis",
        description="Global banking collapse. Equities fell ~50% from peak. Government bonds rallied as safe haven.",
        year="2008–2009",
        low_risk_drawdown=-5.0,
        growth_drawdown=-50.0,
        high_risk_drawdown=-60.0,
        ils_fx_shock=+15.0,
        recovery_months=54,  # S&P 500 recovered to pre-crisis peak by early 2013
    ),
    Scenario(
        id="covid_crash",
        name="COVID-19 Crash",
        description="Fastest 30% equity drop in history (Feb–Mar 2020). Recovered within 6 months.",
        year="2020",
        low_risk_drawdown=+8.0,   # bonds rallied
        growth_drawdown=-34.0,
        high_risk_drawdown=-50.0,
        ils_fx_shock=+10.0,
        recovery_months=6,
    ),
    Scenario(
        id="2022_rate_hike",
        name="2022 Rate Hike Cycle",
        description="Fed raised rates 425bp in 12 months. Bonds fell alongside equities — rare double loss.",
        year="2022",
        low_risk_drawdown=-18.0,  # bonds crashed too
        growth_drawdown=-25.0,
        high_risk_drawdown=-65.0,
        ils_fx_shock=-5.0,
        recovery_months=24,  # S&P 500 recovered by end of 2023
    ),
    Scenario(
        id="tech_crash_40",
        name="40% Tech Correction",
        description="Hypothetical: growth/tech equities fall 40% (dot-com magnitude). Bonds steady.",
        year="Hypothetical",
        low_risk_drawdown=0.0,
        growth_drawdown=-40.0,
        high_risk_drawdown=-30.0,
        ils_fx_shock=0.0,
        recovery_months=None,
    ),
    Scenario(
        id="ils_depreciation",
        name="ILS Depreciation Shock",
        description="USD/ILS moves from ~3.7 to 4.5 (+22%). Foreign assets rise in ILS terms; local assets unchanged.",
        year="Hypothetical",
        low_risk_drawdown=0.0,
        growth_drawdown=0.0,
        high_risk_drawdown=0.0,
        ils_fx_shock=+22.0,
        recovery_months=None,
    ),
]

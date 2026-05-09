# TradeOps AI — Execution Plan

**Version:** 0.49.0
**Last updated:** 2026-05-09 (v0.49.0)

---

## Phase 1: Decision Engine Hardening — COMPLETE ✅

All tasks (TASK 0–7) are done. See git history for details.

Summary of what was built:
- Routing fix (`redirect_slashes=False` across all routers)
- Investor profile extended fields (migration 0005)
- Age-based safety rules in risk model
- Risk model enforcement fields (migration 0006)
- `financial_decision` module — investment readiness engine
- Investment Readiness card on dashboard
- Investor profile creation/edit with new preference fields
- 14 unit tests for financial decision engine (122 total passing)

---

## Phase 2: Portfolio & Market Intelligence

**Goal:** Bridge the gap between the financial decision engine and real investing intelligence.

**Version target:** 0.12.0 (TASK 8–10), 0.13.0 (TASK 11), 0.14.0 (TASK 12), 0.15.0 (TASK 13–15)

**Framing:** This is NOT live trading. It is Portfolio & Market Intelligence — tracking existing investments, computing portfolio health, and scanning markets for context.

---

### TASK 8 — Holdings module (manual investment tracking) ✅ DONE

**Type:** New module + DB schema  
**Risk:** 🔴 Risky — Alembic migration (0007)

**New tables:**
- `investment_accounts` — provider, account type, currency, investor_id
- `investment_holdings` — ticker, ISIN, name, asset type, quantity, avg buy price, currency, fees, purchase date, current value (manual until market data)

**API endpoints:**
```
GET/POST   /api/v1/investors/{id}/accounts
GET/PUT/DELETE /api/v1/investors/{id}/accounts/{account_id}
GET/POST   /api/v1/investors/{id}/accounts/{account_id}/holdings
PUT/DELETE /api/v1/investors/{id}/accounts/{account_id}/holdings/{holding_id}
```

**Account types:** pension, keren_hishtalmut, brokerage, crypto, etf_fund, bank, other  
**Holding asset types:** stock, bond, etf, crypto, fund, real_estate, other

**Frontend:** `/investments` page — account cards, holdings tables, add/edit/delete forms

---

### TASK 9 — Currency engine (FX rates + conversion) ✅ DONE

**Type:** New module + DB schema  
**Risk:** 🔴 Risky — Alembic migration (0008)

**New table:** `currency_rates` — base, target, rate, fetched_at  
**Data source:** `open.er-api.com` (free, no API key, 1500 req/month)  
**Cache TTL:** 24 hours — fetches all rates for a base currency at once

**API:** Internal use only — no public endpoint. Called by portfolio_analysis service.

**Key function:** `convert(amount, from_currency, to_currency, db) → float`

---

### TASK 10 — Portfolio analysis (P&L, allocation, exposure) ✅ DONE

**Type:** New module  
**Risk:** 🟡 Moderate

**Endpoint:** `GET /api/v1/investors/{id}/portfolio`

**Engine inputs:** accounts + holdings + investor base_currency + FX rates  
**Engine outputs:**
```json
{
  "total_cost_basis": 120000,
  "total_current_value": 135000,
  "unrealized_pnl": 15000,
  "unrealized_pnl_pct": 12.5,
  "currency": "ILS",
  "asset_allocation": {"etf": 45.0, "stock": 30.0, "crypto": 25.0},
  "currency_exposure": {"ILS": 40.0, "USD": 50.0, "EUR": 10.0},
  "accounts": [...],
  "holdings": [...]
}
```

Current value logic: uses manually entered `current_value` if set; falls back to `quantity × avg_buy_price` (cost basis).

**Frontend:** Portfolio summary card on investments page + widget on dashboard.

---

### TASK 11 — Market data integration ✅ DONE

**Type:** New module + DB schema  
**Risk:** 🔴 Risky — Alembic migration (0009)  
**Status:** ✅ DONE

**Data source:** Alpha Vantage (free tier, 25 calls/day) — `GLOBAL_QUOTE` endpoint  
**New table:** `price_snapshots` — ticker, price, currency, fetched_at; indexed on ticker  
**Cache TTL:** 24 hours — aggressive caching to stay within free tier limits

**API endpoints:**
```
GET  /api/v1/market/quote/{ticker}                       — get/fetch cached quote
POST /api/v1/investors/{id}/portfolio/refresh-prices     — bulk refresh all portfolio tickers
```

**Engine changes:**
- `analyze()` accepts optional `live_prices: dict[str, tuple[float, str]]`
- Priority: live price → manual `current_value` → cost basis fallback
- `price_source` field added to `HoldingAnalysis` response: `"live"` | `"manual"` | `"cost_basis"`

**Frontend:** "Refresh prices" button; green "Live" pill on holdings with market price; live price per unit shown in price column

**TASE note:** Alpha Vantage does not reliably cover TASE tickers — Israeli holdings should continue using manual `current_value`. TASE support can be added later with a dedicated provider.

---

### TASK 12 — Market scanner ✅ DONE

---

## Phase 4: Investment Intelligence

**Goal:** Shift from "track what you have" to "guide what you should do" — personalised AI recommendations, discovery of new instruments, and actionable portfolio gap amounts.

**Version target:** 0.16.0

---

### TASK 16 — AI Investment Recommendation Engine ✅ DONE

**Type:** New module (`investment_recommendations/`)
**Risk:** 🟢 Safe — no DB migration

**Endpoint:** `GET /api/v1/investors/{id}/recommendations`

**Engine:** Sends full investor context (profile, risk model, portfolio, gaps, goals, catalog) to Claude; returns personalised `RecommendationReport`:
- `overall_guidance` — 2-3 paragraph honest narrative
- `portfolio_actions` — 2-4 concrete actions with urgency (immediate / soon / when_convenient)
- `recommendations` — 3-6 specific instruments from catalog with why_fits, educational_note, suggested_allocation_pct, action, is_new_to_you

**Frontend:** `/recommendations` page — overall guidance card, action plan, discovery grid, existing holdings guidance, expandable educational panels per instrument.

---

### TASK 17 — Portfolio Gap in Real Money ✅ DONE

**Type:** Schema extension (extends portfolio_analysis rebalance)
**Risk:** 🟢 Safe — no DB migration, backward-compatible nullable fields

**Changes:**
- `RebalanceTier` gains `target_amount`, `actual_amount`, `gap_amount` (nullable, in base currency)
- `RebalanceResult` gains `total_portfolio_value`, `currency`
- Rebalancing card shows "Sell ~X" / "Buy ~X" concrete money amounts

---

### TASK 18 — Discovery Feed ✅ DONE

**Type:** Part of TASK 16 (discovery instruments in recommendations output)
**Risk:** 🟢 Safe

`is_new_to_you: true` instruments shown in a dedicated "New to you — worth exploring" section on the recommendations page.

---

## Phase 3: Financial Intelligence Deepening

**Goal:** Connect all the data the system has into actionable guidance — goals on-track analysis, portfolio rebalancing, and a richer AI report.

**Version target:** 0.15.0 (TASK 13–15)

---

### TASK 13 — Goals progress engine ✅ DONE

**Type:** New module  
**Risk:** 🟢 Safe — no DB migration

**Endpoint:** `GET /api/v1/investors/{id}/goals-analysis`

**Engine inputs:** goals list + financial_profile (for monthly_surplus)  
**Per-goal outputs:** amount_remaining, months_to_target, monthly_contribution_needed, gap, on_track, status

**Statuses:** `complete` | `on_track` | `at_risk` | `no_date`

**Frontend:** Enhanced goals page (status badge, contribution needed, gap indicator) + enhanced dashboard goal cards + monthly summary banner

**Tests:** 9 unit tests

---

### TASK 14 — Portfolio rebalancing guide ✅ DONE

**Type:** New endpoint (extends portfolio_analysis module)  
**Risk:** 🟢 Safe — no DB migration

**Endpoint:** `GET /api/v1/investors/{id}/portfolio/rebalance`

**Engine:** Maps asset_type → risk tier (low_risk/growth/high_risk), compares actual % vs risk model target %; flags tiers >5% off target

**Asset tier mapping:**
- low_risk: bond, fund
- growth: etf, stock, real_estate
- high_risk: crypto
- other: excluded

**Frontend:** Rebalancing guide card on investments page — per-tier progress bar with target marker, action labels (Reduce / Buy more / Hold), rebalance_needed badge

**Tests:** 8 unit tests

---

### TASK 15 — Enhanced AI report ✅ DONE

**Type:** Feature extension (ai_analysis module)  
**Risk:** 🟢 Safe — no schema change

**Changes:**
- `build_context()` now accepts `portfolio_summary` and `goals_analysis` optional params
- Two new JSON keys in system prompt: `portfolio_analysis` and `goals_progress`
- `service.py` fetches portfolio + goals analysis before calling Claude
- Frontend `reports/page.tsx` renders 2 new sections: Portfolio Analysis, Goals Progress

**Type:** New module  
**Risk:** 🟡 Moderate  
**Status:** ✅ DONE

**Scope:**
- Curated catalog of 25 instruments (ETFs, stocks, crypto) across 4 asset families and 4 markets
- Filters by: risk model enforcement, readiness classification, preferred assets, age tier
- Ranks by: risk alignment, portfolio diversification gap, time horizon match, experience suitability
- Output: ranked `InstrumentSuggestion` list with per-instrument rationale and scan notes
- Frontend: `/market-scan` page with ranked instrument cards

**Endpoint:** `GET /api/v1/investors/{id}/market-scan`  
**Tests:** 23 unit tests (4 scoring helpers + 10 full scan scenarios)

---

## 3. Phase 2 Build Order

```
TASK 8 (holdings)          → manual entry works without market data
TASK 9 (currency engine)   → required for accurate multi-currency math
TASK 10 (portfolio analysis) → depends on TASK 8 + 9
TASK 11 (market data)      → deferred; unblocks live price refresh
TASK 12 (market scanner)   → deferred; depends on TASK 11
```

---

## 4. DB Migration Map

| Migration | Description |
|-----------|-------------|
| 0001 | Initial schema |
| 0002 | Strategy templates + seed |
| 0003 | Paper trading tables |
| 0004 | Audit events table |
| 0005 | Investor profile extended fields |
| 0006 | Risk model enforcement fields |
| 0007 | investment_accounts + investment_holdings |
| 0008 | currency_rates |
| 0009 | price_snapshots |
| 0010 | portfolio_snapshots |
| 0011 | goal tracking modes + progress logs |
| 0012 | pension fund fields (current_balance, total_deposits, monthly_contribution, annual_return_rate) |
| 0013 | study fund fields (monthly_contribution_employee, monthly_contribution_employer, fund_status) |
| 0014 | vehicle value added to asset_type enum |
| 0015 | alert_email + email_alerts_enabled on investor_profiles |
| 0016 | widen nationality + tax_residency from VARCHAR(3) to VARCHAR(100) |
| 0017 | watchlist_items table |
| 0018 | spouse_income on financial_profiles + family_member_id on investment_accounts |

---

---

## Phase 5: Workers + Market Expansion

### TASK 19 — Workers module + TASE market support ✅ DONE

**Type:** New module + market data extension
**Risk:** 🟡 Moderate — no DB migration

**Workers (APScheduler):**
- `BackgroundScheduler` wired into FastAPI lifespan; starts/stops cleanly
- `WORKERS_ENABLED` env flag (default `true`) — set to `false` to disable in test/CI
- Job 1: `price_refresh` — runs daily at 20:00 UTC; fetches fresh prices for all distinct tickers in `investment_holdings`
- Job 2: `goal_evaluation` — runs daily at 07:00 UTC; sweeps all investors, logs at-risk goal counts (read-only; no writes)

**TASE market data:**
- `market_data/fetcher.py` now has dual-provider dispatch
  - `.TA` suffix → Yahoo Finance chart API (no key, free, returns ILS price)
  - All others → Alpha Vantage (existing)
- 8 TASE stocks added to market scanner catalog (BEZQ.TA, POLI.TA, LUMI.TA, ICL.TA, TEVA.TA, NICE.TA, ESLT.TA, DLEKG.TA)
- 4 additional NASDAQ stocks added (AMZN, GOOGL, META, TSLA)

---

---

## Phase 6: Market Intelligence & Growth Tools

### TASK C — Debt Payoff Planner ✅ DONE
Avalanche/snowball engine on financial liabilities. `/debt-planner` page.

### TASK D — Watchlist ✅ DONE
`watchlist_items` table (migration 0017). CRUD + daily price refresh. `/watchlist` page.

### TASK B — In-app Notification Center ✅ DONE
On-the-fly computed alerts (at-risk goals, rebalance, stale prices, setup gaps). `/notifications` page.

### TASK 23 — AI Investment Agent ✅ DONE
Multi-context Claude Sonnet agent. Gathers full investor context + live market prices. Returns health score, action plan with amounts, top opportunities, capital thresholds ("with 500 ILS, buy X"), risk warnings. `/agent` page.

### TASK 25 — AI Reliability & UX Hardening ✅ DONE

**Type:** Bug fixes + reliability improvements + UX polish  
**Risk:** 🟢 Safe — no DB migration

**Fixes:**
- `generate_recommendations` and `generate_report`: unhandled `json.loads` → safe fallback dict on JSON parse failure
- `AnalysisReportOut` schema: missing `portfolio_analysis` + `goals_progress` fields → Pydantic 422 on every AI report call
- Dedicated Next.js Route Handlers for `/recommendations` and `/ai-report` with 3-attempt retry + 90s timeout (matching agent handler)

**Changed:**
- Haiku → Sonnet (`claude-sonnet-4-6`) in `investment_recommendations/analyzer.py` and `ai_analysis/analyzer.py`
- New `market_prewarm` background job: runs on startup + every 30 min to keep 30-min in-memory signal cache warm; removes 20-40s cold-start latency from recommendations requests
- localStorage cache on Agent, Recommendations, and AI Report pages: instant load on revisit, stale banner at 12h/24h threshold
- Actionable error messages mapped to HTTP status codes (503/502/404) on all AI pages
- Setup guidance cards in empty states with direct links to required data sources

---

### TASK 26 — Deep Market Research Engine ✅ DONE

**Type:** New module (`market_research/`)
**Risk:** 🟢 Safe — no DB migration

**Endpoint:** `GET /api/v1/investors/{id}/market-research`

**What it does:** Screens 60+ stocks across 8 sectors for fundamental undervaluation, then uses AI to construct a three-tier investment brief with specific, data-backed theses.

**Screener scoring (0–100):**
- Analyst conviction (0–30): upside to consensus price target + buy/sell rating
- Valuation (0–25): forward P/E + PEG ratio
- Growth (0–25): revenue growth YoY
- Quality (0–15): net profit margin + ROE
- Entry point (0–10): price position within 52-week range

**Three tiers:**
- Stable (30–35%): income, capital preservation, deep value
- Moderate (40%): quality growth at reasonable price
- High Opportunity (20–25%): undervalued + catalyst, higher volatility

**Data sources:** `yfinance` (free, no API key) for fundamentals; XLK/XLF/XLV/XLE/XLY/XLI/XLC/XLU sector ETFs for sector performance.

**Cache:** 6-hour in-memory cache; pre-warm background job runs on startup and every 6h.

**Frontend:** `/market-research` page — sector performance grid, three-tier pick cards, key metric pills, expandable thesis panels.

**Tests:** 20 unit tests for screener scoring algorithm.

---

### TASK 24 — Live Market Opportunity Engine ✅ DONE
Replaces static catalog recommendations with real market intelligence. New `live_market_intel` module fetches live data from CoinGecko (top crypto, 24h/7d price changes) and Yahoo Finance (stocks/ETFs, 52-week range, 7-day history). Scanner classifies each instrument (`dip / near_low / recovery / momentum / stable`) and ranks by opportunity score. 30-min in-memory cache. AI recommendations engine receives full live price context and references actual market conditions in output. Frontend: "Live Market Signals" grid with price badges, % change, 52w range bar, watchlist button. Catalog expanded to 57 instruments.

---

---

## Phase 7: Portfolio Intelligence & Tax Awareness

*Gap analysis identified 2026-05-08 from professional trader review.*

---

### TASK 27 — Tax Rules Engine ✅ DONE

**Type:** New module (`tax_rules/`)
**Risk:** 🟢 Safe — no DB migration

**What it does:** Structured, country-specific tax rules injected into all AI context payloads so the AI gives accurate, jurisdiction-aware tax guidance.

**Countries covered:** Israel (IL), United States (US), United Kingdom (GB), Germany (DE), France (FR)

**Key Israeli corrections made:**
- Pension fund (קרן פנסיה): NOT taxed at 25% at retirement — taxed as income with monthly exemption ~8,900 ILS (2024)
- Keren Hishtalmut: COMPLETELY TAX-FREE after 6 years — highlighted as the single best tax shelter for Israeli investors
- Stocks/ETFs/Crypto: 25% CGT (real gains after CPI adjustment or nominal, whichever is lower)

**Files created:**
- `backend/app/tax_rules/rules.py` — structured tax rule data (IL, US, GB, DE, FR)
- `backend/app/tax_rules/service.py` — `get_tax_context_for_investor(investor)` → dict
- `backend/app/tax_rules/__init__.py`

**Modules updated:**
- `ai_analysis/analyzer.py` — `build_context()` accepts `tax_context`; system prompt updated with tax accuracy rules
- `ai_analysis/service.py` — fetches and injects tax context
- `investment_recommendations/analyzer.py` — `build_recommendation_context()` accepts `tax_context`; system prompt updated
- `investment_recommendations/service.py` — fetches and injects tax context

---

### TASK 28 — Performance History & Equity Curve ✅ DONE

**Type:** New UI page + backend query (DB table exists: `portfolio_snapshots`)
**Risk:** 🟢 Safe — no DB migration (snapshots table already exists from migration 0010)

**What to build:**
- Daily portfolio value snapshots stored automatically (currently the table exists but nothing writes to it)
- Background job: daily snapshot writer (uses existing `portfolio_analysis.service.get_portfolio()`)
- API endpoint: `GET /api/v1/investors/{id}/portfolio/history?period=1m|3m|6m|1y|all`
- Response: array of `{date, total_value, cost_basis, unrealized_pnl_pct, asset_allocation}`
- Frontend: `/performance` page — equity curve chart, period selector, max drawdown indicator, best/worst month

**Priority:** High — every serious investor needs to see their equity curve.

---

### TASK 29 — Core Risk Metrics (Sharpe, Drawdown, Benchmark) ✅ DONE

**Type:** New module (`performance_analytics/`)
**Risk:** 🟢 Safe — no DB migration (reads from portfolio_snapshots)

**What to build:**
- Sharpe ratio (annualised, using risk-free rate from config)
- Sortino ratio (downside deviation)
- Maximum drawdown (peak-to-trough % decline)
- Benchmark comparison: S&P 500 (SPY) as default, TA-35 for ILS investors
- Beta vs benchmark (rolling 3-month correlation)
- Best/worst month, current drawdown from peak
- API endpoint: `GET /api/v1/investors/{id}/portfolio/analytics`
- Frontend: analytics card on `/performance` page

**Priority:** High — required for meaningful portfolio assessment.

---

### TASK 30 — Transaction Log / Trade Journal ✅ DONE

**Type:** New module + DB schema
**Risk:** 🔴 Risky — Alembic migration (new `holding_transactions` table)

**What to build:**
- `holding_transactions` table: holding_id, account_id, investor_id, transaction_type (buy/sell/dividend), quantity, price_per_unit, total_amount, fees, transaction_date, notes
- API: `GET/POST /api/v1/investors/{id}/transactions`, `GET /api/v1/investors/{id}/accounts/{acc_id}/holdings/{h_id}/transactions`
- Portfolio analysis updated to compute P&L from transaction history (cost basis = weighted average of buys)
- Frontend: `/transactions` page — sortable log, filter by account/ticker/date, export to CSV

**Priority:** High — without this, P&L calculations are approximate and taxes cannot be computed correctly.

---

### TASK 31 — Price Alerts on Specific Levels ✅ DONE

**Type:** New module + DB schema
**Risk:** 🔴 Risky — Alembic migration (new `price_alerts` table)

**What to build:**
- `price_alerts` table: investor_id, ticker, alert_type (above/below), target_price, is_active, triggered_at
- Worker job: check price alerts daily after price refresh
- In-app notification when triggered (integrates with existing notifications module)
- API: CRUD for price alerts
- Frontend: Alert button on watchlist and holdings; `/alerts` section in notifications

**Priority:** Medium — useful but not blocking core portfolio management.

---

### TASK 32 — Economic Calendar (Earnings Dates & Macro Events) ✅ DONE

**Type:** New module (read-only, external API)
**Risk:** 🟢 Safe — no DB migration

**What to build:**
- Earnings dates for holdings + watchlist tickers (yfinance `calendar` data)
- Next earnings date badge on holding cards
- `GET /api/v1/investors/{id}/calendar` — returns upcoming earnings dates for all held + watched tickers
- Frontend: upcoming events panel on dashboard; earnings badge on investment holding rows

**Data source:** yfinance `.calendar` property (free, no key required)

**Priority:** Medium — high value for active investors.

---

### TASK 33 — Correlation Matrix & Concentration Risk ✅ DONE

**Type:** New module (analytics, no DB migration)
**Risk:** 🟢 Safe

**What to build:**
- Compute pairwise correlation between held tickers using 90-day price history (yfinance)
- Concentration risk score: flag if >40% of portfolio in single sector or >3 tickers with correlation >0.8
- API: `GET /api/v1/investors/{id}/portfolio/correlation`
- Frontend: correlation heatmap on `/performance` page; concentration risk warning card

**Priority:** Medium — reveals hidden risk that allocation % doesn't show.

---

### TASK 34 — Position Sizing & Max-Loss Guidance ✅ DONE

**Type:** Feature extension (recommendations module)
**Risk:** 🟢 Safe — no DB migration

**What to build:**
- Per-recommendation: `suggested_position_size_pct` (% of investable capital), `max_loss_if_wrong` (in base currency at a defined stop-loss distance)
- Stop-loss suggestion: ATR-based (yfinance 14-day ATR) or 10% below entry as default
- Show on recommendations page: "Suggested size: 5% (~3,400 ILS) | Max loss: ~340 ILS at 10% stop"

**Priority:** Medium.

---

### TASK 35 — Holdings News Feed ✅ DONE

**Type:** New module (external API integration)
**Risk:** 🟢 Safe — no DB migration

**What to build:**
- Fetch recent news headlines for held + watched tickers
- Data source: yfinance `.news` property (free) or Alpha Vantage NEWS_SENTIMENT endpoint
- API: `GET /api/v1/investors/{id}/news?limit=20`
- Frontend: news feed widget on dashboard; news tab on individual holding detail

**Priority:** Low — nice to have but doesn't affect core portfolio decisions.

---

### TASK 36 — CSV Import for Holdings ✅ DONE

**Type:** New feature (holdings module extension)
**Risk:** 🟡 Moderate

**What to build:**
- Parse CSV from common Israeli brokers (Meitav, IBI, Psagot) and generic format
- Map columns: ticker, quantity, purchase_price, purchase_date, fees, currency
- Preview before import; validate tickers; dry-run mode
- API: `POST /api/v1/investors/{id}/accounts/{acc_id}/holdings/import`
- Frontend: import button on investments page with column-mapping wizard

**Priority:** Low for MVP — but would make the app usable for people with existing portfolios.

---

---

## Phase 8: Professional Investment Intelligence

*Gap analysis 2026-05-09 — review from the perspective of an experienced investment manager managing client portfolios.*

**Goal:** Elevate from personal finance tracker → elite investment analysis platform. Five pillars: attribution, stress testing, income projection, tax optimization, and client reporting.

---

### TASK 37 — Performance Attribution & Benchmark Comparison

**Type:** New module (`performance_analytics/attribution.py`)
**Risk:** 🟢 Safe — no DB migration (reads portfolio_snapshots + yfinance for benchmark)

**What it does:**
- Fetch benchmark OHLCV via yfinance: SPY (USD investors), TA-35 (ILS investors, `^TA35.TA`), with manual fallback to SPY
- Compute portfolio total return over same window as portfolio_snapshots
- **Alpha** = portfolio_return − benchmark_return
- **Rolling returns**: 1M / 3M / 6M / 1Y (annualised)
- **Holding-level attribution**: each holding's contribution (%) to total portfolio return, sorted best→worst (top 3 contributors, top 3 detractors)
- **Beta** vs benchmark (already in TASK 29 — reuse)

**API endpoint:** `GET /api/v1/investors/{id}/portfolio/attribution?period=1y`

**Response:**
```json
{
  "portfolio_return_pct": 12.4,
  "benchmark_return_pct": 9.1,
  "alpha_pct": 3.3,
  "benchmark_name": "S&P 500 (SPY)",
  "rolling_returns": {"1m": 1.2, "3m": 3.8, "6m": 6.1, "1y": 12.4},
  "contributors": [
    {"name": "QQQ", "contribution_pct": 4.2, "return_pct": 18.1},
    ...
  ],
  "detractors": [...]
}
```

**Frontend:** New "Attribution" tab on `/performance` page:
- Portfolio vs benchmark line chart (dual series)
- Alpha badge (green/red)
- Rolling returns grid (1M / 3M / 6M / 1Y)
- Top contributors / detractors bar chart

---

### TASK 38 — Scenario Analysis & Stress Testing

**Type:** New module (`scenario_analysis/`)
**Risk:** 🟢 Safe — no DB migration (applies historical drawdowns to current allocation)

**What it does:**
- Pre-built historical scenarios with per-asset-class drawdown percentages:
  - 2008 Financial Crisis: equities −50%, bonds −5%, crypto −60%
  - COVID Crash (Mar 2020): equities −34%, bonds +8%, crypto −50%
  - 2022 Rate Hike Cycle: equities −25%, bonds −18%, crypto −65%
  - 40% Tech Crash: equities(growth) −40%, bonds 0%, crypto −30%
  - ILS Depreciation (USD/ILS → 4.5): applied to FX-exposed positions
- Apply each scenario to current portfolio allocation → simulated loss/gain in base currency
- **Monte Carlo** (long-horizon): 1000 simulations over N years using mean/variance of historical returns

**API:** `GET /api/v1/investors/{id}/portfolio/scenarios`

**Frontend:** `/stress-test` page — scenario cards showing expected portfolio value and % loss; Monte Carlo fan chart (10th, 50th, 90th percentile wealth at retirement age)

---

### TASK 39 — Dividend & Income Calendar

**Type:** New module (`income_projection/`)
**Risk:** 🟢 Safe — no DB migration

**What it does:**
- Fetch dividend history + next ex-date via yfinance for held tickers
- Project annual dividend income for each holding (quantity × forward annual dividend)
- Total portfolio annual income and yield-on-cost vs yield-on-current-value
- Upcoming ex-dividend dates calendar (next 90 days)

**API:** `GET /api/v1/investors/{id}/portfolio/income`

**Frontend:** Income card on `/investments` page:
- Annual income total in base currency
- Portfolio yield %
- Upcoming ex-dividend date badges on holding rows
- Income breakdown by holding (pie chart)

---

### TASK 40 — Tax-Loss Harvesting Alerts ✅ DONE

**Type:** Feature extension (tax_rules + portfolio_analysis modules)
**Risk:** 🟢 Safe — no DB migration

**What it does:**
- Identify holdings with unrealized loss > threshold (default 5%)
- Cross-reference with holdings that have unrealized gains of similar magnitude
- Flag harvest pairs: "sell TSLA (−8%) to offset gains from QQQ (+15%) — estimated tax saving X ILS"
- Track short vs long-term holding periods (purchase_date → today)
- After-tax portfolio return at portfolio level (not just per-holding)
- Respect wash-sale window (30 days) — warn if similar instrument was recently bought

**API:** `GET /api/v1/investors/{id}/portfolio/tax-opportunities`

**Frontend:** Tax card on `/performance` page — harvest opportunities list, holding period badges (short/long term), estimated annual tax saving

---

### TASK 41 — Professional Client Report (PDF Export)

**Type:** New feature (reporting module)
**Risk:** 🟡 Moderate — adds `reportlab` or `weasyprint` dependency

**What it does:**
- Generate a professional multi-page PDF report covering:
  - Cover page: investor name, report period, AUM
  - Performance summary: portfolio vs benchmark, alpha, rolling returns
  - Holdings table: name, allocation %, current value, P&L, weight
  - Risk metrics: Sharpe, Sortino, max drawdown, VaR
  - Asset allocation chart (rendered as table in PDF)
  - Goals progress summary
  - Tax summary (realised gains YTD, unrealised, estimated tax)
- Monthly / quarterly date range selector

**API:** `GET /api/v1/investors/{id}/reports/pdf?period=monthly|quarterly`  
Returns `application/pdf` stream.

**Frontend:** "Export PDF" button on `/performance` page; download triggers immediately.

**Library preference:** `reportlab` (pure Python, no system deps, Docker-friendly) over `weasyprint` (needs Cairo/Pango system packages).

---

## 5. Out of Scope (explicit deferral)

- Broker API integration (IBKR, eToro, Meitav) — much larger lift
- PDF statement import
- Real-time price streaming (daily-close polling sufficient for MVP)
- Live trading execution
- Kubernetes / production deployment

---

## 6. Maintenance Checklist (per task)

For each task:
- [ ] DB schema change → create Alembic migration, test upgrade + downgrade
- [ ] New API endpoint → update `docs/architecture.md` API table
- [ ] New frontend page or card → update frontend structure in `docs/architecture.md`
- [ ] Add entry to `CHANGELOG.md` under `## [Unreleased]`
- [ ] New logic module → add unit tests

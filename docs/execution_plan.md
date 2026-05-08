# TradeOps AI — Execution Plan

**Version:** 0.38.1
**Last updated:** 2026-05-08

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

## 5. Out of Scope (explicit deferral)

- Broker API integration (IBKR, eToro, Meitav) — much larger lift
- PDF / CSV statement import
- Real-time price streaming (daily-close polling sufficient for MVP)
- Tax engine
- Live trading execution
- Workers / background job processing
- Kubernetes / production deployment

---

## 6. Maintenance Checklist (per task)

For each task:
- [ ] DB schema change → create Alembic migration, test upgrade + downgrade
- [ ] New API endpoint → update `docs/architecture.md` API table
- [ ] New frontend page or card → update frontend structure in `docs/architecture.md`
- [ ] Add entry to `CHANGELOG.md` under `## [Unreleased]`
- [ ] New logic module → add unit tests

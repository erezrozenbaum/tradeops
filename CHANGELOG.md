# Changelog

All notable changes to TradeOps AI are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).  
Versions are assigned retroactively to match the git commit history.

---

## [Unreleased]

---

## [0.27.0] — 2026-05-01

### Added
- **Study Fund (קרן השתלמות) asset type** — dedicated balance-based model for Israeli keren hishtalmut accounts
  - New fields on `investment_holdings`: `monthly_contribution_employee`, `monthly_contribution_employer`, `fund_status` (all nullable); migration 0013
  - `fund_status`: "active" | "inactive" — inactive funds set effective contribution to 0 in simulation
  - Tax logic: `tax_exemption_date = start_date + 6 years`; returns "Tax-Free" or "Locked" with years remaining
  - Portfolio engine extended: `is_pension` branch now covers both `pension_fund` and `study_fund`
  - Rebalance engine: `study_fund` mapped to `low_risk` tier alongside bonds and pension funds
  - Pension simulation router handles `study_fund`: respects `fund_status`, computes tax status, exposes employee/employer split
- **Study fund UI** — keren_hishtalmut accounts show a dedicated add/edit form with: Fund Name, Current Balance, Total Deposits, Employee/Employer Contribution, Annual Return, Currency, Start Date, Fund Status toggle
  - Table rows show monthly total contributions in Qty column, total deposits in Buy Price column
  - Tax status badge inline: "✅ Tax-Free" (green) or "🔒 Locked · Xy" (orange) based on start date; "Inactive" badge if fund is inactive
  - "Simulate" button appears on study fund rows; simulation panel shows tax status, inactive warning, and employee/employer contribution breakdown

---

## [0.26.0] — 2026-05-01

### Fixed
- **Financial assets/liabilities now editable** — clicking the edit icon on any asset or liability expands an inline edit form; saves via `PUT /financial-profile/assets/{id}` and `PUT /financial-profile/liabilities/{id}` which already existed in the backend but had no frontend wiring

### Added
- **Pension simulation engine** (`pension_simulation/`) — pure-math projection for pension fund holdings; no DB migration
  - Endpoint: `GET /api/v1/investors/{id}/pension-simulation?holding_id=&retirement_age=&monthly_contribution=&annual_return_rate=&withdrawal_years=`
  - Formula: compound monthly interest on current balance + future contributions; withdrawal estimate over configurable period
  - Uses investor `date_of_birth` from profile to compute current age and years to retirement
- **Simulation panel on investments page** — "Simulate" button appears on pension fund holding rows; expands an interactive panel with 4 adjustable inputs (retirement age, monthly contribution, expected return %, withdrawal period); shows projected balance, monthly pension estimate, investment gains, and a stacked progress bar (current balance / contributions / gains)

---

## [0.25.0] — 2026-05-01

### Added
- **Pension fund model** — pension and keren_hishtalmut holdings now use a dedicated savings-instrument model instead of quantity × price
  - New fields on `investment_holdings`: `current_balance`, `total_deposits`, `monthly_contribution`, `annual_return_rate` (all nullable)
  - Portfolio engine branches on `asset_type == "pension_fund"`: cost basis = `total_deposits`, current value = `current_balance`; quantity × price logic is completely skipped
  - Migration 0012 adds the 4 new columns (additive-only, fully backward-compatible)

### Changed
- **Add/edit holding form** — pension/keren_hishtalmut accounts show a dedicated form: Fund Name, Current Balance, Total Deposits, Monthly Contribution, Annual Return %; Ticker, ISIN, Quantity, Avg Buy Price fields are hidden
- **Holdings table** — pension fund rows display monthly contribution in the Qty column, total deposits in the Buy Price column, and "Balance: X" label in the Current Value column; no Live/Manual price badges shown
- **Pydantic schema** — `quantity` and `avg_buy_price` relaxed from `gt=0` to `ge=0` to allow pension funds to store 0 as a sentinel

---

## [0.24.0] — 2026-05-01

### Fixed
- **Crypto prices via CoinGecko** — Yahoo Finance chart API returns incorrect prices for crypto (XRP showed $15.33 vs actual $1.37); crypto now routed to CoinGecko (free, no key, accurate); stocks/ETFs/TASE remain on Yahoo Finance; Alpha Vantage kept as fallback
- **ILS display bug** — live-priced USD holdings (e.g. XRP) incorrectly showed "≈ 769 ILS" (the USD number mislabelled as ILS); fixed by using `live_price_currency` instead of `h.currency` for secondary value label
- **FX rate staleness** — USD/ILS rate was cached for 24h; cache TTL reduced to 4h (well within open.er-api.com free tier); "Refresh Prices" now also force-refreshes FX rates before recomputing portfolio

### Added
- **ILS equivalents on portfolio summary cards** — total value, cost basis, and unrealized P&L cards now show the ILS equivalent below the USD figure when `base_currency ≠ ILS` and the ILS rate is available
- **ILS equivalents per holding** — each holding row shows "≈ X ILS" for holdings priced in USD (only when ILS rate is available and not already shown via the local value line)
- **Crypto ticker normalization** — user-entered names like "Bitcoin", "XRP", "Ethereum" etc. are resolved to CoinGecko IDs; "TLV: LUMI" format normalised to "LUMI.TA" for TASE lookup

---

## [0.23.0] — 2026-05-01

### Added
- **Workers module** — APScheduler `BackgroundScheduler` wired into FastAPI lifespan; starts/stops cleanly with the app; controlled by `WORKERS_ENABLED` env flag (default `true`)
- **Daily price refresh job** (`workers/jobs/price_refresh.py`) — runs at 20:00 UTC; discovers all distinct tickers across all investor holdings and calls the market data fetcher for each; logs refreshed vs failed tickers
- **Daily goal evaluation job** (`workers/jobs/goal_evaluation.py`) — runs at 07:00 UTC; sweeps all investors, runs goals analysis engine, logs a warning for any investor with at-risk goals; read-only (no writes)
- **TASE market data support** — `market_data/fetcher.py` now has a second provider: Yahoo Finance chart API (no key required) for TASE tickers (`.TA` suffix); Alpha Vantage is used for all other tickers; provider selection is automatic
- **TASE instruments in catalog** — 8 TASE stocks added to market scanner: `BEZQ.TA` (Bezeq, low risk), `POLI.TA` (Bank Hapoalim), `LUMI.TA` (Bank Leumi), `ICL.TA` (ICL Group), `TEVA.TA` (Teva Pharma), `NICE.TA` (NICE Ltd), `ESLT.TA` (Elbit Systems), `DLEKG.TA` (Delek Group, very high risk); all priced in ILS
- **Additional NASDAQ instruments** — 4 more US growth stocks added to catalog: `AMZN`, `GOOGL`, `META` (high risk), `TSLA` (very high risk)

### Changed
- `main.py` — converted from bare FastAPI init to `@asynccontextmanager` lifespan pattern; scheduler starts/stops in lifespan hooks
- `requirements.txt` — added `apscheduler>=3.10.0,<4.0`
- `core/config.py` — added `WORKERS_ENABLED: bool = True` setting

---

## [0.22.0] — 2026-05-01

### Added
- **Goal tracking modes** — `financial_goals` now supports 5 tracking modes beyond the original "target by date": `monthly_contribution`, `monthly_passive_income`, `balance_threshold`, and `debt_reduction`; each mode repurposes `target_amount`/`current_amount` semantically and stores mode-specific config in a new `mode_config` JSONB column
- **Alembic migration 0011** — adds `tracking_mode VARCHAR(50)` (default `target_by_date`) and `mode_config JSONB` to `financial_goals`; creates new `goal_progress_logs` table with `(goal_id, period_year, period_month)` unique constraint for monthly tracking
- **Goal progress logs** — new `GoalProgressLog` model, `progress_service.py` (upsert by period), and `progress_router.py` exposing `POST/GET /investors/{id}/goals/{goal_id}/progress`
- **Analysis engine mode dispatch** — `goals_analysis/engine.py` dispatches on `tracking_mode` with dedicated handlers per mode; `monthly_contribution` computes contribution streak from progress logs; `debt_reduction` computes payoff timeline; `balance_threshold` supports min/max threshold types; `monthly_passive_income` computes income gap
- **Live preview panel** — goal creation form now shows a real-time right-column preview card with progress bar and computed outputs as the user fills in the form
- **Dynamic form fields** — form fields change based on the selected tracking mode; irrelevant fields are hidden; mode selector uses icon cards with descriptions
- **Mode-aware goal cards** — goal list cards render mode-specific metrics (contribution vs target, remaining debt, income gap, payoff timeline, monthly streak badge)
- **23 new tests** (`test_goal_tracking_modes.py`) covering all 4 new modes, streak computation, backward compatibility, and mixed-mode scenarios

### Changed
- `goals_analysis/schemas.py` — `GoalAnalysis` extended with `tracking_mode`, `streak_months`, `income_gap`, `payoff_months`, `threshold_type` fields
- `goals_analysis/service.py` — fetches progress logs from DB and passes them to engine for streak computation
- Existing goals receive `tracking_mode = 'target_by_date'` automatically via column DEFAULT; no data migration required

---

## [0.21.0] — 2026-05-01

### Added
- **Pension Fund asset type** — `pension_fund` added to `HoldingAssetType` enum; maps to `low_risk` tier in the rebalancing engine; available in both add-holding and edit-holding forms; `pension_fund` also added to `_TIER_META` low-risk label
- **Per-holding after-tax P&L** — each holding row in the investments table now shows "After tax: ±X" below the P&L badge when there is a non-zero P&L, applying the 25% Israeli capital gains tax at the holding level

### Changed
- Manual holding formula hint now reads `(manual — edit to fix)` instead of `(manual)` to guide users to correct stale current values via the edit form

---

## [0.20.0] — 2026-04-30

### Added
- **After-tax P&L (25% capital gains tax)** — `pnl_after_tax` computed at holding, account, and portfolio level in the portfolio analysis engine; investments page P&L card shows a "After 25% tax" sub-section with the net gain after Israeli capital gains tax; tax is applied only to gains, losses are unchanged
- **FX rate transparency** — `fx_rates: dict[str, float]` added to `PortfolioSummary`; investments page shows an exchange rate banner listing the actual conversion rates used (e.g. `1 USD = 3.6200 ILS`); if the FX API falls back to 1:1, a `(fallback — check network)` warning is displayed
- **"Manual — refresh for live" badge** — holdings with a ticker symbol but using manual/stale current values now show an amber badge, making it obvious that clicking "Refresh prices" will update them

### Changed
- Current value column: values in base currency shown in bold; native-currency sub-line now prefixed with `≈` for clarity; formula hint labels `(manual)` or `(cost)` when price source is not live
- Total value stat card now shows `All values in {currency}` subtitle to make the display currency explicit

### Fixed
- FX rate fallback now explicitly flagged in the UI; previously a silent 1:1 fallback would show wrong totals with no warning

---

## [0.19.0] — 2026-04-30

### Added
- **Portfolio value history** — `portfolio_snapshots` table (migration 0010); snapshot saved on every price refresh; `GET /investors/{id}/portfolio/history` endpoint; area chart on investments page showing portfolio value over time
- **Allocation donut chart** — investments page asset allocation card replaced with an interactive donut chart (Recharts PieChart) with per-type colour legend
- **Price refresh feedback** — `POST /refresh-prices` now returns `PriceRefreshResult` with `tickers_refreshed`, `tickers_failed`, and `cache_valid_until`; investments page shows a feedback banner after each refresh
- **Setup completeness checklist** — dashboard shows a 5-step checklist (profile → financial → risk model → goals → holdings) that disappears once all steps are complete
- **Fund this goal CTA** — goals page shows a "how to fund" section on at-risk goals with a link to the recommendations page
- **Ticker search on market scanner** — search any ticker symbol to get a live price quote directly from Alpha Vantage
- **Market data cache panel on settings** — shows cached price and freshness status per portfolio ticker, with a "Refresh all" button

### Changed
- `formatCurrency()` now accepts an optional `compact` flag for abbreviated values in chart axes (e.g. `₪10K`, `₪1.2M`)

---

## [0.18.0] — 2026-04-30

### Fixed
- **Holdings current value calculation**: "Current value" override field now accepts **price per unit** (e.g. 209.20 per share) and multiplies by quantity on save — previously accepted total position value which was confusing and led to wrong totals
- **Holdings multi-currency display**: current value cell now shows the value in the holding's native currency (e.g. $2,717 USD) beneath the base-currency total (e.g. ₪10,050 ILS) when currencies differ; formula hint updated to show `qty × price` for all price sources (live, manual, cost basis)

### Changed
- Holdings add/edit form field renamed "Current value (override)" → "Current price per unit (optional)" with updated placeholder text

---

## [0.17.0] — 2026-04-30

### Fixed
- **Financial profile — enum mismatches**: `job_stability` dropdown options now match backend enum (`stable`, `freelance`, `unstable`, `unemployed`); previously offered `very_stable` and `moderate` which caused silent 422 errors on save
- **Financial profile — asset type enum mismatch**: asset type options now match backend enum (`cash`, `stocks`, `bonds`, `etf`, `real_estate`, `crypto`, `pension`, `other`); previously offered `savings`, `investment`, `vehicle` which caused silent failures when adding assets
- **Financial profile — silent save failures**: `saveProfile()` and `addAsset()` now show inline error messages when the API returns an error; previously failed silently with no user feedback
- **Recommendations page — TypeScript build error**: `Badge variant="secondary"` replaced with `variant="muted"` to match the project's Badge component variants
- **Frontend production build**: fixed `npm install` in production mode skipping devDependencies (including Next.js itself) by adding `--include=dev` flag

### Added
- **Financial profile summary** now shows 6 stat cards: monthly income, monthly expenses, monthly surplus, **liquid savings**, emergency fund, and **investable capital %** — liquid savings was previously saved but never displayed
- **Holdings edit**: pencil icon button on each holding row opens an inline pre-filled edit form; calls `PUT /investors/{id}/accounts/{account_id}/holdings/{holding_id}`
- **Holdings value breakdown**: current value cell now shows the calculation formula beneath the total (`qty × buy price`), or "Live price" / "Manual" label depending on the price source

### Changed
- Holdings table column renamed "Avg price" → "Buy price" (clearer terminology)
- Frontend container switched to production mode (`npm run build && npm start`) — eliminates per-page on-demand compilation; all pages load instantly after a one-time startup build
- Docker Compose: named volume `frontend_node_modules` added to persist installed packages across container restarts

---

## [0.16.0] — 2026-04-28

### Added
- **Investment Recommendations module** (`backend/app/investment_recommendations/`) — AI-powered, personalised investment guidance engine using Claude API
- **`GET /investors/{id}/recommendations`** — returns `RecommendationReport`: overall guidance narrative, 2–4 action plan steps (with urgency), 3–6 specific instrument recommendations from the curated catalog, and a discovery section for instruments the investor doesn't currently hold
- **Instrument recommendations** include: ticker, name, asset type, risk level, why it fits this specific investor, suggested allocation %, plain-language educational note, action type (start_position / increase / consider), and is_new_to_you flag
- **"Recommendations" page** (`/recommendations`) — new frontend page under the Intelligence section; shows overall guidance card, colour-coded action plan, discovery instruments grid (new-to-you), and existing holdings guidance; each instrument card has an expandable "What is this?" educational panel
- **Sidebar entry** — "Recommendations" added to the Intelligence section with a wand icon
- **Portfolio gap in real money** — rebalance engine now computes `target_amount`, `actual_amount`, and `gap_amount` per tier (in base currency) when portfolio total value is available
- **Rebalancing card updated** — shows "Sell ~X" / "Buy ~X" concrete money amounts alongside percentage delta for each overweight/underweight tier

### Changed
- `RebalanceTier` schema extended with `target_amount`, `actual_amount`, `gap_amount` (all nullable)
- `RebalanceResult` schema extended with `total_portfolio_value` and `currency` (nullable)
- Portfolio rebalance router now passes `total_current_value` and `base_currency` to the engine

---

## [0.15.0] — 2026-04-27

### Added
- **Goals analysis module** (`backend/app/goals_analysis/`) — stateless engine computing per-goal progress metrics: amount remaining, months to target, monthly contribution needed, gap vs monthly surplus, on_track flag, and status (`complete` / `on_track` / `at_risk` / `no_date`)
- **`GET /investors/{id}/goals-analysis`** — returns `GoalsAnalysisResult` with per-goal analysis and total monthly contribution needed
- **Goals page enhanced** — each goal card now shows status badge (On track / At risk / No date), months remaining, monthly contribution needed, and gap vs surplus
- **Goals analysis summary banner** on goals page — total monthly needed, monthly surplus, and net coverage status
- **Dashboard goal cards enhanced** — monthly contribution needed + shortfall indicator shown inline per goal
- **Portfolio rebalancing engine** (`backend/app/portfolio_analysis/rebalance_engine.py`) — maps portfolio asset types to risk tiers (low_risk: bond/fund, growth: etf/stock/real_estate, high_risk: crypto), compares actual vs risk model target allocation, flags tiers deviating >5%
- **`GET /investors/{id}/portfolio/rebalance`** — returns `RebalanceResult` with per-tier actual/target/delta/action and rebalance_needed flag
- **Rebalancing guide card** on investments page — visual progress bars per tier with target marker, action labels (Reduce / Buy more / Hold), and rebalance status badge
- **Enhanced AI report context** — portfolio holdings summary (value, P&L, allocation, currency exposure) and goals analysis (per-goal status, monthly contributions, gap) now passed to Claude; two new report sections: Portfolio Analysis and Goals Progress
- **`portfolio_analysis` and `goals_progress`** keys added to AI report JSON; frontend reports page renders both new sections
- **17 unit tests** for goals_analysis engine (9 tests) and rebalance engine (8 tests) — 176 total passing

---

## [0.14.0] — 2026-04-27

### Added
- **Market scanner module** (`backend/app/market_scanner/`) — stateless engine that filters and ranks a curated catalog of 25 instruments (ETFs, stocks, crypto) against the investor's risk model, investment readiness classification, preferred assets, time horizon, experience level, and existing portfolio allocation
- **Curated instrument catalog** (`catalog.py`) — 25 instruments spanning 4 asset families (preservation, balanced, growth, speculative) and 4 markets (US, EU, GLOBAL, CRYPTO); covers bonds, index ETFs, sector ETFs, individual stocks, and crypto
- **Fit scoring engine** — 4-factor score (0–100): risk alignment (0–40), portfolio diversification gap (0–30), time horizon match (0–20), beginner suitability (0–10)
- **Hard safety filters** — `not_ready` returns empty list; `education_only` returns preservation-only; `blocked_strategy_families` (crypto, aggressive, speculative) and `age_tier` (retirement caps at moderate) enforced per risk model
- **`GET /investors/{id}/market-scan`** — returns ranked `InstrumentSuggestion` list with per-instrument rationale, plus `scan_notes` explaining applied filters
- **Market Scan page** (`/market-scan`) — ranked instrument cards with fit-score progress bar, color-coded risk/family/market badges, rationale text, and readiness banner
- **Sidebar "Intelligence" section** extended with Market Scan link
- **23 unit tests** for market scanner engine (159 total passing)

---

## [0.13.0] — 2026-04-27

### Added
- **Market data module** (`backend/app/market_data/`) — Alpha Vantage GLOBAL_QUOTE integration; on-demand price fetch per ticker; 24-hour DB cache in `price_snapshots` table (migration 0009); falls back gracefully when API key absent or ticker unavailable
- **`price_snapshots` table** (migration 0009) — `ticker`, `price`, `currency`, `fetched_at`; indexed on `ticker`
- **Live prices in portfolio analysis** — when a holding has a ticker with a fresh cache entry, portfolio engine uses live price instead of manual `current_value` or cost basis; `price_source` field (`"live"` / `"manual"` / `"cost_basis"`) added to each holding in the portfolio response
- **`POST /investors/{id}/portfolio/refresh-prices`** — force-refreshes all tickered holdings in an investor's portfolio, then returns updated portfolio summary
- **`GET /market/quote/{ticker}`** — fetch or return cached quote for any ticker; accepts `?force_refresh=true`
- **"Refresh prices" button** on investments page — triggers bulk price refresh, shows spinner during fetch; button only shown when accounts exist
- **Live price badge** on holdings table — green "Live" pill next to ticker when price is from market data; current price per unit shown in green below avg buy price column
- **`ALPHA_VANTAGE_API_KEY`** added to `Settings` in `config.py`; loaded from environment

---

## [0.12.0] — 2026-04-27

### Added
- **Holdings module** (`backend/app/holdings/`) — investors can manually add investment accounts (provider, account type, currency) and holdings (ticker, ISIN, name, asset type, quantity, avg buy price, currency, fees, purchase date, current value); full CRUD via REST API; audit-logged
- **Currency engine** (`backend/app/currency_engine/`) — FX rate fetching from `open.er-api.com` (free tier, no API key); cached in `currency_rates` DB table with 24-hour TTL; `convert(db, amount, from, to)` helper used by portfolio analysis
- **Portfolio analysis module** (`backend/app/portfolio_analysis/`) — stateless engine computing total value, unrealized P&L, asset allocation (%), and currency exposure (%) across all accounts; all holding values converted to investor's base currency via the currency engine
- **Investments page** (`/investments`) — account cards with collapsible holdings tables; add account + add holding inline forms; per-holding P&L badges; portfolio summary grid at top
- **Portfolio widget on dashboard** — shows total portfolio value + unrealized P&L + allocation breakdown when holdings exist
- **Sidebar "Portfolio" section** with Investments link
- **Alembic migrations** `0007_holdings` and `0008_currency_rates`
- **14 unit tests** for portfolio analysis engine (136 total passing)

---

## [0.11.0] — 2026-04-26

### Fixed
- CI "Create Release" job — CHANGELOG release notes were interpolated directly into the shell script, causing backticks and special characters in the notes text to be executed as shell commands; fixed by passing notes via `RELEASE_NOTES` env var and using `gh release create --notes-file` instead of `--notes`

---

## [0.10.0] — 2026-04-26

### Added
- **Investor profile new fields in creation form** — login page now includes optional "Investment Preferences" section with: `investment_goal` (select), `risk_tolerance` (select), `time_horizon` (select), `trading_frequency` (select), `preferred_assets` (chip toggles); all optional, sent as null if not selected
- **Investor profile edit page extended** — `/profile` page now displays and edits all 5 new fields; view mode shows them in a dedicated "Investment Preferences" section; edit mode uses selects + chip toggles for preferred assets

### Fixed
- Login page fetch URLs changed from `/api/v1/investors/` (trailing slash) to `/api/v1/investors` — fixes 404 regression under `redirect_slashes=False`
- Financial profile page blank screen when clicking "Create financial profile" — the create form was inside a `!showCreateProfile` guard, making it unreachable; restructured to a proper ternary
- `test_risk_modeling.py` updated to use new `age_tier` parameter (replacing removed `is_minor` kwarg) — all 122 tests now pass

### Documentation
- `docs/architecture.md` updated to v0.10.0: added `financial_decision` module, migration table (0005–0006), enforcement fields on risk model, decision engine section, full frontend page list, CI/CD pipeline steps
- `README.md` updated: added decision engine to feature list, added `/decision` endpoint to API reference, fixed trailing slash in investor collection URL, added `financial_decision` to project structure

---

## [0.9.0] — 2026-04-25

### Added
- **Routing fix** — changed all collection route decorators from `"/"` to `""` across 9 routers; `redirect_slashes=False` on FastAPI now works correctly end-to-end (investor profile creation no longer returns 404)
- **Investor profile extended fields** (migration 0005) — `investment_goal`, `risk_tolerance`, `time_horizon`, `preferred_assets`, `trading_frequency`, `guardian_required`; all nullable for backward compatibility
- **Age-based safety rules** in risk model engine — derives age tier from `date_of_birth`; minors (<18) get education-only allocation; retirement (60+) gets conservative tilt; pre-retirement (46–60) gets moderate conservative tilt
- **Risk model enforcement fields** (migration 0006) — `allowed_strategy_families`, `blocked_strategy_families`, `live_trading_allowed`, `requires_paper_trading`, `max_trade_size_pct`, `max_open_positions`, `age_tier`; computed deterministically from stability score + age + experience level
- **`financial_decision` module** — `GET /api/v1/investors/{id}/decision`; deterministic investment readiness engine; outputs `can_invest`, `readiness_classification` (ready / ready\_with\_limits / not\_ready / education\_only), `recommended_investment_pct`, `blocked_actions`, `required_actions`, `warnings`, `explanation`; stateless; logs `decision.evaluated` audit event
- **Investment Readiness card** on dashboard — readiness badge with icon, recommended capital %, warnings, required actions, blocked actions; empty state if no financial profile
- **14 unit tests** for the financial decision engine covering all readiness classifications, enforcement fields, and edge cases

### Changed
- CI workflow now automatically creates a GitHub release when all jobs pass and the version in `CHANGELOG.md` has not been released yet
- Docker images are now tagged with the explicit version number in addition to `latest` and `sha-*`
- Release creation is idempotent — pushing to `main` without bumping the version number does not create a duplicate release

### Documentation
- Created `docs/execution_plan.md` — Decision Engine Hardening phase plan with task status tracking
- Created `CLAUDE.md` and `docs/project_spec.md` — engineering rules and full product specification

---

## [0.8.0] — 2026-04-25

### Added
- Investor profile creation form on the login page — first-time users no longer need Swagger UI
- Investor creation auto-selects the new profile and redirects to the dashboard
- Empty-state on login page now opens the creation form automatically

### Fixed
- `docker-compose.yml` backend service now runs `alembic upgrade head` before starting uvicorn, so the DB schema is always in sync on first boot
- `docker-compose.yml` frontend service now uses a plain `node:20-alpine` image with `npm run dev`, eliminating the conflict between production Dockerfile and source-code volume mounts

### Documentation
- Created `CHANGELOG.md` (this file)
- Rewrote `README.md` with full setup and usage instructions
- Rewrote `docs/architecture.md` with current stack, module map, and API surface
- Created `docs/admin-guide.md` covering installation, configuration, and operations

---

## [0.7.0] — 2026-04-25

### Added
- **Risk page** (`/risk`) — view and generate the investor risk model; shows stability score, classification, capital breakdown, allocation tiers, and full history
- **Strategies page** (`/strategies`) — AI-recommended strategy cards with fit score, asset class badges, markets, time horizon; generate / regenerate button
- **Backtesting page** (`/backtesting`) — run form with template, period, and optional seed; sidebar list of past runs; detail panel with 6 metrics + portfolio value chart
- **Paper trading page** (`/paper-trading`) — create portfolios from strategy templates; advance-tick simulation; close portfolio; portfolio value chart over ticks
- **AI Reports page** (`/reports`) — generate a full AI financial report with 7 sections: summary, financial health, risk profile, strategy analysis, backtest insights, paper trading performance, recommendations
- **Audit log page** (`/audit`) — paginated list of all audit events with collapsible metadata; load-more button
- **Settings page** (`/settings`) — active session card, platform feature availability matrix, appearance note

### Commits
- `6b6d221` Add remaining dashboard pages: risk, strategies, backtesting, paper trading, reports, audit, settings

---

## [0.6.0] — 2026-04-25

### Added
- Next.js 14 frontend application with App Router and `(auth)` / `(dashboard)` route groups
- Login page with investor profile selector stored in `localStorage`
- Dashboard shell with sidebar navigation
- `useInvestorId` hook — reads `tradeops_investor_id` from localStorage, redirects to `/login` if absent
- UI component library: `Card`, `Badge`, `Button`, `Input`, `Select` using Tailwind + class-variance-authority
- `formatCurrency` and `formatPercent` utility functions
- Recharts integration for line charts (backtesting and paper trading)
- `public/.gitkeep` to ensure Docker `COPY --from=builder /app/public` succeeds in CI

### Fixed
- CI "Frontend Docker Image" job failure: `"/app/public": not found` caused by git not tracking empty directories
- Frontend `next.config.js` simplified to fix Docker standalone build issues

### Commits
- `b3ef97a` Add frontend UI shell and fix CI Docker build failures
- `7869126` Add public/.gitkeep so Docker COPY --from=builder /app/public succeeds

---

## [0.5.0] — 2026-04-25

### Added
- **AI analysis module** — Claude-powered financial report generator; produces 7-section narrative report covering financial health, risk profile, strategy analysis, backtest insights, paper trading performance, and recommendations
- **Paper trading module** — portfolio simulation engine; create portfolios from strategy templates; advance monthly ticks with simulated returns; close portfolios; full tick history
- `frontend/package-lock.json` added for reproducible CI installs

### Commits
- `21d54f0` Add AI analysis module (item 12)
- `ab79c97` Add paper trading module (item 11)
- `7288b76` Add frontend package-lock.json for reproducible CI installs

---

## [0.4.0] — 2026-04-25

### Added
- `backend/Dockerfile` — multi-stage Python 3.11 image (deps layer + final layer)
- `frontend/Dockerfile` — multi-stage Next.js image (deps → builder → runner with standalone output)
- `infra/docker-compose.yml` — PostgreSQL, backend, and frontend services with health-check dependency
- GitHub Actions CI workflow — runs backend tests and builds both Docker images on every push to `main`
- `.gitignore` files for backend (Python/virtualenv/alembic cache) and frontend (Next.js/node_modules)

### Commits
- `5e3e68d` Add Dockerfiles, .gitignore, and GitHub Actions CI workflow

---

## [0.3.0] — 2026-04-25

### Added
- **Backtesting module** — deterministic Monte Carlo–style simulation engine; runs strategy templates over configurable month periods with optional reproducible seed
- Backtest run DB model with period-level portfolio value snapshots
- 6 performance metrics per run: total return, annualised return, max drawdown, Sharpe ratio, win rate, final capital
- 22 pytest unit tests covering backtesting logic

### Commits
- `3a376be` Add backtesting module: deterministic simulation engine, DB models, and 22 tests

---

## [0.2.0] — 2026-04-25

### Added
- **Full backend application** with the following modules:
  - `investor_profiles` — CRUD for investor profiles (personal data, age, country, currency, experience, minor flag)
  - `financial_profiles` — income, expenses, savings, debts, assets, liabilities, emergency fund
  - `family_profiles` — household profiles with member management
  - `goals` — financial goals with target amounts, dates, progress tracking
  - `financial_scoring` — deterministic financial stability score engine (income ratio, emergency fund, debt-to-income, job stability)
  - `risk_modeling` — percentage-based risk allocation model tied to stability score
  - `strategy_library` — seeded strategy templates (6 templates from Education Mode to Active Trading)
  - `strategy_selection` — AI-assisted strategy ranking by investor suitability
  - `dashboard` — aggregated summary endpoint (net worth, capital, goals, risk)
  - `audit` — event logging for all significant actions
- Alembic migrations (0001 initial schema, 0002 strategy templates seed)
- Pydantic schemas for all domain objects
- SQLAlchemy models for all tables

### Commits
- `29d0c77` Add full backend: investors, financial profiles, goals, risk modeling, strategy library, strategy selection, dashboard, family profiles

---

## [0.1.0] — 2026-04-25

### Added
- Initial project structure: `backend/`, `frontend/`, `infra/`, `docs/` directories
- FastAPI application skeleton with `app/main.py`, `app/core/config.py`, database session and base model
- PostgreSQL database integration via SQLAlchemy + Alembic
- Initial `README.md` and architecture docs

### Commits
- `33322513` Initial commit
- `92c4b59` Initial project structure for TradeOps
- `e94f041` Readme update

---

[Unreleased]: https://github.com/erezrozenbaum/tradeops/compare/v0.15.0...HEAD
[0.15.0]: https://github.com/erezrozenbaum/tradeops/compare/v0.14.0...v0.15.0
[0.14.0]: https://github.com/erezrozenbaum/tradeops/compare/v0.13.0...v0.14.0
[0.13.0]: https://github.com/erezrozenbaum/tradeops/compare/v0.12.0...v0.13.0
[0.12.0]: https://github.com/erezrozenbaum/tradeops/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/erezrozenbaum/tradeops/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/erezrozenbaum/tradeops/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/erezrozenbaum/tradeops/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/erezrozenbaum/tradeops/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/erezrozenbaum/tradeops/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/erezrozenbaum/tradeops/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/erezrozenbaum/tradeops/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/erezrozenbaum/tradeops/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/erezrozenbaum/tradeops/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/erezrozenbaum/tradeops/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/erezrozenbaum/tradeops/releases/tag/v0.1.0

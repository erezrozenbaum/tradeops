# Changelog

All notable changes to TradeOps AI are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).  
Versions are assigned retroactively to match the git commit history.

---

## [Unreleased]

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

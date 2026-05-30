# Changelog

All notable changes to TradeOps AI are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).  
Versions are assigned retroactively to match the git commit history.

---

## [Unreleased]

## [3.30.0] — 2026-05-30

### Added
- **Behavioral Confidence Indicator** — read-only pre-flight advisory chip embedded in every staged order; computes a κ score (0.0–1.0) from the investor's historical decision quality and surfaces it alongside the existing pre-flight verdict without affecting it; four tiers: `HIGH_ALPHA` (κ≥0.75 + written thesis), `STANDARD` (κ≥0.65), `CAUTION_IMPULSE` (κ≥0.50), `HIGH_RISK_OVERRIDE` (κ<0.50) + `INSUFFICIENT_DATA` (<5 executed orders); `INSUFFICIENT_DATA` shows when the investor has fewer than 5 executed orders; `RECOMMEND_PAPER_TRADING` action surfaced at HIGH_RISK_OVERRIDE tier
- **`app/services/behavioral_indicator.py`** — new service with `compute_behavioral_metrics()` (gathers DQS, documentation alpha, override ratio, historical asset edge) and `evaluate_behavioral_confidence()` (deterministic κ formula); all external calls wrapped in `try/except` — behavioral chip never crashes the order creation flow; formula: `κ = (DQS/100) + (clamped_alpha/25 × 0.125) − (override_ratio × 0.25) − thesis_penalty − asset_penalty`; `historical_asset_edge` requires ≥5 executed buys of same asset_type with positive avg unrealized return
- **`PreFlightBehavioralShield.tsx`** — new frontend component; ShieldCheck (high confidence), ShieldAlert (caution/risk), ShieldQuestion (insufficient data); color-coded border/background per tier (emerald/amber/rose); rendered in expanded order view in Order Builder below existing pre-flight reasons

### Changed
- **`PreFlightReview` schema** — new optional `behavioral: BehavioralIndicator | None` field; fully backwards-compatible (existing orders return `null` for this field)
- **`_compute_pre_flight()`** — accepts new `rationale: str | None = None` param to determine `has_thesis` for the behavioral indicator; behavioral computation isolated in `try/except` so any failure is silent

## [3.29.0] — 2026-05-30

### Added
- **Smart Assist — DQS + Behavioral Alpha context** — `_build_context()` in `smart_suggest.py` now injects `dqs_score` (all-time DQS from `compute_monthly_dqs()` on executed orders) and `mistake_patterns` (list of active `pattern_key` values from `compute_behavioral_alpha()`); both are wrapped in `try/except` to not degrade suggestions if the modules have no data; the AI prompt rules section now directs Claude to address low DQS, conservative position sizing for `reactive_large_trade`, risk compliance for `blind_override`, and portfolio review for `undocumented_loss`; the deterministic fallback adds DQS-driven discipline nudges and pattern-specific suggestions
- **SIP Price-Alert Triggered Auto-Staging** — `trigger_on_alert: bool = False` field added to `PlanAllocation` schema (JSONB-backed, no migration); when checked in the Recurring Plans UI, the allocation's ticker is linked to any price alert for that ticker; new `price_alert_sip_trigger.py` worker (daily 20:45 UTC, 15 min after `price_alert_checker`) scans alerts triggered today, finds matching plan allocations with `trigger_on_alert=True`, stages a buy order per match; deduplication via `[alert_trigger:{alert_id}]` marker in order notes prevents re-staging on scheduler restarts; Bell icon badge shown on trigger-linked allocations in read-only plan view

### Changed
- **Smart Assist — prompt updated** — rules now explicitly reference `dqs_score` and `mistake_patterns` context keys; narrative must reference detected behavioral patterns if present; removed unused `current_high` variable (ruff F841)
- **`help/page.tsx` — converted to Server Component** — page had `"use client"` despite using no client APIs (no hooks, no browser globals, no event handlers other than `<Link>`); removing the directive makes it a true Next.js App Router Server Component, reducing the JS bundle for that route

### Infrastructure
- **Scheduler**: `price_alert_sip` job registered at 20:45 UTC; scheduler log updated to include new job name

## [3.28.0] — 2026-05-30

### Added
- **Active Broker Sync Drift Warnings** — broker sync drift is now a first-class signal surfaced in two places: (1) Morning Brief includes a `broker_sync_warnings` section listing all accounts with stale (25h+) or outdated (72h+) sync status; (2) Pre-flight review on new staged orders adds a "Stale broker data" risk entry for any account outdated ≥72h, pushing the verdict toward `caution`/`reconsider`; new `get_outdated_accounts(db, investor_id)` helper extracted from `broker_sync/status.py` for reuse
- **Outcome Calibration Dashboard** — `/outcome-calibration` page in the Intelligence sidebar section; aggregates executed orders' `outcome_snapshots` (populated by the daily outcome tracking worker) to compare projected vs actual tier allocations at 30, 90, and 180-day milestones; per-milestone summary cards with average accuracy score (0–100), tier comparison bars (projected → actual with delta), and a filterable per-order detail table; `GET /investors/{id}/staged-orders/calibration` endpoint returning `CalibrationOut` with milestone aggregates and individual order rows; accuracy score formula: `100 − avg(|proj_tier_pct − act_tier_pct|)` across the three risk tiers

## [3.27.0] — 2026-05-29

### Fixed
- **DQS consistency** — `reflection_report/_monthly_dqs` was computing a different DQS than `decision_intelligence/compute_decision_intelligence` for the same orders (proxy formula with hardcoded 7.5 for outcome correlation); both now use the canonical `compute_monthly_dqs()` function extracted from the Decision Intelligence service; Monthly Review DQS values now match the Decision Intelligence page exactly
- **`_risk_intelligence_score` return tuple** — 4th return value was `reconsider_total` duplicated; corrected to `reconsider_with_rationale` so callers can distinguish total overrides from documented overrides
- **Price guard in outcome correlation** — added `snap.price <= 0` guard in both `decision_intelligence/_outcome_correlation` and `behavioral_alpha/_price_orders` to prevent a division-by-zero on malformed price cache entries; `snap is None` was already guarded but `snap.price == 0` was not
- **`executed_at` filter on behavioral alpha** — `_get_executed_buys` now filters `executed_at IS NOT NULL`; orders marked executed without a timestamp can produce misleading price correlation results

### Refactored
- **`compute_monthly_dqs()`** — new public function in `decision_intelligence/service.py`; computes DQS for any subset of orders (single month or arbitrary slice) using the full four-component formula; `_dqs_history` and `_monthly_dqs` in reflection_report now both delegate to this function
- **`_dqs_history`** — simplified to call `compute_monthly_dqs` instead of inline four-component calculation

## [3.26.0] — 2026-05-29

### Added
- **Behavioral Alpha Dashboard** — measures how much decision-making behavior actually impacts returns using live price cache vs. entry price on executed buy orders; three alpha dimensions: Documentation Alpha (documented vs. undocumented), Goal Alignment Alpha (goal-linked vs. reactive), Risk Compliance Alpha (compliant vs. warning-override); Best/Worst decisions table with return %, rationale snippet, and badge tags; Mistake Pattern Detection (blind risk overrides, recurring undocumented losses, large reactive trades, systematic goal drift); `GET /investors/{id}/behavioral-alpha`; new `/behavioral-alpha` page in Intelligence section
- **Monthly Investor Reflection Report** — deterministic month-in-review narrative for any month with order activity; sections: headline, Decision Quality Score with delta vs. prior month, stats bar (total/executed/documented/goal-linked/cancelled/overrides), decision quality narrative, behavioral narrative, improvement focus for next month, achievements, watch list; month navigation (prev/next) with available month list; `GET /investors/{id}/reflection-report?month=YYYY-MM`; new `/reflection` page ("Monthly Review") in Intelligence section
- **Sidebar** — "Behavioral Alpha" (Activity icon) and "Monthly Review" (CalendarDays icon) added to Intelligence section

## [3.25.0] — 2026-05-29

### Added
- **Decision Intelligence / Decision Quality Score (DQS)** — 0–100 score measuring how an investor makes decisions, independent of market performance; four components: Documentation Discipline (0–35), Risk Intelligence (0–30), Goal Alignment (0–20), Outcome Correlation (0–15); Outcome Correlation uses live price cache (current price vs. entry price on executed buy orders) to show whether documented trades outperform undocumented ones; monthly DQS history with trend detection (improving / stable / declining); behavioral insight cards (up to 6, categorised as strength / warning / pattern / opportunity); coach notes (2–3 data-derived, non-generic improvement nudges); `GET /investors/{id}/decision-intelligence`; new `/decision-intelligence` page in Intelligence section
- **Paper Trading — Buy more button** — each open position on an active portfolio now has a "+ Buy more" button that pre-fills the trade form with the symbol and BUY side
- **Paper Trading — Reprice on completed portfolios** — Reprice button now visible for all portfolio statuses (not only active); backend `reprice_positions` no longer gates on `portfolio.status == active`; useful for reviewing P&L after ending a test
- **Paper Trading — Crypto support hint** — symbol field placeholder updated to `AAPL / BTC / ETH`; label extended with `stocks, ETFs, crypto`; backend has always supported BTC/ETH/SOL/etc. via CoinGecko routing
- **Paper Trading — No-price hint** — positions without a cached live price now show a dashed `no price — hit Reprice` badge instead of silently rendering without P&L

### Fixed
- **Financial Twin + Health Radar (500)** — `financial_twin/service.py` was accessing `m.short_term_count`, `m.medium_term_count`, `m.long_term_count`, and `m.avg_days_held` directly on `BehavioralMetrics`; those fields are nested under `m.holding_period_stats`; same bug existed in both `_behavioral_and_emotional` and `_tax_efficiency` functions
- **Performance Attribution (500)** — `attribution/service.py` was filtering `PriceSnapshot.investor_id == investor_id`; `PriceSnapshot` is a global cache table with no `investor_id` column; filter removed — query now fetches the most recently cached price globally

## [3.24.0] — 2026-05-29

### Added
- **Trade Journal** — decision capture and post-execution reflection for every staged order
  - Migration 0054: `rationale TEXT` and `reflection JSONB` columns on `staged_orders`
  - `StagedOrderCreate`: optional `rationale` field — saved with every staged order
  - `PATCH /investors/{id}/staged-orders/{order_id}/rationale` — add/edit rationale on an existing pending order
  - `GET /investors/{id}/staged-orders/journal` — returns all orders as `JournalEntryOut` with `pre_flight_verdict`, `rationale`, and `reflection`
  - `reflection` computed automatically on `mark_executed`: captures `preflight_verdict`, flagged risks, and whether a rationale was recorded; stored as JSONB for future analysis
  - **Order Builder** — "Why this trade?" `<textarea>` added to the Stage Order form (2-row, 2000-char limit, BookOpen icon)
  - **Paper Trading** — "Stage Real Order" button now opens a rationale capture modal before staging; rationale forwarded to the created `StagedOrder`
  - **`/journal` page** — new dedicated Trade Journal page in the Intelligence section; stats bar (total, with rationale, executed, caution/reconsider count); filter by all / with rationale / without rationale; per-entry: ticker, action, P&L verdict badge, pre-flight verdict, rationale (editable inline for pending orders), reflection card (green when documented, amber when not); goal link shown
  - **Sidebar** — "Trade Journal" (BookOpen icon) added to Intelligence section

## [3.23.0] — 2026-05-29

### Security
- **Next.js 14 → 16.2.6** — resolves 9 CVEs (SSRF CVSS 8.6, multiple high-severity DoS, HTTP request smuggling, XSS via CSP nonces and beforeInteractive scripts, cache poisoning); required async `params` migration in all 4 Next.js API route handlers; required `"use client"` on dashboard layout for `ssr: false` dynamic imports (Turbopack enforcement); ESLint updated 8 → 9; `eslint-config-next` updated to 16.2.6; `postcss` updated to `^8.5.10`
- **docker-compose.yml** — added `--legacy-peer-deps` to frontend `npm install` command

### Fixed
- **Light mode** — sidebar, mobile top bar, header strip, and footer were all rendering with hardcoded dark HSL values in inline `style` props, breaking light mode entirely; replaced with CSS variables (`--sidebar-from`, `--sidebar-to`, `--sidebar-border`, `--sidebar-divider`, `--topbar-bg`, `--topbar-border`); dark-mode values defined in `:root`/`.dark`, light-mode values in `.light`
- **Light mode narrative card** — `--narrative-bg` and `--narrative-border` now have `.light` values
- **Scrollbar** — hardcoded dark scrollbar now theme-aware (light variants added)
- **Sidebar nav hovers** — `bg-cyber-rule/60` (absolute dark navy) replaced with `bg-muted` (CSS-variable-driven) so hover states are readable in light mode
- **Behavioral risk detector** — silent `except Exception: continue` now logs a warning before skipping a failing detector

### Code Quality
- **broker_sync/parsers/ibkr.py** — removed `import xml.etree.ElementTree as _StdET` (B405 false positive); replaced `_StdET.ParseError` with `ET.ParseError` (defusedxml exposes it); bandit scan now clean

## [3.22.0] — 2026-05-28

### Added
- **Paper Position Price History** — `GET /paper-portfolios/{id}/positions/{pid}/price-history?period=1m|3m|6m` fetches real daily closes from Yahoo Finance for a paper position's symbol, filtered to dates on or after the entry date; returns `{symbol, entry_date, entry_price, points: [{date, price, return_pct}], current_price, total_return_pct}`
- **Inline position chart** — each position card now has a "Chart" toggle button; expands to show the stock's actual market price path since the paper buy date with a dashed entry-price reference line, green/red SVG polyline, period selector (1m/3m/6m), entry date + cumulative return label; results are cached client-side per position per period

## [3.21.0] — 2026-05-28

### Added
- **Paper Portfolio Name** — optional display name field on `PaperPortfolio`; `name` accepted in create form and via new `PATCH /investors/{id}/paper-portfolios/{id}` rename endpoint; name shown in list cards and detail header; migration `0053`
- **Per-position live P&L** — `GET /paper-portfolios/{id}` now returns `current_price`, `unrealized_pnl`, and `unrealized_pnl_pct` per position (fetched from price cache, FX-converted to portfolio currency); P&L badge shown inline on each position row
- **Position entry date** — `created_at` exposed in `PaperPositionOut`; displayed as "Bought: {date}" on each position row so users see exactly when they entered each paper trade
- **Reprice All button** — "Reprice" button in the portfolio header calls `POST /reprice` to fetch live market prices for all positions and recompute portfolio value
- **Stage Real Order** — "Stage Real Order" button per position calls `POST /positions/{id}/promote`; creates a `StagedOrder` (buy, live price, same quantity) in Order Builder for the user to review before committing real money
- **Rename portfolio modal** — pencil icon next to portfolio name opens an inline input; saves via `PATCH`; clears name (reverts to strategy name) when left blank
- **End Paper Test (renamed from Close)** — "Close" button renamed to "End Test" with an amber confirmation card explaining what the action does and suggesting "Stage Real Order" first; status shown as "Ended" in the list
- **Tick history chart** — simulation ticks rendered as an SVG polyline in the portfolio summary card; shows tick-by-tick value path with start/end labels; green when finishing above start, red otherwise
- **Promote audit trail** — `paper_trading.position_promoted` audit event logged when a position is staged as a real order

## [3.20.0] — 2026-05-28

### Added
- **Portfolio Snapshot Comparison** — `GET /investors/{id}/portfolio/comparison?period=1w|1m|3m` compares the latest portfolio snapshot against a prior one; returns value delta, % change, unrealized P&L delta, and per-asset-type allocation drift; new `/portfolio-comparison` page with period selector, value delta cards, P&L row, and allocation drift table
- **Morning Brief** — `GET /investors/{id}/morning-brief` aggregates overnight portfolio delta, goals health (on_track / at_risk counts), triggered price alerts, next recurring plan run, and active behavioral risk signals into a single lightweight response; new `/morning-brief` page surfacing all sections with Sun icon
- **Goal Progress Timeline** — `GET /investors/{id}/goals/{goal_id}/progress-timeline` returns last 12 months of GoalProgressLog data (planned vs actual), filling missing months with zeros; Goals page gains a BarChart2 button on each goal card that opens a modal with dual-bar month-by-month chart and legend
- **Staged Order Bulk Actions** — `POST /staged-orders/bulk-execute` and `POST /staged-orders/bulk-cancel` accept `{order_ids:[...]}` and act on each in sequence; Order Builder pending tab gains per-order checkboxes, Select All / Deselect All toggle, and a bulk action bar with Execute (N), Cancel (N), and Export CSV buttons
- **Sidebar** — "Portfolio Compare" (BarChart2) added to Portfolio section; "Morning Brief" (Sun) added to System section

## [3.19.0] — 2026-05-27

### Added
- **Goal Action Plan** — new `GET /investors/{id}/goals-analysis/action-plan` endpoint returns a prioritised per-goal monthly action list (priority high/medium/low, gap analysis, suggested asset type, message); Goals page now shows "This Month's Action Plan" card between the monthly summary banner and the budget plan; each row shows priority badge, goal name, message, monthly needed, and a "Stage" button that creates a staged order linked to the goal
- **Watchlist Sparklines** — `GET /investors/{id}/watchlist/sparklines` endpoint fetches 30-day daily closes from Yahoo Finance for all watched tickers; Watchlist page renders inline SVG sparklines per card with 30-day % change (green/red); sparklines load in background after initial data fetch
- **Watchlist Stage Buy** — each watchlist card now has a "Stage Buy" inline action: clicking opens an amount input and stages a buy order for the ticker directly from the watchlist

## [3.18.0] — 2026-05-27

### Added
- **Recurring Investment Plans (SIP)** — `/recurring-plans` page; create monthly or weekly auto-staging plans with named allocations (ticker, asset type, amount, currency, goal link); each plan tracks next/last run; "Run now" button manually triggers staging; active/paused toggle; full CRUD via `GET/POST/PUT/DELETE /investors/{id}/recurring-plans`; background job `recurring_plans` at 06:30 UTC auto-stages orders for all due plans; orders are staged (not executed) — investor reviews in Order Builder before acting
- **Backend: `app/recurring_plans/`** — migration 0052 (`recurring_investment_plans` table), `RecurringPlan` model, service (CRUD + `run_plan()` + `_compute_next_run()`), router; worker job `app/workers/jobs/recurring_plans.py`
- **Sidebar** — "Recurring Plans" added to Portfolio section primary items (CalendarClock icon)
- **Holdings CSV Export** — "Export CSV" button on Investments page; exports all accounts' holdings (ticker, name, type, quantity, avg buy price, current value, currency) as `holdings-{date}.csv`
- **Transactions CSV Export** — "CSV" download button on Transactions page; exports complete transaction log (date, type, ticker, asset, qty, price, total, fees, currency, notes) as `transactions-{date}.csv`

### Fixed
- Price alerts URL bug in Notifications page — was calling `/price-alerts` (404), corrected to `/alerts`

## [3.17.0] — 2026-05-27

### Added
- **Notification / Alert Engine** — `GET /investors/{id}/notifications` now surfaces goal milestone notifications (50%, 75%, complete) alongside existing danger/warning alerts; fixed field-name bug (`g.id`/`g.name` in `center.py`) that was silently swallowing goal notifications; price alert triggers (above/below) show as `warning` notifications in the feed; behavioral risk + drift insight + option-expiry notifications fully wired
- **Broker Sync Status Dashboard** (`/broker-sync`) — new page showing per-account sync health cards (name, provider, last synced, holding count, Fresh/Stale/Outdated/Never badge, auto-sync toggle state) plus a **Pending Order Drift** table matching each pending staged order against the current holding quantity/value; last global price refresh timestamp shown in header
- **Price Alerts Management UI** — Price Alerts section added to the Notifications page: create form (ticker, asset name, condition above/below, target price, currency), active alerts list with delete, triggered alerts history; calls existing `GET/POST/DELETE /investors/{id}/price-alerts` endpoints
- **Backend: Broker Sync Status service** (`app/broker_sync/status.py`) — `get_sync_status()` aggregates per-account sync metadata, pending order drift, and last `PriceSnapshot` fetch time; `_sync_status_label()` classifies freshness as fresh (<25h), stale (<72h), outdated (≥72h), never
- **Sidebar** — "Sync Status" link added to Portfolio section secondary items pointing to `/broker-sync`

## [3.16.0] — 2026-05-27

### Added
- **Outcome Snapshot Worker** (`workers/jobs/outcome_tracking.py`) — daily job at 22:00 UTC that populates `outcome_snapshots` on executed staged orders at the 30 / 90 / 180-day milestones; reads the latest portfolio snapshot and computes actual tier allocation (low_risk / growth / high_risk) from `asset_allocation`; closes the projected-vs-actual loop in Outcome Tracking
- **Smart Allocation Assistant** — new `POST /staged-orders/smart-suggest` endpoint backed by Claude Haiku; gathers portfolio state, risk model, goals, behavioral risk events, and maturity stage; returns 3-5 prioritised allocation suggestions with rationale, ticker, estimated value, and goal linkage; deterministic rule-based fallback when `ANTHROPIC_API_KEY` is absent; AI usage logged to `ai_usage` table
- **Order Builder UI** — "Smart Assist" button (violet, `Wand2` icon) added to Portfolio Surgery panel; opens `SmartAssistPanel` below showing AI narrative + suggestion cards with action badge, priority chip, rationale, and per-suggestion "Stage" button that creates a staged order directly from the suggestion

## [3.15.0] — 2026-05-27

### Added
- **README screenshots** — four dark-mode screenshots added to the Highlights section: Command Center, Dashboard, Order Builder, Simulation (Monte Carlo)
- **Collapsible sidebar** — all sections (Personal, Strategy, Portfolio, Intelligence, System) now collapse/expand on click; section containing the active route auto-expands on navigation; secondary items grouped behind a "X more" toggle per section
- **Sidebar: Order Builder and Simulation prominent** — both now appear in the primary (always-visible) item list of their sections; "Financial Futures" renamed to "Simulation" for clarity

### Fixed
- **Command Center HTTP 500** — `action_engine.py` `_contribution_actions` referenced `HoldingTransaction.executed_at` which does not exist; correct field is `transaction_date` (`date` type); cutoff now uses `.date()` to match

### Changed
- **README** — GitHub Stars badge added; Buy Me a Coffee button added; Highlights section added with screenshot grid and 5 key feature callouts

## [3.14.1] — 2026-05-27

### Fixed
- **Command Center HTTP 500** — `orchestrator.py` was sharing a single SQLAlchemy Session across 7 concurrent `ThreadPoolExecutor` threads; SQLAlchemy 2.x sessions are not thread-safe, causing intermittent 500 errors. All DB fetches now run sequentially on the request Session; the only blocking I/O (Claude AI call) is separately isolated and unchanged.

### Security
- Added `SECURITY.md` — vulnerability reporting policy, known CVE status and mitigations, threat model, security architecture reference; documents starlette PYSEC-2026-161 (cannot fix: `prometheus-fastapi-instrumentator 7.x` requires `starlette<1.0.0`; tracked for resolution when upstream ships starlette 1.x support) and Next.js 14.x CVEs (require Next.js 16 upgrade; mitigated by local-only deployment model)

### Added
- `CONTRIBUTING.md` — development setup, code standards, PR process, financial safety rules for contributors
- `deploy.sh` — Linux / macOS bash equivalent of `deploy.ps1`: system checks (Docker, disk, RAM), automatic secret generation (JWT / DB / Redis), optional Anthropic API key prompt, Docker build + launch, health checks, stop / update / reset / monitoring modes
- `docs/admin-guide-he.md` — full Hebrew admin guide with RTL layout (`<div dir="rtl">`): all 13 sections translated including migration history, deployment, troubleshooting, feature reference

### Changed
- Updated `deploy.ps1` banner version from v3.5.0 to v3.14.0
- `README.md`: added Deployment section (Windows + Linux/macOS), Staged Allocations & Order Builder feature table, SECURITY.md and CONTRIBUTING.md links; schema.md reference updated from 40-migration to 50-migration history

## [3.14.0] — 2026-05-27

### Added
- **Template Library** on `/order-builder` — save any set of pending orders as a named reusable template (e.g. "Monthly DCA", "60/40 Rebalance"); templates persist per investor; one-click "Apply Template" re-stages all orders in the set with full pre-flight review; delete button with usage counter and last-applied date
- **Outcome Tracking** — after marking an order executed, `projected_metrics` JSONB (portfolio value, tier allocation, goal progress) is captured at staging time as a baseline; `outcome_snapshots` JSONB stores actual portfolio metrics at 30d/90d/180d intervals; Outcome History section on the order-builder page shows projected vs actual side-by-side per executed order; snapshots displayed as amber cards labelled by day count
- Backend: `OrderTemplate` model + `order_templates` table (migration 0051); `staged_orders.outcome_snapshots` JSONB column; `app/staged_orders/templates.py` (save/apply/delete); `GET /staged-orders/outcomes` endpoint; template endpoints (`GET/POST /templates`, `POST /templates/{id}/apply`, `DELETE /templates/{id}`)

## [3.13.0] — 2026-05-27

### Added
- **Order Builder** (`/order-builder`) — full staged allocations and portfolio surgery platform:
  - **Portfolio Surgery panel**: visual before/after allocation bars per risk tier (Low Risk / Growth / High Risk) with target marker; shows actual %, gap amount, and overweight/underweight direction
  - **Minimum-Trade Rebalancing**: "Generate Minimum Orders" button calls `/staged-orders/generate-rebalance` — computes minimum set of trades to reach risk-model targets, sequences sells before buys (tax-efficient), creates all orders atomically
  - **Pre-flight AI Review**: every staged order gets a structured deterministic analysis — reasons to proceed, risks, alternative suggestion, and a proceed/caution/reconsider verdict; sourced from portfolio + risk model data, no raw AI call
  - **Tax-Optimized Sequencing**: sell orders flagged with P&L direction (loss-harvest opportunity vs taxable gain), wash-sale proximity warning (repurchase within 30 days of same ticker sell)
  - **Goal-Linked Execution**: each order optionally links to a `FinancialGoal`; projected goal progress shown on the order card
  - **Outcome Tracking (seed)**: `projected_metrics` JSONB stored at staging time — portfolio value, tier allocation percentages, goal progress; feeds v3.14.0 outcome comparison
  - **Order Queue**: tabbed view (Pending / Executed / Cancelled) with counts; per-order "Mark Executed" and "Cancel" actions; buy/sell total summary strip
  - **Audit logging**: all create / execute / cancel actions emit `staged_order_*` audit events
  - Backend: migration 0050 (`staged_orders` table), `app/staged_orders/` module (schemas, service, router)
  - API: `GET /staged-orders`, `POST /staged-orders`, `POST /staged-orders/generate-rebalance`, `POST /staged-orders/{id}/execute`, `DELETE /staged-orders/{id}`
  - Sidebar: "Order Builder" link added to Portfolio section (between Investments and Rebalance)

## [3.12.1] — 2026-05-27

### Fixed
- **Command Center HTTP 500** — `action_engine.py` and `command_center_checkpoint.py` were querying `InvestmentHolding.investor_id` which does not exist; fixed by joining through `InvestmentAccount` (`InvestmentHolding.account_id → InvestmentAccount.id`) and filtering on `InvestmentAccount.investor_id`
- **React hydration errors #418/#423** — `NotificationBell` and `NextBestActionBar` read `localStorage` which is unavailable during SSR; fixed by importing both with `next/dynamic({ ssr: false })` in `layout.tsx`

## [3.12.0] — 2026-05-27

### Added
- **Next Best Action bar** (`NextBestActionBar`) — persistent contextual strip shown on every page except Dashboard, Command Center, and Onboarding:
  - Fetches `/action-feed` and surfaces the single highest-priority unactioned item (P1 or P2 only)
  - Shows: priority dot (red/amber), action-type badge with icon, title + ticker, item counter (`n/total`)
  - Expand chevron reveals full reasoning text inline
  - "Act →" CTA routes to the relevant page based on signal source (`rebalancing → /rebalance`, `goals → /goals`, `proactive_insights → /insights`, `price_alerts → /investments`, `market_signals → /market-scan`)
  - "next" button cycles through remaining urgent items
  - Per-item dismiss (×) with `localStorage` persistence (`tradeops_dismissed_nba`)
  - Severity-coded background accent per action type
  - Zero new backend calls — reuses existing `/action-feed` endpoint

## [3.11.0] — 2026-05-27

### Added
- **Notification Bell** — persistent bell icon in desktop header strip and mobile topbar, with:
  - Red badge showing count of unread danger/warning alerts
  - Dropdown panel (max 6 items) with severity icon, title, message, and optional deep-link
  - Per-item dismiss (×) button; dismissed IDs persisted in `localStorage` (`tradeops_dismissed_notifications`)
  - "View all notifications" footer link to `/notifications` page
  - Zero new API calls — feeds from existing `GET /investors/{id}/notifications` endpoint
- **Desktop header strip** — thin 48px `h-12` header bar added to the desktop layout (above all pages, `lg:pt-12`), housing the notification bell; replaces blank header space on desktop
- **Setup Guide sidebar link** — `/onboarding` added to System section as "Setup Guide" entry (Sparkles icon)
- **Goals page MetricTooltip** — "Total monthly needed" label and per-goal "Needs X/mo" line now have "Why this matters" tooltips explaining the funding gap concept
- **Dashboard SmartEmptyState** — "Guided setup →" link (Sparkles icon) added alongside the get-started cards, pointing to `/onboarding`

## [3.10.0] — 2026-05-26

### Added
- **MetricTooltip expansion** — "Why this matters" tooltips applied across all major insight pages:
  - **Command Center** (`StatusHeader`) — Financial Twin score (8-dimension explanation), Stability score explanation
  - **Risk Model page** — Investable Capital, Max Drawdown, and all three allocation tiers (Low Risk, Growth, High Risk) now have contextual explanations
  - **Backtesting page** — Annualised Return, Max Drawdown, Sharpe Ratio, and Win Rate metrics now have explanations helping users interpret simulation results
- **AI Thought Partner depth** (`AIThoughtPartnerCard`) — collapsible "What your AI is seeing right now" panel added beneath the AI summary:
  - Twin score 7-day delta with trend icon (green up / red down)
  - Active behavioral risk count with direct link to `/behavioral-risk`
  - Up to 3 notable evolution items (critical/alert/warning severity) as `DeltaChip` cards with severity-coded borders
  - Link to full AI assessment history (`/ai-history`)
  - Data sourced from existing Command Center report fields (`evolution_feed`, `twin_score_delta_7d`, `active_behavioral_risk_count`) — no additional API calls
  - Advisor view (`/advisor-view`) also updated to pass new props
- **Onboarding wizard** (`/onboarding`) — new guided setup page:
  - 4-step flow: Profile → Financial Data → Goals → Risk Model
  - Fetches `/dashboard` + `/risk-model` on load to detect which steps are already complete
  - Progress bar with percentage; auto-selects first incomplete step
  - `StepCard` component — icon, title, description, "Unlocks" expandable box, CTA link
  - Completion state: "You're all set" messaging with green CTA to Command Center
  - Sets `tradeops_onboarding_dismissed` localStorage key on finish/skip

## [3.9.0] — 2026-05-26

### Added
- **Financial Life Timeline** (`/timeline`) — complete rewrite of the existing decision timeline page into a full narrative experience:
  - **Score evolution strip** — three sparkline cards (Twin Score, Maturity Score, Net Worth) with delta vs previous snapshot; recharts `LineChart` with tooltip; renders only when history data exists
  - **AI Assessment cards** — AI memory entries injected into the timeline at their `summary_at` timestamp; show metric pills (twin score, stability, EF months, maturity stage) and expandable full narrative text
  - **Unified event feed** — merges four data sources client-side: `/timeline`, `/command-center/ai-memory`, `/command-center/score-history`, `/net-worth/history`; sorted chronologically, deduplicated by type
  - **Month grouping** — events grouped by calendar month with event count badge; replaces day-by-day grouping for longer time ranges
  - **Behavioral risk events** — severity-coded left border accent (red = high, amber = medium) with evidence and recommendation surfaced inline
  - **Causal notes** — downstream portfolio impact annotations shown on relevant events (e.g. "followed by −6.2% drawdown over 7 days")
  - **Time range selector** — 1m / 3m / 6m / 1yr; all four data sources re-fetch together on change
  - **Event-type filters** — All | AI Recs | Coach | Rebalance | Transactions | Behavioral | Assessments
  - **Refresh button** with spinner; calm empty state with filter-clear CTA
- **README** — Dashboard Intelligence (v3.8.0) and Financial Life Timeline (v3.9.0) sections added to features table; version badge updated to 3.9.0

## [3.8.0] — 2026-05-25

### Added
- **Narrative header** — personalized 2–3 sentence financial snapshot at the top of the dashboard; composed deterministically from loaded data (stability score, emergency fund, goal status, portfolio P&L); no extra API call; updates with every data load
- **"Why this matters" tooltips** — `MetricTooltip` component (new `components/ui/metric-tooltip.tsx`) wraps key metrics with a `ⓘ` icon that shows a plain-English explanation on hover/click; applied to all 4 stat cards (Net Worth, Liquid Capital, Monthly Surplus, Emergency Fund), Financial Stability card title, Risk Allocation card title, and Max Drawdown label
- **Progressive disclosure** — "Show full picture" toggle below the Stability + Risk section; collapses Investment Readiness, Portfolio, Goals, Pension, Retirement, Earnings, and News into an expandable section; preference persisted in localStorage
- **Smart empty state** — replaces the generic "complete your profile" message with three actionable setup cards (Add finances / Set goals / Generate risk model), each describing exactly what it unlocks
- **Design token pass** — spacing scale (`--space-1` through `--space-12`) and narrative card CSS variables added to `globals.css`; `StatCard` gains optional `tooltip` prop

## [3.7.0] — 2026-05-24

### Fixed
- **Dev compose static assets** — standalone server (`node .next/standalone/server.js`) now copies `.next/static` and `public` into the standalone output directory before startup; previously all JS chunk requests returned 404, causing a ChunkLoadError and React error #423 on first load

### Added
- **Tax Summary CSV export** — "CSV" download button on the Tax Summary page; generates a two-section CSV (Realized Transactions + Dividends) from data already loaded in the browser; no new backend endpoint
- **Goals Monthly Budget Plan** — dedicated "Monthly Budget Plan" card below the existing summary banner on the Goals page; shows each goal's required monthly contribution as a share of the total with a per-goal progress bar and on-track/at-risk color coding
- **Dark / Light mode toggle** — theme switcher button in the sidebar footer (Sun/Moon icon); persisted via `next-themes`; dark remains the default; `.light` CSS variable block added to `globals.css`; dot-grid background is dark-mode-only
- **Portfolio Rebalancing page** (`/rebalance`) — new page calling the existing `GET /portfolio/rebalance` backend endpoint; shows a status banner, per-tier allocation bars (actual vs target with deviation), money gap amounts, and expandable suggested trade cards; "Rebalance" entry added to sidebar under Portfolio

## [3.6.0] — 2026-05-24

### Added
- **`deploy.ps1`** — fully automated Windows production deployment script; covers system checks (Windows build ≥ 19041, disk ≥ 15 GB, RAM), Docker Desktop install/start, cryptographic secret generation, Anthropic API key setup with step-by-step instructions, optional Alpha Vantage key and Gmail SMTP, image build, health checks, and browser launch on success
- **`infra/docker-compose.deploy.yml`** — production-mode Docker Compose file separate from the dev compose; no source volume mounts; backend runs `alembic upgrade head` + `uvicorn` 2 workers; frontend built from Dockerfile with `NEXT_PUBLIC_API_URL=http://backend:8000`; Redis with AOF persistence; proper healthchecks with `start_period` on all services
- **`.env.deploy`** (gitignored) — auto-generated secrets file written by `deploy.ps1`; contains `POSTGRES_PASSWORD`, `SECRET_KEY`, `ANTHROPIC_API_KEY`, and optional SMTP/market-data keys

## [3.5.0] — 2026-05-24

### Added
- **AI Memory Timeline** (`/ai-history`) — dedicated page surfacing the rolling 3-month `ai_memory_entries` history; shows each AI assessment with its key metrics snapshot (twin score, stability, EF months, net worth), expandable text, and a time-window filter (1/3/6/12 months)
- **`GET /investors/{id}/command-center/ai-memory`** — new endpoint returning paginated AI memory entries with key metrics; `months` query param (1–12)
- **Score History** (`/score-history`) — chart page showing how Twin Score, Investor Maturity composite score, and all 8 twin dimensions evolved over time (1–12 months); uses recharts LineChart with summary stats (current, change, high, low)
- **`GET /investors/{id}/command-center/score-history`** — new endpoint querying `financial_twin_snapshots` and `investor_maturity_snapshots`; returns chronological arrays for charting
- **Command Center PDF Download** — "PDF" button in the Command Center header triggers a `GET /investors/{id}/command-center/pdf` download; generates a reportlab PDF snapshot with financial overview, AI assessment, priority actions, health radar dimensions, and goal progress
- **`generate_command_center_pdf()`** in `pdf_generator.py` — new function distinct from the portfolio PDF; renders the Command Center report into a structured A4 document
- **`GET /investors/{id}/command-center/pdf`** — new streaming endpoint in `command_center/router.py`
- **Onboarding Wizard** — guided setup overlay on the Command Center page for new users with no data (detected via `composite_score == 0` and empty evolution feed); shows 4 actionable steps (profile → financial → goals → refresh); dismissible via localStorage flag `tradeops_onboarding_dismissed`
- **Sidebar entries** — "AI Memory" (`/ai-history`) and "Score History" (`/score-history`) added under Intelligence section

## [3.4.0] — 2026-05-23

### Added
- **Advisor Share** — investors can generate a read-only, time-limited link to their Command Center snapshot to share with a trusted financial advisor; token-scoped, expires in 7 days, no write access, revocable at any time
- **`advisor_share_tokens` table** (migration 0049) — `id`, `investor_id` (FK CASCADE), `token` (VARCHAR 64, unique), `created_at`, `expires_at`, `revoked`; indexes on `token` and `(investor_id, revoked, expires_at)`
- **`AdvisorShareToken` ORM model** (`models/advisor_share_token.py`)
- **`advisor_share` module** — `service.py` (`create_token`, `revoke_token`, `list_active`, `get_valid`), `schemas.py` (`AdvisorShareOut`, `AdvisorShareListOut`, `AdvisorShareSnapshot`), `router.py` (investor-scoped + public router)
- **3 investor-scoped endpoints** under `/investors/{id}/advisor-share`: `POST` (create), `DELETE /{token}` (revoke), `GET` (list active)
- **Public endpoint** `GET /advisor-share/{token}` — no auth required; validates token, returns full `CommandCenterReport` + investor name + expiry; returns 404 for expired or revoked tokens
- **Share button + modal** on Command Center page — "Share" button opens a modal to create new links, copy share URLs to clipboard, and revoke existing links; shows token prefix and expiry date
- **`/advisor-view/[token]`** — public read-only page; "Advisor View — Read Only" sticky banner; shows investor name, expiry, full Command Center report using existing components; error state for expired/revoked links; no auth required

## [3.3.0] — 2026-05-23

### Added
- **Mobile bottom navigation bar** (`BottomNav.tsx`) — fixed 5-tab bar (Home → `/command-center`, Actions → `/insights`, Health → `/health-radar`, Report → `/agent`, Profile → `/profile`); visible only on mobile (`lg:hidden`); active tab highlighted; layout updated with `pb-16 lg:pb-0` so content is never obscured
- **Swipe-left to dismiss ActionCard** — on mobile, swipe left ≥ 80px to dismiss an action card for 30 days; dismissed state persisted in `localStorage` (`tradeops_dismissed_actions`); "Dismiss 30d" hint revealed as card slides; cards auto-expire after 30 days
- **Collapsible Command Center sections** — all 7 content sections (Actions & Evolution, Risks & Futures, Goals & Health, Twin Insights, Counterfactual Replay, AI Thought Partner, Progression) now have a collapse toggle; user preference persisted in `localStorage` (`tradeops_cc_collapsed`); smooth `max-height` CSS transition; chevron rotates to indicate state
- **`CollapsibleSection` component** (`components/ui/CollapsibleSection.tsx`) — reusable collapsible wrapper with localStorage persistence, accessible `aria-expanded`, smooth animation

### Changed
- `ActionsPanel.tsx` — swipe-dismiss logic added to `ActionCard`; "Swipe left to dismiss" hint shown on mobile only
- `DashboardLayout` — `pb-16 lg:pb-0` added to main content area for bottom nav clearance

## [3.2.0] — 2026-05-23

### Added
- **Household View** (`/household`) — investors can create or join a household to see a combined financial view with a partner; shows combined net worth, combined portfolio value, combined monthly surplus, total active behavioral risks, and per-member cards (maturity stage, twin score, stability classification)
- **`households` table** (migration 0048) — `id`, `name`, `created_at`, `updated_at`
- **`household_id` FK on `investor_profiles`** (migration 0048) — nullable `UUID → households.id ON DELETE SET NULL`; zero impact on existing rows
- **`Household` ORM model** (`models/household.py`) — bidirectional relationship with `InvestorProfile.members`
- **`household` module** (`household/`) — `service.py` (create, join, leave, summary, aggregate metrics), `schemas.py`, `router.py`
- **5 new endpoints** under `/investors/{id}/household`: `POST /create`, `POST /join/{household_id}`, `DELETE`, `GET`, `GET /aggregate`
- **Household page** — create/join panel with UUID copy-to-clipboard for sharing; aggregate metric cards; per-member twin/stability summary cards; leave button
- **Sidebar** — "Household" added under Personal section

## [3.1.0] — 2026-05-23

### Added
- **Longitudinal AI Memory** — AI Thought Partner now has a rolling 3-month memory of past portfolio assessments; Claude references specific metric changes ("Three months ago your emergency fund was 1.2 months; now it's 2.1 months") when the history is available
- **`ai_memory_entries` table** (migration 0047) — stores `portfolio_assessment` text + `key_metrics` JSONB snapshot (twin score, maturity stage, stability score, ef_months, net_worth) per investor per AI call
- **`AIMemoryEntry` ORM model** (`models/ai_memory_entry.py`) — maps to the new table; CASCADE-deleted when investor is removed
- **`ai_memory` service** (`command_center/ai_memory.py`) — `write_entry()` / `get_recent(months=3, limit=12)` — clean API for memory reads and writes
- **Memory injection** — `_build_context()` in `engine.py` fetches recent memories and injects them as `past_summaries`; never fabricates history when entries are absent
- **Auto-write after live AI call** — orchestrator writes a memory entry (with key_metrics snapshot) immediately after any successful live Claude call; cache hits do not create duplicate entries

## [3.0.0] — 2026-05-23

### Added
- **Nightly Command Center AI pre-compute** (`workers/jobs/command_center_nightly.py`) — daily at 05:00 UTC (after twin + behavioral risk jobs); calls `run_agent("standard")` for every investor and stores the result in Redis (`cc_ai:{id}:standard`, 26h TTL); Command Center page now serves instantly from cache instead of blocking on a 2–4s Claude call
- **Redis AI summary cache** (`command_center/ai_cache.py`) — `get_cached()` / `set_cached()` / `invalidate()`; falls back transparently to live call when Redis is unavailable or cache is cold; lazy-caches beginner/advanced verbosity on first request
- **Weekly Command Center checkpoints** (`workers/jobs/command_center_checkpoint.py`) — runs Monday 04:00 UTC; writes a `command_center_checkpoints` row per investor capturing twin score, maturity score, stability score, net worth, behavioral discipline, financial resilience, active risk count, and top concentration %; idempotent (skips if row already exists for the checkpoint hour)
- **`CommandCenterCheckpoint` ORM model** (`models/command_center_checkpoint.py`) — SQLAlchemy model for the table created in migration 0046
- **Critical push notifications** — two new in-app notification types added to `notifications/center.py`: emergency fund < 1 month (danger severity, `critical_ef_below_1m`) and highest active HIGH behavioral risk (danger severity, `critical_behavioral_{event_type}`); both appear instantly in the Notifications panel

### Changed
- **Weekly digest schedule** moved from Friday 18:00 UTC to **Monday 08:00 UTC** — start-of-week briefing timing
- **Command Center orchestrator** — AI summary now checks Redis cache before calling Claude; result cached after any successful live call; no change to API contract

## [2.9.0] — 2026-05-23

### Added
- **Goal Progress Panel** (`GoalProgressPanel`) — top-2 goals surfaced directly on the Command Center; sorted by urgency (at-risk first, then largest relative gap); shows progress bar, status badge, months remaining, and required monthly contribution for at-risk goals
- **Goal-Aware Action Engine** — `_goal_actions()` rule added; at-risk goals with `progress_pct < 50` generate a high-severity action slot ("goals" category); the highest-priority at-risk goal competes in the top-3 action ranking alongside safety, behavior, and portfolio signals
- **Goals fetched in parallel** — `_fetch_goals()` added to the orchestrator's `ThreadPoolExecutor` (now 7 workers); no added latency since goal analysis already runs in background
- **`GoalProgressItem`** schema added to `CommandCenterReport`; `goal_progress: list[GoalProgressItem]` field added to the report

### Changed
- Command Center layout: Goal Progress + Health Radar now share a row (row 3); Twin Insights moved to its own row below for better visual balance

## [2.8.0] — 2026-05-23

### Added
- **Financial Command Center** (`/command-center`) — primary landing screen replacing the dashboard as the first meaningful destination; answers "What should I focus on next, and why?" with a unified intelligent daily view
- **Action Prioritization Engine** (`command_center/action_engine.py`) — deterministic rule engine ranks up to 3 highest-impact actions from existing data (emergency fund gap, active behavioral risks, concentration exposure, contribution gaps); actions adapt copy style to investor's maturity stage (plain → institutional)
- **7-Day Evolution Feed** (`command_center/evolution.py`) — computes deltas across Twin snapshot, Maturity snapshot, and Behavioral Risk events vs 7 days ago; surfaces negatives first, suppresses sub-threshold noise; shows causal explanation for discipline+ stages
- **Counterfactual Replay Selector** (`command_center/replay_selector.py`) — picks the highest-delta counterfactual simulation from saved runs and surfaces it as a one-line insight on the Command Center
- **Command Center Orchestrator** (`command_center/orchestrator.py`) — parallel ThreadPoolExecutor fetch across 6 data sources; AI Thought Partner summary runs serially after context is assembled
- **`GET /investors/{id}/command-center`** — full aggregated report (all sections); `?verbosity=beginner|standard|advanced` param
- **`useMaturityVariant` hook** — maps maturity stage to a typed config controlling which sections and copy style each component renders; centralizes all maturity logic outside component code
- **StatusHeader** — Twin score + 7-day delta + maturity stage chip + stability/net-worth/behavioral-risk trend pills
- **ActionsPanel + ActionCard** — severity-coded action cards with impact badges; optional rationale shown for discipline+ stage
- **EvolutionFeed** — 7-day delta feed with directional icons; color-coded by severity
- **HealthRadarCard** — recharts RadarChart with 8-dimension health axes; links to `/health-radar`
- **TwinInsightsCard** — animated horizontal bar charts for positive drivers and drag factors; drag factors hidden for foundation stage
- **BehavioralRisksPanel** — active behavioral risk cards with severity badge and recommendation; links to `/behavioral-risk`
- **FuturesPreviewCard** — simplified 3-path LineChart from cached simulation runs; hidden (replaced by gated placeholder) for foundation stage
- **ReplayHighlightCard** — surfaces best counterfactual insight with estimated delta %; hidden for foundation/discipline stages
- **AIThoughtPartnerCard** — maturity-adapted AI portfolio assessment with inline verbosity toggle (Simplified / Standard / Detailed); re-fetches on toggle
- **ProgressionCard** — stage track with 4 checkpoints, composite score, unlocked features list, and next unlock target
- **Migration 0046** — `command_center_checkpoints` table (weekly snapshot anchor for future evolution feed precision)
- **Sidebar** — Command Center added as first navigation item above Dashboard
- **README** — version badge updated to 2.8.0; Financial Command Center section added to feature table

## [2.7.1] — 2026-05-23

### Security
- **Next.js 14.2.25 → 14.2.35** — resolves GHSA-5j59-xgg2-r9c4 (DoS via Server Components incomplete fix) and GHSA-mwv6-3258-q52c (DoS via Server Components)
- **starlette ≥1.0.1** — resolves PYSEC-2026-161 (SSRF via malformed HTTP headers, CVE score HIGH)
- **idna ≥3.15** — resolves PYSEC-2024-114 (ReDoS in IDNA label validation)
- **urllib3 ≥2.7.0** — resolves CVE-2025-50181 and CVE-2025-50182 (HTTP 1.1 request deserialization issues)
- **defusedxml ≥0.7.1** (new dep) — replaced `xml.etree.ElementTree` in IBKR broker parser (B314/XXE injection prevention)
- **great-expectations ≥1.17.0** — floor bumped from 0.18.0 to avoid transitive CVEs in ancient GE versions
- **Helm KSV-0014** — added `readOnlyRootFilesystem: true` to all containers (backend, wait-for-postgres, wait-for-redis, frontend, postgres, redis) with `emptyDir` mounts for `/tmp`, `/var/run/postgresql`
- **Helm KSV-0118** — added pod-level `securityContext.seccompProfile.type: RuntimeDefault` to backend-deployment, frontend-deployment, postgres-statefulset, redis-deployment
- **Ruff** — removed unused imports and fixed bare f-strings across 7 backend modules

## [2.7.0] — 2026-05-23

### Added
- **Maturity-Aware Thought Partner** — AI Investment Agent (`GET /investors/{id}/agent`) now adapts its tone, language, and analytical depth to the investor's maturity stage:
  - `foundation` (score < 25): plain language, safety-first, no jargon, habit-building capital thresholds
  - `discipline` (25–49): comparative explanations, behavioural pattern references, moderate progression
  - `optimization` (50–74): quantitative language, return ranges, portfolio efficiency focus
  - `advanced` (≥75): institutional-grade — regime, correlation, drawdown, factor tilts, tail scenarios
- **`?verbosity=beginner|standard|advanced` override** — query param forces a specific communication style regardless of computed maturity stage; `standard` (default) auto-selects based on stage
- **Maturity + Twin + Behavioral context injection** — every AI prompt now includes: latest `InvestorMaturitySnapshot` (stage, score, features_unlocked, next_steps), latest `FinancialTwinSnapshot` (all 8 dimension scores + overall), and all active `BehavioralRiskEvent` records (event_type, severity, description, recommendation)
- **`AgentReport` extended**: new `maturity_stage` and `verbosity_used` response fields for UI awareness

### Fixed
- **Helm chart `SECRET_KEY` bug** — `backend-deployment.yaml` was injecting `JWT_SECRET_KEY` but `config.py` reads `SECRET_KEY`; backend pods would fail to start on K8s due to missing required env var
- **Helm chart sync with v2.1–v2.7 env vars** — `values.yaml`, `secret.yaml`, and `backend-deployment.yaml` now cover all env vars declared in `config.py`: `SECRET_KEY`, `WORKERS_ENABLED`, `ALLOWED_ORIGINS`, `AI_MONTHLY_BUDGET_USD`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `SMTP_*`, `ALERT_FROM_EMAIL`, `LANGFUSE_*`
- **`Chart.yaml` `appVersion`** updated from `0.42.1` to `2.7.0`; chart `version` bumped to `0.8.0`

## [2.6.0] — 2026-05-23

### Added
- **Counterfactual Replay Engine** — 3 backward-looking scenario types that fork from a historical decision point and compare what would have happened against the actual portfolio path
  - `counterfactual_rebalance` — "What if I had followed the rebalance recommendation?" Forks from a `RecommendationDecision` record; applies the suggested tier allocation vs the actual allocation using reference return rates (low_risk 4%/yr, growth 8%/yr, high_risk 12%/yr); computes the delta between the counterfactual and actual present value
  - `counterfactual_constraint` — "What if my allocation constraint had always been enforced?" Finds the earliest `PortfolioSnapshot` where total tier drift exceeded 15%; forks from that point using the RiskModel target allocation
  - `counterfactual_hold` — "What if I hadn't panic-sold?" Loads a `BehavioralRiskEvent` (panic_selling type); reconstructs the value of each sold position today using `PriceSnapshot` when available (fallback: portfolio growth rate proxy); computes the forgone gain
- All counterfactuals extend the existing `POST /investors/{id}/simulations` API using new `scenario_type` values — no new routes
- Counterfactual results include: dual-path trajectory (counterfactual line + actual dashed gray), `delta`, `delta_pct`, `reference_date`, `elapsed_months`, `explanation` narrative, and — for panic-sell — `panic_tickers`, `total_sold`, `estimated_held_value`
- `ValueError` from counterfactual validation (missing decision, no risk model, non-panic event) now returns HTTP 422 via the existing simulation router
- **Financial Futures page** (`/futures`) updated: "Counterfactual" scenario section with GitBranch icon; UUID text inputs for `decision_id` / `event_id`; dual-path SVG chart; 4-stat result panel (Counterfactual / Actual / Delta / Delta %); Replay Analysis narrative block

## [2.5.0] — 2026-05-23

### Added
- **Simulation Engine** (`POST /investors/{id}/simulations`, `GET /simulations`, `GET /simulations/{id}`, `POST /simulations/{id}/save`): run deterministic and Monte Carlo financial futures scenarios against the investor's live portfolio data
- **`simulation_runs` and `simulation_comparison_sets` tables** (migration 0045): stores scenario type, parameters, frozen `data_snapshot`, `results` JSONB (trajectory + percentiles), `random_seed` for reproducibility, `is_saved` flag, and required disclaimer
- **3 deterministic scenarios**: `debt_payoff` (net worth trajectory with accelerated debt payoff + freed-payment compounding), `savings_increase` (FV formula with extra monthly savings), `job_loss` (liquid savings drawdown under reduced/zero income)
- **3 Monte Carlo scenarios** (1 000 seeded iterations, fully reproducible via `random_seed`): `market_crash` (compound growth + random crash events with configurable severity and frequency), `retirement` (compound growth with return variance), `custom` (user-defined return/volatility/contribution)
- **All simulations**: deterministic p10 = p50 = p90; Monte Carlo outputs p10/p50/p90 percentile trajectory bands and `probability_positive` metric
- **Required disclaimer** included on every simulation response: explicitly not financial advice or projection of future returns
- **Financial Futures page** (`/futures`): scenario builder with per-type parameter inputs, SVG trajectory chart (p10/p50/p90 band for MC, single line for deterministic), summary stats, data snapshot panel, recent runs list, Save button
- **14 new engine unit tests** covering reproducibility, directional correctness, edge cases (zero rate, no debt, full income loss)

## [2.4.0] — 2026-05-23

### Added
- **Behavioral Drag** attribution factor (illustrative estimate): fees attributed to short-term buy-sell round-trips (< 30-day holding period) — sub-component of total fees highlighted separately
- **FX Drag / FX Impact** attribution factor (illustrative estimate): total currency movement P&L across cross-currency holdings, computed from `purchase_fx_rate` vs current rate via the existing FX Impact engine
- **Concentration Cost** attribution factor (illustrative estimate): sum of unrealized losses from the top-3 most concentrated holdings — highlights position concentration risk
- All 3 new factors are labeled `is_estimate: true` in the API response; the frontend renders them in a separate "Extended Estimates" section with an "Estimate" badge and a "not financial advice" disclaimer
- No schema changes — extends `app/attribution/service.py` and `app/attribution/schemas.py` only

## [2.3.0] — 2026-05-23

### Added
- **Behavioral Risk Detection** (`GET /investors/{id}/behavioral-risk`, `GET /behavioral-risk/{event_id}`, `POST /behavioral-risk/{event_id}/resolve`, `POST /behavioral-risk/detect`): 7 deterministic detection rules — Panic Selling, Performance Chasing, Revenge Trading, Overtrading Spike, Concentration Addiction, Risk Creep, Strategy Abandonment
- **`behavioral_risk_events` table** (migration 0044): stores event_type, severity, status (active/resolved/acknowledged), description, evidence JSONB, recommendation; FK to recommendation_decisions for causal chain
- **`detect_behavioral_risk_daily` background job** (04:00 UTC): sweeps all investors; idempotent — skips event types already active
- **Behavioral Risk page** (`/behavioral-risk`): active/resolved/all tabs, severity-coded event cards, inline evidence metrics, recommendation panel, Resolve button per event, Run Scan on demand
- **Timeline extended**: behavioral_risk_detected and behavioral_risk_resolved events now appear in the Financial Decision Timeline feed

## [2.2.0] — 2026-05-23

### Added
- **Financial Twin** (`GET /investors/{id}/twin`, `GET /twin/history`, `POST /twin/refresh`): 8-dimensional behavioral/financial mirror — Financial Stability, Behavioral Discipline, Emotional Risk, Portfolio Consistency, Financial Resilience, Risk Alignment, Long-Term Discipline, Contribution Momentum
- **Financial Health Radar** (`GET /investors/{id}/health-radar`): 9-dimensional health snapshot — Stability, Liquidity, Discipline, Diversification, Emotional Control, Contribution Consistency, Tax Efficiency, Risk Alignment, Financial Resilience; co-computed with twin in a single service call
- **`financial_twin_snapshots` and `financial_health_scores` tables** (migration 0043): daily snapshots with all dimension columns and overall_score; previous_overall derived from the most recent prior row
- **`compute_twin_daily` background job** (03:00 UTC): refreshes twin + health radar for all investors after portfolio snapshots complete
- **Twin page** (`/twin`): 8-sided SVG radar chart, overall score with trend arrow, per-dimension cards with score bars and descriptions
- **Health Radar page** (`/health-radar`): 9-sided SVG radar chart with per-vertex color-coded dots, overall score with trend arrow, dimension breakdown score bars

## [2.1.0] — 2026-05-23

### Added
- **Investor Maturity Engine** (`GET /investors/{id}/maturity`, `GET /maturity/history`, `POST /maturity/refresh`): deterministic 4-stage investor scoring system — Foundation → Discipline → Optimization → Advanced Cognition
- **8 scoring components** (weighted): Financial Stability (20%), Debt Discipline (15%), Savings Consistency (15%), Emotional Discipline (15%), Strategy Consistency (15%), Contribution Regularity (10%), Data Maturity (5%), Portfolio Complexity (5%)
- **`investor_maturity_snapshots` table** (migration 0042): stores composite score, stage, per-component scores, features unlocked, and improvement notes
- **`compute_maturity_weekly` background job** (Saturday 06:00 UTC): recomputes maturity snapshots for all investors
- **Maturity page** (`/maturity`): score arc gauge, stage roadmap with progress indicators, per-component bars with weights, features unlocked grid, actionable next-step notes

## [2.0.1] — 2026-05-23

### Fixed
- **Paper trading FX conversion bug**: user-supplied prices (entered after clicking "Get price") were previously treated as already being in the portfolio's base currency, causing USD-priced assets to be deducted 1:1 from ILS portfolios. Backend now looks up the asset's native currency from the cached snapshot and converts regardless of whether the price was auto-fetched or user-supplied.
- **Frontend price label**: price field now shows "Price per share (USD → converted to ILS)" when asset and portfolio currencies differ; estimated total correctly shows the original currency with a note that the backend will convert.

## [2.0.0] — 2026-05-23

### Added
- **Performance Attribution** (`GET /investors/{id}/attribution?period=ytd|1y|6m|3m`): breaks down portfolio value change into capital deployed, market return, and fees drag with percentage contribution per factor
- **Decision Confidence Layers**: multi-dimensional confidence scoring (snapshot recency, price freshness, historical data depth) attached to every attribution result; overall confidence score 0–1
- **Attribution page** (`/attribution`): period selector, animated factor bars, confidence breakdown panel — new `GlowCard` UI primitive
- `app/attribution/` module: `schemas.py`, `service.py`, `router.py`

## [1.7.0] — 2026-05-23

### Added
- **Portfolio Behavioral Intelligence** (`GET /investors/{id}/behavioral-patterns`): analyzes 12 months of transactions to compute holding period stats (avg/median, short/medium/long-term distribution), monthly trade frequency, recommendation follow-through rate
- Pattern detection: overtrading, short-term bias, long-term discipline, high strategy follow-through, low follow-through, high-frequency activity
- Behavioral score 0–100 (higher = more disciplined)
- **Behavioral Intel page** (`/behavioral`): score ring, holding period distribution, monthly activity chart, detected pattern cards with severity classification
- `app/behavioral_patterns/` module: `schemas.py`, `service.py`, `router.py`

## [1.6.0] — 2026-05-23

### Added
- **Financial Decision Timeline Engine** (`GET /investors/{id}/timeline?days=30&limit=50`): unified chronological feed merging AI recommendations, coach insights, rebalance events, and portfolio transactions
- Causal notes: for each AI recommendation or rebalance event, the timeline automatically annotates portfolio value changes in the subsequent 7 days
- **Timeline page** (`/timeline`): date-grouped timeline with event type filter tabs, time window selector (7/14/30/60/90 days), color-coded event cards with causal context
- `app/decision_timeline/` module: `schemas.py`, `service.py`, `router.py`

## [1.5.0] — 2026-05-23

### Added
- **Strategy Drift Detection** (`GET /investors/{id}/strategy-drift`): deterministic comparison of actual portfolio tier allocation vs. risk model targets (low-risk, growth, high-risk); normalizes to tradeable portion excluding locked assets (pension/study funds)
- Drift status per tier: on_track (< 3%), minor_drift (3–8%), major_drift (> 8%)
- Alignment score 0–100 derived from RMSE of drift across tiers
- **Strategy Drift page** (`/strategy-drift`): alignment gauge, per-tier drift bars with target markers, summary and metadata
- `app/strategy_drift/` module: `schemas.py`, `service.py`, `router.py`
- Sidebar links: Decision Timeline, Strategy Drift, Behavioral Intel, Attribution (Intelligence section)
- New `GlowCard` UI primitive (`frontend/src/components/ui/glow-card.tsx`)

## [1.4.0] — 2026-05-23

### Added
- **Decision Replay** — `POST /investors/{id}/decisions/{decision_id}/replay`: re-runs the AI recommendation engine using the exact frozen inputs (risk model, holdings, market signals) captured at the original decision time; returns original vs replayed output side-by-side with a diff note
- Replay result recorded to `recommendation_decisions` as `ai_recommendation_replay` for full auditability
- Replay UI in the Decision Provenance page: side-by-side original vs replayed tickers and guidance, token usage display, diff note

## [1.3.0] — 2026-05-23

### Added
- **Decision Provenance page** (`/decisions`): timeline of all recommendation decisions with type filter (Recommendations / Coach / Rebalance); click any entry for full provenance detail
- Detail panel shows: deterministic inputs (risk model snapshot, holdings, rules fired), AI context (model, tokens, input/output summary, market signals), metadata (decision ID, hash, portfolio snapshot ID)
- **Sidebar link**: "Decision Provenance" under Intelligence section
- Backend: `GET /investors/{id}/decisions` (list, filterable by type) and `GET /investors/{id}/decisions/{id}` (detail) — `app.provenance.router`

## [1.2.0] — 2026-05-23

### Added
- **Migration 0041**: `recommendation_decisions` table — captures every recommendation event with full provenance: portfolio snapshot ID, risk model snapshot, holdings summary, FX rates, price snapshot, market signals, rule results, model used, prompt version, AI input/output summaries, token counts, output summary, decision hash
- **`RecommendationDecision` SQLAlchemy model** (`app/models/recommendation_decision.py`)
- **`app/provenance/recorder.py`**: `record_decision()` — fire-and-forget provenance capture; `snapshot_risk_model()`, `snapshot_holdings()`, `snapshot_signals()` helpers
- Provenance wired into three pipelines:
  - `investment_recommendations/service.py` — records `ai_recommendation` after every AI call
  - `coach/service.py` — records `coach_insight` with which rules fired and what was produced
  - `portfolio_analysis/router.py` — records `rebalance` with tier count and suggested trade count

## [1.1.0] — 2026-05-23

### Added
- **Admin system status panel** — new `GET /admin/system-status` endpoint returning: migration head, Langfuse enabled/disabled, workers enabled/disabled, freshness of price snapshots / FX rates / portfolio snapshots / net worth snapshots / coach insights (minutes ago + ok/stale/unknown), data quality failures in last 24h, broker auto-sync coverage
- System Status card added to admin page (`/admin`) — shows freshness grid with colour-coded status, data quality result, and broker sync count; renders above AI Cost

## [1.0.1] — 2026-05-22

### Fixed
- `alembic/env.py` no longer imports `app.core.config.Settings`; reads `DATABASE_URL` directly from `os.environ` — removes the requirement for `SECRET_KEY` and other app credentials in the CI migration job environment

### Changed
- `docs/schema.md` version updated to 1.0.0 (was 0.97.0)
- `README.md`: added **Trust & Safety Architecture** section documenting the deterministic-first enforcement chain, AI tracing, data quality validation, migration CI, audit logging, and all safety gates in one place

---

## [1.0.0] — 2026-05-22

### Added

**Langfuse AI Observability**
- `backend/app/core/tracing.py` — `trace_ai_call()` context manager; lazy Langfuse client; transparent no-op when keys are absent
- All 11 AI callers instrumented: `ai_report`, `market_research`, `investment_recommendations`, `ai_agent`, `portfolio_chat`, `proactive_insights`, `ai_coach`, `pdf_import`, `market_signals`, `weekly_digest`
- Every trace records: feature name, model, input context (truncated), raw output, token counts, investor ID, error state
- `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST` added to config + `.env.example`
- Structured output validation in `ai_analysis/analyzer.py` — `_validate_report()` ensures all required keys are present; missing keys filled with empty string instead of crashing

**OpenTelemetry + Prometheus + Grafana**
- `backend/app/core/telemetry.py` — Prometheus `/metrics` endpoint via `prometheus-fastapi-instrumentator`; optional OTLP gRPC trace export
- FastAPI request instrumentation: rate, latency (p50/p95/p99), error rate, in-progress count, per-endpoint breakdown
- SQLAlchemy query instrumentation when OTLP endpoint is configured
- Prometheus service added to `infra/docker-compose.yml` (port 9090, 30-day retention)
- Grafana service added to `infra/docker-compose.yml` (port 3001); pre-provisioned with Prometheus datasource and TradeOps backend dashboard
- `infra/prometheus/prometheus.yml` — scrape config for `backend:8000/metrics` every 15s
- `infra/grafana/provisioning/` — datasource + dashboard provisioning configs
- `infra/grafana/dashboards/tradeops.json` — pre-built dashboard: request rate, p95 latency, error %, in-progress, endpoint breakdown, status code timeline
- `OTEL_EXPORTER_OTLP_ENDPOINT` added to config + `.env.example`
- `app.version` updated to `1.0.0` in FastAPI app

**Great Expectations Data Quality**
- `backend/app/data_quality/suites.py` — 5 expectation suites: `holdings`, `fx_rates`, `price_snapshots`, `portfolio_snapshots`, `transactions`
- `backend/app/data_quality/runner.py` — pandas-backed validator; logs violations; writes audit events for failures
- `backend/app/workers/jobs/data_quality_check.py` — daily job at 02:00 UTC
- Scheduler registered as `data_quality_check` job

**Migration Safety CI**
- `.github/workflows/ci.yml` — new `migration-test` job: spins up real Postgres 16, runs `alembic upgrade head`, validates table count ≥ 20, runs `alembic downgrade -1`, re-runs `alembic upgrade head` (round-trip test)
- `backend-docker` now depends on `migration-test` (migrations must pass before image is pushed)

### Dependencies Added
- `langfuse>=2.0.0`
- `opentelemetry-sdk>=1.24.0`
- `opentelemetry-instrumentation-fastapi>=0.45b0`
- `opentelemetry-instrumentation-sqlalchemy>=0.45b0`
- `opentelemetry-exporter-otlp-proto-grpc>=1.24.0`
- `prometheus-fastapi-instrumentator>=7.0.0`
- `great-expectations>=0.18.0`

---

## [0.99.3] — 2026-05-22

### Fix — Paper Trading Currency Bug + Retirement Readiness Formula

**Paper Trading — currency fix:**
- `service.py`: market price is now FX-converted to portfolio currency before deducting from `cash_balance`. Previously, USD prices were directly used against an ILS balance without conversion.
- `PaperPosition.currency` is now set to `portfolio.currency` instead of hardcoded `"USD"`.
- New `reprice_positions()` function: fetches live market prices for all held positions, FX-converts each to portfolio currency, recomputes `current_value` and `total_return_pct`.
- New endpoint: `POST /investors/{id}/paper-portfolios/{portfolio_id}/reprice` — triggers live repricing on demand.

**Retirement Readiness — formula fix:**
- Root cause: pension projected value was being passed to the 4% SWR formula as investable corpus, producing a grossly underestimated monthly income (~16,956 ILS/mo instead of ~28,801 ILS/mo for a typical Israeli pension fund).
- Fix: pension funds (type `pension_fund`) now compute monthly income via the **makdam** coefficient: `monthly_income = projected_value / makdam`. Makdam defaults to 200 when not set; actual value sourced from `holding.makdam`.
- Hishtalmut (`study_fund`) and investment portfolio remain as investable corpus with 4% SWR applied.
- New schema fields on `ReadinessScore`: `pension_monthly_income` (makdam-derived), `hishtalmut_projected` (lump-sum corpus).
- Dashboard `RetirementReadinessCard` updated: shows pension makdam income (cyber-emerald) and SWR income (hishtalmut + portfolio) as separate lines; breakdown tiles distinguish `hishtalmut_projected`.

---

## [0.99.2] — 2026-05-22

### Code Quality + Security — Ruff + Trivy Scan

**Ruff (Python linter):**
- `backend/ruff.toml` (NEW): ignores F821 (SQLAlchemy forward refs), E741 (short variable names), E402 (deferred imports); test files suppress F401.
- Real bug fix in `app/reports/pdf_generator.py`: invalid Python syntax in list comprehension for stress-test table styles — would crash any PDF export covering a stress-test section.
- Removed duplicate CoinGecko entries in `market_data/fetcher.py` (solana, bnb/binancecoin, cardano appeared twice).
- Removed duplicate Hebrew key in `broker_sync/parsers/altshuler_shaham.py`.
- Removed unused imports across 25+ backend files.

**Trivy (CVE scanner):**
- Next.js upgraded: `"next": "14.2.3"` → `"14.2.25"` — fixes **CVE-2025-29927** (critical: authentication bypass in Next.js middleware for routes prefixed with `/_next`).
- `eslint-config-next` upgraded to match.
- `frontend/package-lock.json` regenerated to match updated `package.json` (fixes CI `npm ci` failing on lock-file mismatch).

---

## [0.99.1] — 2026-05-22

### Security — Docker Hardening (Semgrep Findings)

- `backend/Dockerfile`: non-root `appuser` (appgroup) created before `CMD` — backend process no longer runs as root inside the container.
- `infra/docker-compose.yml`: `security_opt: no-new-privileges:true` added to `db`, `redis`, and `frontend` services.
- `infra/docker-compose.yml`: `read_only: true` + `tmpfs` mounts for all runtime-writable paths:
  - `db`: `/tmp`, `/var/run/postgresql`
  - `redis`: `/tmp`, `/data`
  - `frontend`: `/tmp`, `/root/.npm`

---

## [0.99.0] — 2026-05-22

### UI — GlowChart + StatCard Wired Into Pages; Pension/Hishtalmut Split

- `GlowChart` and `StatCard` primitives from v0.98.0 now applied to dashboard, stress-test, and retirement readiness pages.
- Retirement readiness UI: pension fund and hishtalmut projected values shown as separate line items in the breakdown panel.
- Dashboard stat cards updated to use `StatCard` with cyber-emerald, amber, violet, and cyan glow variants.

---

## [0.98.0] — 2026-05-22

### UI Primitives — Grafana Dark Theme + Component Overhaul

- `frontend/src/components/ui/glow-chart.tsx` (NEW): Recharts wrapper with SVG neon-glow filter defs, pulse animation on active data points, and consistent chart area styling.
- `frontend/src/components/ui/stat-card.tsx` (NEW): gradient stat card with optional glow border — variants: `emerald` (cyber green), `amber`, `violet`, `cyan`. Replaces ad-hoc inline card styling.
- Global dark theme tokens updated to Grafana-inspired palette: deep navy (`#0a0e1a`) background, surface layers, neon accent borders.
- Consistent `border/background` card system applied across dashboard, investments, and performance pages.

---

## [0.97.0] — 2026-05-21

### Disclaimer Strategy — Multi-Layer

- `LEGAL_DISCLAIMER.md` (NEW): 10-section legal disclaimer covering no financial advice, educational use, risk disclosure, AI limitations, third-party data, tax, brokerage integration, live trading risk, jurisdiction, and OSS warranty.
- `README.md`: redesigned with badges, feature tables, architecture diagram, safety principles, and `[!WARNING]` disclaimer block linking to `LEGAL_DISCLAIMER.md`.
- `frontend/components/ui/ai-disclaimer.tsx` (NEW): reusable `AIDisclaimer` component — full (amber bordered banner) and compact (single-line) variants.
- `frontend/app/(dashboard)/layout.tsx`: global footer on all dashboard pages — "not financial advice · educational and analytical use only".
- AI disclaimer banner added to 6 AI pages: `reports`, `recommendations`, `market-research`, `agent`, `market-scan` (compact), `insights` (compact).
- Backend inline disclaimers: stronger default disclaimer text on `investment_recommendations` and `market_research` services; `disclaimer` field added to `AnalysisReportOut`, `AgentReport`, and `ChatResponse` schemas.
- Live trading acknowledgment gate enhanced: 5-checkbox multi-point risk acknowledgment now required before the "I UNDERSTAND" confirmation text field is actionable.

### Docs

- `docs/schema.md`: updated to v0.97.0; added tables 26 (`net_worth_snapshots`) and 27 (`coach_insights`); updated relationships diagram; added migration 0040 to history.
- `docs/architecture.md`: updated to v0.97.0; added `net_worth/`, `tax_summary/`, `coach/` modules; added new API routes; updated workers table with all 14 current jobs; added new frontend pages.
- `docs/admin-guide.md`: updated to v0.97.0; added feature entries for Net Worth Dashboard, Tax Year Summary, and AI Coach; added migration 0040 entry.

---

## [0.96.0] — 2026-05-21

### Feature — Net Worth Dashboard (TASK 61)

- Migration 0040 (partial): new `net_worth_snapshots` table — captures portfolio value + financial assets + liabilities daily.
- `models/net_worth.py` (NEW): `NetWorthSnapshot` ORM model.
- `net_worth/service.py` (NEW): `get_summary()` aggregates portfolio snapshot + `FinancialAsset` + `FinancialLiability`; `get_history()` returns 12-month trend; `save_snapshot()` writes daily; FI projection via 4% rule binary search.
- `net_worth/router.py` (NEW): `GET /investors/{id}/net-worth` (summary + FI projection), `GET /investors/{id}/net-worth/history`.
- `workers/jobs/net_worth_snapshot.py` (NEW): daily job at 21:15 UTC.
- `frontend/net-worth/page.tsx` (NEW): 4 summary cards (Net Worth, Total Assets, Portfolio, Liabilities), 12-month trend line chart, expandable assets/liabilities breakdown tables, FI projection card.

### Feature — Tax Year Summary (TASK 61)

- `tax_summary/service.py` (NEW): WACC-method realized gain computation from `HoldingTransactions`; groups by tax year; estimates 25% flat tax (Israeli default); supports dividends; `available_years` auto-detected.
- `tax_summary/router.py` (NEW): `GET /investors/{id}/tax-summary?year=YYYY`.
- `frontend/tax-summary/page.tsx` (NEW): year selector, 4 summary cards (Gains, Losses, Net P&L, Est. Tax), realized transactions table with Long/Short term badge, dividend section (collapsible), disclaimer banner.

### Feature — AI Coach / Proactive Insights (TASK 61)

- Migration 0040 (partial): new `coach_insights` table — persistent insights with dedup, dismiss, and 7-day cooldown.
- `models/coach_insight.py` (NEW): `CoachInsight` ORM model.
- `coach/service.py` (NEW): 7 rule-based checks (emergency fund, idle cash, goal-behind-schedule, portfolio drift/concentration, tax-loss harvesting, paper trading milestone, high-interest debt); optional AI narrative layer via Claude Haiku; dedup prevents spam; dismiss persists 7 days.
- `coach/router.py` (NEW): `GET /coach` (active insights), `POST /coach/refresh` (run analysis), `DELETE /coach/{id}` (dismiss).
- `workers/jobs/coach_refresh.py` (NEW): daily job at 07:45 UTC (after goal_evaluation + proactive_insights).
- `frontend/insights/page.tsx` (NEW): severity-grouped cards (danger/warning/info), dismiss button, Refresh button, action CTA with link.

### Infrastructure

- All 3 new routers registered in `api/v1/router.py`.
- Sidebar: Net Worth (Personal section), Tax Summary (Portfolio section), AI Coach (Intelligence section).

---

## [0.95.0] — 2026-05-20

### Feature — Market Research History

**Problem**: Every visit to the Deep Market Research page required running the full pipeline from scratch (60+ instruments, 45–60s). Previous reports were lost on page reload or browser session end.

**Changes**:

- Migration 0039: new `market_research_reports` table — stores full report JSONB per investor with `picks_count` and `universe_size` denormalized for fast history listing.
- `models/market_research.py` (NEW): `MarketResearchSnapshot` ORM model.
- `market_research/service.py`: saves new report to DB after each AI call; `get_history(db, investor_id)` returns list; `get_snapshot(db, investor_id, snapshot_id)` loads a historical report.
- `market_research/schemas.py`: added `MarketResearchHistoryItem` schema.
- `market_research/router.py`: added `GET /history` and `GET /{snapshot_id}` endpoints (ordered before `GET ""` to avoid route shadowing).
- `frontend/market-research/page.tsx`: history sidebar (left panel) shows all past runs with date, time, picks count, and universe size. Clicking any entry loads that report instantly without re-running AI. Most recent report auto-loads on page entry.

---

## [0.94.0] — 2026-05-20

### Feature — Paper Trading Redesign (Real Simulator)

**Problem**: The paper trading page used a confusing tick-based statistical simulation (Gaussian returns per strategy type). Users could not add individual stocks, could not delete portfolios, and all values showed 0.00 because it required a configured risk model.

**Changes**:

- Migration 0038: `cash_balance` added to `paper_portfolios`; `strategy_template_id` and `risk_model_id` made nullable; new `paper_positions` table (WACC tracking per ticker per portfolio) and `paper_orders` table (trade history).
- `models/paper_trade.py`: `PaperPosition` and `PaperOrder` models added; `PaperPortfolio` updated.
- `schemas/paper_trade.py`: `PaperPortfolioCreate` now takes `initial_cash` (float) and `currency` instead of pulling from risk model; added `PaperOrderCreate`, `PaperPositionOut`, `PaperOrderOut`.
- `paper_trading/service.py`: `create()` now accepts user-defined cash + currency; `place_order()` handles buy (validates cash, WACC position update) and sell (validates position, deletes when fully closed); `delete_portfolio()` hard-deletes; `advance_tick()` still available for strategy-template portfolios.
- `paper_trading/router.py`: added `POST /{id}/orders`, `DELETE /{id}`.
- `frontend/paper-trading/page.tsx`: full redesign — cash/invested/total value summary cards; open positions table with quick-sell buttons; trade form with Buy/Sell toggle, live price auto-fetch, quantity + price inputs; order history table; red trash button per portfolio.

---

## [0.93.0] — 2026-05-19

### Feature — Live Trading Admin Queue

**Problem**: Admin had no visibility into which investors were eligible for live trading and no easy way to approve them. The `live_trading_allowed` flag on the risk model had to be set manually via the database.

**Changes**:

- `admin/schemas.py`: Added `LiveTradingGateOut` and `LiveTradingQueueEntry` schemas.
- `admin/router.py`: Three new endpoints:
  - `GET /admin/live-trading/queue` — all investors with their 4 non-IBKR gate statuses (gates 1–4), Sharpe ratio, paper days, and current approval state. Sorted by investor name.
  - `POST /admin/live-trading/{investor_id}/approve` — sets `risk_model.live_trading_allowed = True` + audit log.
  - `POST /admin/live-trading/{investor_id}/revoke` — sets `risk_model.live_trading_allowed = False` + audit log.
- `frontend/admin/page.tsx`: New "Live Trading Queue" section above the Users table. Shows per-investor gate icons (✓/✗), Sharpe ratio, paper days, approval badge, and Approve/Revoke buttons. Expandable rows show full gate detail text.

**Gate 5 (IBKR connection) excluded from admin queue** — it requires a live gateway URL and is irrelevant for the approval decision. Investors provide it when activating a session.

**Design principle preserved**: admin approval is always a deliberate human action. The queue surfaces eligibility; it never auto-approves.

---

## [0.92.0] — 2026-05-19

### Feature — Historical FX Rate Layer

**Problem**: `purchase_fx_rate` on holdings was always set using the current FX rate at creation time — even for broker-imported positions with historical purchase dates. This made the existing `fx_impact` P&L decomposition (Asset P&L vs Currency P&L) inaccurate for any position purchased in the past.

**Additionally**: the `fx_impact` engine existed but had no API endpoint — it was unreachable.

**Changes**:

- `models/fx_rate_history.py` (NEW): `FxRateHistory(id, from_currency, to_currency, date, rate, source)` — daily closing FX rates with unique constraint on `(from_currency, to_currency, date)`.
- `alembic/versions/0037_fx_rate_history.py` (NEW): migration for the new table.
- `currency_engine/history.py` (NEW):
  - `get_rate_at_date(db, from_ccy, to_ccy, date)` — DB lookup within 7-day window (handles weekends/holidays); fetches from yfinance on miss.
  - `_fetch_and_store_pair(db, from_ccy, to_ccy, days)` — upserts daily rates from yfinance; tries inverse ticker if direct unavailable.
  - `sync_yesterday(db)` — fetches yesterday's rates for all active currency pairs (used by daily worker).
  - `backfill_all_pairs(db, days=730)` — full 2-year history fetch for all pairs.
- `holdings/service.py`: `create_holding()` now uses `get_rate_at_date(purchase_date)` when `purchase_date` is set, falling back to the current rate. This fixes accuracy for all new broker imports.
- `fx_impact/schemas.py` (NEW): Pydantic schemas for the API response.
- `fx_impact/router.py` (NEW): `GET /investors/{investor_id}/fx-impact` — returns full decomposed P&L per holding.
- `api/v1/router.py`: registered `fx_impact_router`.
- `workers/jobs/fx_history_sync.py` (NEW): daily worker job calling `sync_yesterday()`.
- `workers/scheduler.py`: added `fx_history_sync` job at 21:30 UTC (after snapshot_writer).
- `frontend/fx-impact/page.tsx` (NEW): FX Impact page with summary cards (Total / Asset / FX P&L), foreign-currency holdings table (with FX pair, rate at purchase → current, per-component P&L), and same-currency holdings table.
- `frontend/sidebar.tsx`: added "FX Impact" nav item (Globe icon) to Portfolio section.

---

## [0.91.0] — 2026-05-18

### Improvement — Admin Panel: Model Info + Budget Tracking

**Problem**: The admin AI cost panel showed raw feature keys (`market_research`) and had no model visibility or budget awareness.

**Changes**:

- `admin/schemas.py`: `AiUsageFeatureRow` gains `model: str`. `AiUsageSummary` gains `monthly_budget_usd: float` and `budget_remaining_usd: float | None`.
- `admin/router.py`: Feature aggregation now captures `model` per feature (last-write; each feature uses exactly one model). `monthly_budget_usd` sourced from `settings.AI_MONTHLY_BUDGET_USD`. `budget_remaining_usd` returned when `days == 30` and a budget is configured; `null` otherwise.
- `frontend/admin/page.tsx`: "By feature" table gains a Model column with a monospace badge showing a friendly name (e.g., `Sonnet 4.6`, `Haiku 4.5`). Summary cards grid expanded to 5 columns — new "Budget remaining" card shows remaining vs monthly cap, or "Unlimited" when `AI_MONTHLY_BUDGET_USD = 0`. Card turns red if over budget.

**Note on Anthropic account balance**: The Anthropic API does not expose account credit balance via API key. Remaining credits must be checked at console.anthropic.com.

---

## [0.90.0] — 2026-05-18

### Security — JWT Token Revocation on Logout

**Problem**: `POST /auth/logout` only cleared the browser cookie. The JWT itself remained cryptographically valid for 7 days — any captured token (XSS, network intercept, server log) could be replayed. There was also no `jti` claim in tokens, making selective revocation impossible.

**Solution**: Redis-backed JTI blacklist with in-memory fallback. Logout now actively revokes the token server-side.

- `auth/blacklist.py` (NEW): `blacklist_token(jti, ttl)` writes to Redis with exact remaining-lifetime TTL; `is_blacklisted(jti)` queries Redis. Falls back to per-process in-memory dict when Redis is unreachable. Expired entries are pruned on write.
- `auth/service.py`: `create_access_token()` now includes `"jti": str(uuid.uuid4())` in every token payload. `decode_token()` rejects tokens whose JTI is in the blacklist. New `decode_token_raw()` decodes without blacklist check — used only by the logout handler (avoids double-blacklist-check on a token being revoked).
- `auth/router.py`: `POST /logout` extracts the token from the request cookie, decodes it raw, computes remaining TTL (`exp − now`), and writes the JTI to the blacklist before clearing the cookie. `SameSite` on the login cookie upgraded from `lax` to `strict`.

**Backward compatibility**: tokens issued before this deploy have no `jti` field. `decode_token()` treats a missing JTI as non-revocable (skips the blacklist check). Existing sessions remain valid until natural expiry — no forced re-login on deploy.

**Degraded mode**: if Redis is down, the in-memory fallback is per-process. A token revoked in one worker/pod may still pass in another during an outage. This is the accepted trade-off; Redis is highly available in normal operation.

---

## [0.89.0] — 2026-05-18

### Fix — AI Cost Tracking for All AI Features

**Problem**: Admin panel showed $0 AI API cost despite Market Research, Recommendations, AI Agent, and Portfolio Chat all calling Claude. `log_ai_call()` was only wired to AI Report and Market Signals.

**Root cause**: The four analyzer functions returned plain `dict` with no token counts, and no callers ever called `log_ai_call()`.

- `market_research/analyzer.py`: `generate_research()` now returns `tuple[dict, int, int]` (result, input_tokens, output_tokens).
- `market_research/service.py`: unpacks tuple; calls `log_ai_call(feature="market_research")` on cache miss only (cache hits consume no tokens).
- `investment_recommendations/analyzer.py`: `generate_recommendations()` now returns `tuple[dict, int, int]`.
- `investment_recommendations/service.py`: unpacks tuple; calls `log_ai_call(feature="recommendations")`.
- `investment_agent/engine.py`: calls `log_ai_call(feature="ai_agent")` immediately after the Claude response, before JSON parsing — ensures tokens are recorded even on parse failure.
- `portfolio_chat/engine.py`: `chat()` return type extended to `tuple[str, dict|None, int, int]`; returns `(0, 0)` tokens on API failure.
- `portfolio_chat/router.py`: unpacks token counts; calls `log_ai_call(feature="portfolio_chat")` when `in_tok > 0`.
- `admin/page.tsx`: `FeatureLabel` mapping extended with display names for all 4 new feature keys; empty-state message updated to list all tracked features.

---

## [0.88.0] — 2026-05-18

### Infrastructure — Distributed Rate Limiting (Redis)

**Problem**: Login rate limiter was in-memory only — bypassed by multiple Gunicorn workers, horizontal scaling, or service restarts.

**Solution**: Redis-backed sliding-window rate limiter with graceful in-memory fallback.

- `auth/rate_limiter.py`: rewritten with lazy Redis client (sorted-set sliding window via `ZADD`/`ZREMRANGEBYSCORE`/`ZCARD`). Falls back to in-memory automatically when `REDIS_URL` is unset or Redis is unreachable — zero breaking change for existing deployments.
- `core/config.py`: new `REDIS_URL` setting (default `""` = disabled).
- `requirements.txt`: added `redis>=5.0.0`.
- `infra/docker-compose.yml`: added `redis:7-alpine` service with healthcheck; backend depends on it and receives `REDIS_URL=redis://redis:6379/0`.
- `.env.example`: documented `REDIS_URL`.
- `helm/tradeops/`: Redis Deployment + Service templates; `values.yaml` `redis:` section (`enabled: true`, image, resources); backend Deployment injects `REDIS_URL` when `redis.enabled`; `wait-for-redis` init container added; NetworkPolicy restricts Redis ingress to backend pod only.

---

## [0.87.0] — 2026-05-18

### Security & Safety Hardening

**Critical: minor account live trading block**
- `live_trading/service.py`: `submit_order()` now checks `investor.is_minor` at the entry point and returns an error before any gate evaluation. Prevents live orders for minor accounts even if admin accidentally sets `live_trading_allowed = True`.

**High: SSRF fix — gateway_url validation**
- `live_trading/schemas.py`: `AcknowledgeRiskRequest.gateway_url` validated by `_validate_gateway_url()` — rejects any host other than `localhost` / `127.0.0.1`. IBKR gateway always runs locally.
- `live_trading/router.py`: `activate_session` endpoint applies same validation to the `gateway_url` Query param.

**High: order confirmation step in live trading UI**
- `live-trading/page.tsx`: submit button now requires two deliberate clicks — first click shows an amber confirmation banner with the full order summary; second click submits. Cancel button dismisses. Also added `Number.isFinite` guard on `parseFloat(quantity)` and gate re-check before submission.

**High: AI budget check in market signals worker**
- `market_signals/worker.py`: per-investor loop now calls `check_monthly_budget()` before making any Claude API calls, skipping investors whose rolling 30-day spend is at the cap.

**High: missing index on `audit_events.investor_profile_id`**
- Alembic migration `0036_audit_index_and_pct_constraints.py`: adds `ix_audit_events_investor_profile_id` index. Prevents full table scans on audit log queries.

**Medium: pct field range constraints**
- Migration `0036`: adds `CHECK (investable_capital_pct >= 0 AND investable_capital_pct <= 100)` on `financial_profiles` and `CHECK (max_trade_size_pct >= 0 AND max_trade_size_pct <= 100)` on `risk_models`.

**Medium: AI prompt injection hardening**
- `ai_analysis/analyzer.py`: `_sanitize_strings()` helper strips newlines and backticks from all string values before JSON-encoding context passed to Claude, preventing user-controlled field names from injecting prompt instructions.

**Medium: localStorage cache TTL for AI reports**
- `agent/page.tsx`, `market-research/page.tsx`, `recommendations/page.tsx`: cache entries older than 12 hours are invalidated on read and removed from localStorage.

**Medium: raw backend errors no longer proxied to client**
- `api/v1/.../agent/route.ts`, `ai-report/route.ts`, `market-research/route.ts`, `recommendations/route.ts`: error responses from the backend no longer include the raw response body; returns generic `{ error: "Backend error" }` only.

**Low: server-only env var in Next.js API routes**
- Same 4 route files: `BACKEND` constant now resolves `API_URL` first, falling back to `NEXT_PUBLIC_API_URL` for backward compatibility. Prevents backend URL from being baked into the client JS bundle.

---

## [0.86.0] — 2026-05-17

### Quality & Completeness

**Emergency fund months: extracted shared helper**
- `financial_profiles/service.py`: new `compute_effective_ef_months(db, investor_id, fp)` helper
  centralises the three-place duplicate logic — queries holdings/accounts flagged with
  `is_emergency_fund=True`, takes the max of the manually-entered value and the computed one.
- `dashboard/service.py`: replaced 23-line inline EF block with the helper call; removed unused
  `InvestmentAccount`/`InvestmentHolding` imports.
- `investor_profiles/router.py`: stability-score endpoint now also uses the helper, making EF
  computation consistent across dashboard, risk-model, and stability-score paths.

**Pagination on previously-unbounded list endpoints**
- `transactions/service.py` + `router.py`: `list_transactions` now accepts `skip: int` with
  `Query(0, ge=0)`; `limit` switched from a plain default to `Query(200, ge=1, le=1000)`.
- `goals/service.py` + `router.py`: `get_by_investor` / `list_goals` now accept `skip: int`
  (`Query(0, ge=0)`) and `limit: int` (`Query(100, ge=1, le=200)`).

**Live trading: Gate 4 added to readiness check**
- `live_trading/engine.py`: new `_gate_order_risk_limits` gate (position 4 of 5) verifies that a
  risk model exists with `investable_capital > 0` and surfaces the configured `max_trade_size_pct`
  and `max_open_positions` limits in the gate detail string. Previously the `validate_order_risk`
  guard enforced these at order-submission time only; now they are visible in the pre-trade
  readiness checklist.

---

## [0.85.0] — 2026-05-17

### Security, Performance & Limits — Multi-issue batch fix

**Login rate limiting (brute-force protection)**
- `auth/rate_limiter.py`: new in-memory sliding-window rate limiter — 5 attempts
  per IP per 5-minute window, thread-safe for single-process deployments.
- `auth/router.py`: login endpoint now checks `is_rate_limited(f"login:{ip}")` and
  raises HTTP 429 before attempting any credential verification.

**AI monthly budget guard**
- `core/config.py`: new `AI_MONTHLY_BUDGET_USD: float = 0.0` setting (0 = unlimited).
  Set to a positive value to cap per-investor rolling 30-day AI spend in USD.
- `ai_usage/logger.py`: `check_monthly_budget` queries `ai_usage_log` for 30-day
  aggregate cost and raises HTTP 429 if the cap is reached. `require_ai_budget`
  wraps it as a FastAPI dependency.
- `api/v1/router.py`: `_ai = [Depends(verify_investor_access), Depends(require_ai_budget)]`
  applied to 6 expensive AI routers: `ai-report`, `agent`, `recommendations`,
  `market-research`, `market-scan`, `chat`.

**Pagination on list endpoints**
- `backtesting/service.py` + `router.py`: `list_for_investor` accepts `skip` and
  `limit` (default 50, max 200). Previously returned all rows.
- `paper_trading/service.py` + `router.py`: same pagination added.

---

## [0.84.0] — 2026-05-16

### Security & Quality — Multi-issue batch fix

**IDOR: Investor ownership enforced on all 37 investor-scoped routers**
- Added `backend/app/auth/investor_access.py` — `verify_investor_access` FastAPI
  dependency that fetches the InvestorProfile by `investor_id` and raises HTTP 404
  if it does not belong to `current_user`. Returns nothing; exists only for the
  guard side-effect.
- Applied via `dependencies=[Depends(verify_investor_access)]` at `include_router`
  level in `api/v1/router.py` for every investor-scoped router. Zero changes to
  individual endpoint handlers — one enforcement point, 37 routers protected.
- Routers not affected (handle their own auth or have no investor_id):
  `investor_router`, `admin_router`, `strategy_library_router`,
  `family_profile_router`, `market_data_router`.

**`/stability-score` endpoint: ownership + EF consistency**
- `investor_profiles/router.py`: stability-score endpoint was missing both an
  ownership check (any authenticated user could call it for any investor) and was
  using raw `fp.emergency_fund_months` instead of the effective value derived from
  flagged holdings/accounts. Now consistent with `dashboard/service.py` and
  `risk_modeling/service.py`.

**CORS: configurable via environment variable**
- `core/config.py`: added `ALLOWED_ORIGINS: str` setting (default `http://localhost:3000`).
  Set `ALLOWED_ORIGINS=https://tradeops.example.com,http://localhost:3000` in env for
  production. `allowed_origins_list` property parses comma-separated values.
- `main.py`: CORS middleware now reads `settings.allowed_origins_list` instead of
  the hardcoded localhost string.

**`decode_token`: catch `JWTError` instead of bare `Exception`**
- `auth/service.py`: was `except Exception: return None` — swallowed all errors
  including programming bugs. Now `except JWTError` — only JWT-specific errors
  (expired, invalid signature, malformed) return `None`; other exceptions propagate.

**Admin: eliminated N+1 queries in `list_users` and `list_profiles`**
- `admin/router.py` `list_users`: replaced N per-user `COUNT` queries with a single
  `GROUP BY user_id` aggregate.
- `admin/router.py` `list_profiles`: replaced N `db.get(User, ...)` calls with a
  single `WHERE id IN (...)` batch fetch.

**Silent exception swallows: add logging**
- `investment_recommendations/service.py`: two bare `except Exception: ... = None/[]`
  blocks now log `WARNING` with `exc_info=True` so failures appear in application
  logs rather than disappearing silently.

---

## [0.83.3] — 2026-05-16

### Fixed — Rebalance engine note TypeError + cookie forwarding in Next.js API routes

**Rebalance engine: TypeError when total_value is None**
- `portfolio_analysis/rebalance_engine.py`: `locked_value_approx` was set to `None`
  when `total_value` is falsy, then used in an `:.0f` format string → `TypeError`.
  Now always computed as a float (`(total_value or 0) * locked_pct / 100`).
- Note text changed from "pension/study funds" to "locked or other unclassified assets"
  to correctly cover all `None`-mapped asset types (pension_fund, study_fund, other).
  Fixes `test_other_assets_noted` which expected "other"/"unclassified" in the note.

**Next.js API routes: Cookie not forwarded to backend (401 on Market Research, Recommendations, Agent, AI Report)**
- All four server-side API route handlers were ignoring the incoming `request` parameter
  (`_request` prefix) and not forwarding the browser's `Cookie` header to backend fetch calls.
  Backend received no `tradeops_token` cookie and returned 401.
- Fixed in: `market-research/route.ts`, `recommendations/route.ts`, `agent/route.ts`,
  `ai-report/route.ts` — each now reads `request.headers.get("cookie")` and passes it
  as the `cookie` header in the outgoing fetch.

---

## [0.83.2] — 2026-05-16

### Fixed — AI/Market Route Cookie Forwarding (401 on Market Research & Recommendations)

All four Next.js API Route handlers (`market-research`, `recommendations`, `agent`, `ai-report`)
were making server-side fetch calls to the backend **without forwarding the browser's `Cookie`
header**. The `request` parameter was named `_request` (intentionally unused), so
`tradeops_token` was never included → backend returned 401 on every request through these routes.

- `frontend/src/app/api/v1/investors/[investorId]/market-research/route.ts`
- `frontend/src/app/api/v1/investors/[investorId]/recommendations/route.ts`
- `frontend/src/app/api/v1/investors/[investorId]/agent/route.ts`
- `frontend/src/app/api/v1/investors/[investorId]/ai-report/route.ts`

Each handler now reads `request.headers.get("cookie")` and passes it as the `cookie` header in
the outgoing backend fetch. Requests through the Next.js fallback rewrite (e.g., market-scan)
were unaffected — those are transparent browser-proxied requests.

---

## [0.83.1] — 2026-05-16

### Fixed — Rebalancing, Liquid Capital, Backtesting, Market Scan

**Critical bugfix: Rebalancing used full portfolio value including locked pension/study funds**
- `portfolio_analysis/rebalance_engine.py`: `pension_fund` and `study_fund` asset types are now
  excluded from tier mapping (set to `None`). Previously they were counted as `low_risk`, causing
  the engine to compute tier gaps against the full 5.5M ILS portfolio and recommend buying
  hundreds of thousands of ILS of NVIDIA/Bitcoin to "rebalance".
- After exclusion, tier percentages are re-normalized to the tradeable portion only (e.g., if 80%
  is in pension funds, the remaining 20% becomes the 100% basis for rebalancing).
- `gap_amount` now uses `tradeable_value` (not `total_value`) so suggested trade sizes are
  proportional to what can actually be traded.
- Added explanatory note when locked assets are detected.

**Liquid capital no longer includes pension assets**
- `dashboard/service.py` and `risk_modeling/service.py`: `pension` and `vehicle` asset types are
  excluded from liquid capital even if `is_liquid=True`. This prevents pension funds from
  inflating investable capital and causing downstream errors in risk model, paper trading,
  and backtesting.

**Backtesting: clear error instead of silent 0%**
- `backtesting/router.py`: returns HTTP 422 with an actionable message when
  `risk_model.investable_capital <= 0`, directing the user to fix their Financial profile
  and regenerate the Risk Model. Previously ran with 0 capital and showed +0.00%.

**Market scan: 401 now shows "Session expired" instead of generic error**
- `market-scan/page.tsx`: detects 401 and shows the amber session-expired banner
  (same as market research page).

---

## [0.83.0] — 2026-05-16

### Added — Live Trading Execution (Gated)

Real-money order execution through IBKR Client Portal Gateway, locked behind 5 hard safety gates.

**Backend (`app/live_trading/`)**
- Alembic migration `0035_live_trading.py` — adds `live_trading_sessions` and `live_orders` tables.
- `engine.py` — 5-gate readiness checker:
  1. Paper trading ≥30 calendar days old, ≥3 ticks, annualized Sharpe > 0.5
  2. Explicit risk acknowledgment (`confirmed = "I UNDERSTAND"`, stored in DB)
  3. Admin has enabled `risk_model.live_trading_allowed = True`
  4. Order risk validation: `estimated_value / investable_capital <= max_trade_size_pct %` AND open orders < `max_open_positions`
  5. IBKR Client Portal Gateway reachable and authenticated
- `ibkr.py` — IBKR REST client: `lookup_conid`, `submit_order`, `cancel_order`
- `service.py` — session lifecycle: `acknowledge_risk`, `activate_session`, `halt` (kill switch with order cancellation), `submit_order` (full pipeline), `list_orders`
- `router.py` — 6 endpoints: `GET /status`, `POST /acknowledge`, `POST /session`, `POST /halt`, `POST /orders`, `GET /orders`
- All significant actions logged to `audit_events`
- 17 unit tests covering Sharpe ratio, schema validation, order risk gates, and IBKR connection gate

**Frontend (`app/(dashboard)/live-trading/page.tsx`)**
- Gated readiness dashboard with live gate checklist
- Risk acknowledgment modal (must type "I UNDERSTAND" exactly)
- Session activation with gateway URL + IBKR account ID config
- Order form: ticker, market/limit, buy/sell, quantity, optional limit price
- Order history table with status, IBKR order ID, rejection reason
- Kill switch with confirmation dialog

**Sidebar**
- Added "Live Trading" link under the Strategy section

---

## [0.82.0] — 2026-05-16

### Added — Real-time SSE Price Streaming

Server-Sent Events endpoint for live price streaming across all portfolio tickers.

**Backend (`app/market_data/router.py`)**
- `GET /api/v1/market/stream?tickers=AAPL,MSFT&interval=30` — SSE endpoint (`text/event-stream`).
- Accepts comma-separated tickers (max 20) and refresh interval 5–300 s (default 30 s).
- Each event: `data: {"AAPL": {"price": 213.5, "currency": "USD", "fetched_at": "..."}}\n\n`
- Sends one event immediately, then every `interval` seconds.
- Uses `asyncio.run_in_executor` to keep the async loop free while DB + market data fetch runs in thread pool.
- Creates a fresh `SessionLocal()` per tick (SSE connections are long-lived; request-scoped `get_db` sessions would close immediately after the first response chunk).
- Sets `X-Accel-Buffering: no` to disable nginx buffering.

**Frontend (`app/(dashboard)/investments/page.tsx`)**
- Added `livePrices` and `liveConnected` state.
- `useEffect` opens an `EventSource` after `portfolio` loads, subscribing to all tickers found in the portfolio holdings. Closes on unmount or portfolio change.
- Holdings table "Current value" header shows a pulsing green dot + "LIVE" label when the SSE connection is open.
- Each holding row shows the streaming price ("streaming" suffix) in the buy price column when SSE data is available for that ticker, falling back to the cached `ha.live_price` otherwise.

---

## [0.81.0] — 2026-05-16

### Hardened — Kubernetes + Helm Production Readiness

Security, network isolation, and operational hardening of the Helm chart. All changes are backwards-compatible — new flags default to `false`.

**`helm/tradeops/values.yaml`**
- Added `securityContext` block: `runAsNonRoot: true`, `runAsUser: 1000`, `allowPrivilegeEscalation: false`, `capabilities.drop: [ALL]` — applied to all containers.
- Added `secret.jwtSecretKey` and `secret.alphaVantageApiKey` — surfaced in the chart for proper secret management.
- Added `networkPolicy.enabled` flag (default `false`) — enables NetworkPolicy when set to `true`.
- Added `podDisruptionBudget.enabled` flag (default `false`) + `minAvailable: 1`.
- Added `podAntiAffinity.enabled` flag (default `false`) — prefer different nodes for backend replicas.

**`templates/backend-deployment.yaml`**
- `securityContext` added to all containers (backend + initContainer).
- New env vars: `JWT_SECRET_KEY` and `ALPHA_VANTAGE_API_KEY` (both `optional: true` — won't break existing deployments).
- `podAntiAffinity` block: `preferredDuringSchedulingIgnoredDuringExecution` on `kubernetes.io/hostname`.

**`templates/frontend-deployment.yaml`** — `securityContext` added.

**`templates/secret.yaml`** — `JWT_SECRET_KEY` and `ALPHA_VANTAGE_API_KEY` added.

**`templates/network-policy.yaml`** (new)
- Backend policy: allow ingress only from `ingress-nginx` namespace and frontend pods on backend port.
- PostgreSQL policy: allow ingress only from backend pods on port 5432.

**`templates/pod-disruption-budget.yaml`** (new)
- `policy/v1 PodDisruptionBudget` for backend with configurable `minAvailable`.

**`templates/NOTES.txt`** — Production security checklist: warns on unset `ANTHROPIC_API_KEY`, `JWT_SECRET_KEY`, insecure default postgres password, disabled TLS, missing NetworkPolicy, and PDB when replicas > 1.

---

## [0.80.0] — 2026-05-16

### Added — IBKR REST API Sync

Live position sync from IBKR Client Portal Gateway — no file export needed. Read-only, data sync only (no trade execution).

**Backend**
- **`app/broker_sync/ibkr_rest.py`**: `fetch_positions(gateway_url, ibkr_account_id)` — calls `GET /v1/api/portfolio/{accountId}/positions/0` on the local gateway. Maps IBKR `assetClass` (STK/ETF/CRYPTO/BOND/OPT) to internal `HoldingAssetType`. Handles connection errors, 401 session expiry, unexpected response formats, and zero-quantity positions gracefully. Returns `(rows, errors)` — same contract as file-based parsers, reuses `sync_holdings()`.
- **`app/broker_sync/router.py`**: Added `POST /investors/{investor_id}/accounts/{account_id}/broker-sync/ibkr-rest` endpoint accepting `{ gateway_url, ibkr_account_id, verify_ssl }` JSON body.
- **`tests/test_ibkr_rest.py`**: 9 unit tests — asset type mapping, successful parse, zero-qty skip, ConnectError, 401 handling, unexpected format, multi-asset-type parsing (all mocked, no real HTTP).

**Frontend (`app/(dashboard)/investments/page.tsx`)**
- Added `ibkr_rest` option to broker selector dropdown ("IBKR — REST API (live sync via gateway)").
- When selected, shows inline form with Gateway URL (default: `https://localhost:5000`) and Account ID fields instead of file upload.
- "Sync positions from gateway" button calls the new endpoint; result display reuses existing imported/updated/skipped/errors UI.

**Tests:** 9/9 IBKR REST + 12/12 staking + 12/12 PDF + 14/14 pairs + 8/8 action feed. 0 TypeScript errors.

---

## [0.79.0] — 2026-05-16

### Added — Crypto Staking & Yield Tracker

Track staking APY and estimated annual rewards with correct income tax treatment — no schema migration (uses existing `fund_status` and `annual_return_rate` fields on `InvestmentHolding`).

**Design:** Crypto holdings are marked as staked by setting `fund_status="staking"` and `annual_return_rate=<APY%>`. No new DB columns needed.

**Backend**
- **`app/crypto_staking/service.py`**: `build_staking_report()` queries all investor accounts for holdings with `fund_status="staking"`, computes estimated annual rewards (native = quantity × APY/100; base currency = native × live price from `price_snapshots`). Includes jurisdiction-aware tax treatment notes (Israel vs other).
- **`app/crypto_staking/schemas.py`**: `StakingPosition`, `StakingReport`, `EnableStakingRequest`, `StakingToggleOut`.
- **`app/crypto_staking/router.py`**:
  - `GET /investors/{investor_id}/crypto-staking` — full staking report with totals.
  - `POST /investors/{investor_id}/crypto-staking/{holding_id}` — enable staking + set APY on a crypto holding.
  - `DELETE /investors/{investor_id}/crypto-staking/{holding_id}` — disable staking.
- **`app/api/v1/router.py`**: registered crypto-staking router.
- **`tests/test_crypto_staking.py`**: 12 unit tests — tax note content, schema validation, APY bounds, rewards math formulas.

**Frontend**
- **`app/(dashboard)/crypto-staking/page.tsx`**: Shows total estimated annual staking income, per-position cards (APY badge, annual rewards in native + base currency, live price and total staked value), and a tax treatment reminder card explaining income vs capital gains distinction.
- **`components/layout/sidebar.tsx`**: Added "Crypto Staking" under Portfolio section with `Coins` icon.

**Tests:** 12/12 crypto staking + 12/12 PDF + 14/14 pairs + 8/8 action feed. 0 TypeScript errors.

---

## [0.78.0] — 2026-05-16

### Added — PDF Statement Import

Upload any broker PDF statement and let Claude AI extract holdings automatically — no regex patterns, works with any broker format.

**Backend**
- **`requirements.txt`**: Added `pypdf>=4.0.0` for PDF text extraction.
- **`app/pdf_import/extractor.py`**: Two-stage pipeline — (1) `pypdf` extracts raw text from all pages; (2) Claude Haiku parses the unstructured text into a structured holdings JSON. Long PDFs are smart-truncated (first 60% + last 40% of char budget) to preserve headers and holdings table. Handles empty/scanned PDFs and malformed AI responses gracefully.
- **`app/pdf_import/schemas.py`**: `ParsedHolding`, `PDFImportResult`, `PDFImportRequest` — Pydantic v2 models.
- **`app/pdf_import/router.py`**:
  - `POST /investors/{investor_id}/pdf-import/parse` — parse-only, no DB writes, returns structured preview.
  - `POST /investors/{investor_id}/pdf-import/import` — parse + write to target account. Maps AI asset types (cash/option → other) to the `HoldingAssetType` enum. Skips malformed rows, counts imported vs skipped.
- **`app/api/v1/router.py`**: registered pdf-import router.
- **`tests/test_pdf_import.py`**: 12 unit tests — truncation logic, schema validation, mocked Claude responses (success, empty PDF, malformed JSON, malformed holdings).

**Frontend**
- **`app/(dashboard)/pdf-import/page.tsx`**: Drag-and-drop PDF upload with visual drop zone, "Extract Holdings" → AI parse preview table (name, type badge, qty, avg price, market value), then account selector + "Import N holdings" button. Shows parse warnings from AI, import result summary.
- **`components/layout/sidebar.tsx`**: Added "PDF Import" link under Portfolio section with `FileUp` icon.

**Tests:** 12/12 PDF import + 14/14 pairs + 8/8 action feed. 0 TypeScript errors.

---

## [0.77.0] — 2026-05-16

### Added — Statistical Arbitrage Pairs Trading Engine

Paper-mode quant engine for market-neutral statistical arbitrage — no new dependencies (numpy already available via yfinance transitive dep).

**Backend**
- **`app/pairs_trading/engine.py`**: `analyze_pair(ticker1, ticker2, lookback_days)` — fetches Yahoo Finance 1y/2y daily close history via httpx, runs OLS hedge ratio (β = Cov(y,x)/Var(x)), computes zero-mean spread, Z-score, and ADF(0) cointegration test using numpy linear algebra. ADF(0) implements the first-difference OLS regression τ = β̂/SE(β̂) with MacKinnon (1994) 5% critical value of −2.87. No statsmodels/scipy required.
- **Signal logic**: `LONG_SPREAD` (Z ≤ −2.0), `SHORT_SPREAD` (Z ≥ 2.0), `STOP_LOSS` (|Z| ≥ 3.5), `EXIT` (|Z| < 0.5), `NEUTRAL` otherwise.
- **`app/pairs_trading/schemas.py`**: `PairAnalysis`, `PairSignalSave`, `PairSignalOut` — Pydantic v2 models.
- **`app/pairs_trading/router.py`**:
  - `GET /investors/{investor_id}/pairs-trading/analyze?ticker1=&ticker2=&lookback=` — pure compute, no DB writes.
  - `POST /investors/{investor_id}/pairs-trading/signals` — runs analysis, saves to `market_signals` as `PAIRS_ZSCORE` type. `guard_status=APPROVED` if cointegrated, `REJECTED` if not. Writes audit event.
- **`app/api/v1/router.py`**: registered pairs trading router.
- **`tests/test_pairs_trading.py`**: 14 unit tests — OLS correctness, ADF sign for stationary vs non-stationary series, all 5 signal thresholds, schema validation.

**Frontend**
- **`app/(dashboard)/pairs-trading/page.tsx`**: Full-featured page with ticker inputs, lookback selector, Z-score needle gauge (colored zones for stop/signal/neutral), cointegration pass/fail badge (with ADF τ value), trade instructions card, and "Save as market signal" button (disabled if not cointegrated).
- **`components/layout/sidebar.tsx`**: Added "Pairs Trading" link under Intelligence section with `ArrowLeftRight` icon.

**Tests:** 14/14 pairs trading + 8/8 action feed tests passing. 0 TypeScript errors.

---

## [0.76.0] — 2026-05-16

### Added — Daily Action Feed

Deterministic, real-time morning briefing that aggregates all existing signal sources into a prioritised action list telling the investor exactly what to do and why — no AI required, always fresh.

**Backend**
- **`app/action_feed/schemas.py`**: `ActionItem` (id, priority, category, action_type, title, reasoning, ticker, amount, units, unit_price, currency, source) and `DailyActionFeed` (investor_id, generated_at, summary, currency, urgent/high/medium counts, items list).
- **`app/action_feed/engine.py`**: `build_action_feed()` aggregates 5 signal sources:
  - **Rebalancing**: BUY/SELL/REDUCE/ACCUMULATE actions from `compute_rebalance()` — priority 2 if gap ≥10%, priority 3 if 5–10%.
  - **Proactive drift**: concentration, tier drift, option expiry events from `detect_drift()` — priority 1 for danger/short-option, priority 2 otherwise.
  - **Triggered price alerts**: all `PriceAlert` records with `triggered_at IS NOT NULL` — always priority 1 (ALERT).
  - **At-risk goals**: goals with status `at_risk` or `no_date` from `goals_service.get_analysis()` — priority 3 (CONTRIBUTE).
  - **Market signals**: `MarketSignal` approved & undismissed, last 3 days — score ≥70 → ACCUMULATE (priority 3), score ≤30 → WATCH (priority 2).
  - Results are deduplicated by deterministic id, sorted by `(priority, id)`, and capped at 12 items.
- **`app/action_feed/router.py`**: `GET /investors/{investor_id}/action-feed` — no auth overhead, sub-millisecond DB queries.
- **`app/api/v1/router.py`**: registered action feed router.
- **`tests/test_action_feed.py`**: 8 unit tests covering sorting, deduplication, cap, summary generation, schema validation, optional fields.

**Frontend**
- **`components/DailyActionFeedCard.tsx`**: Collapsible card with priority dots (red/amber/blue), 9 colour-coded action badges (BUY, SELL, REDUCE, ACCUMULATE, WATCH, CONTRIBUTE, URGENT, ALERT, REVIEW), inline amounts/units, urgent/high count badges in the card header, refresh button, loading skeleton, and empty/healthy state.
- **`app/(dashboard)/dashboard/page.tsx`**: `DailyActionFeedCard` mounted directly under the stat cards — the first thing the investor sees after the status overview.

**Tests:** 8/8 action feed tests passing. 0 TypeScript errors.

---

## [0.75.0] — 2026-05-16

### Security — JWT httpOnly Cookie Migration

Replaced localStorage-based JWT storage with server-set httpOnly cookies, eliminating XSS token theft risk.

**Backend**
- **`auth/dependencies.py`**: `get_current_user` now reads the `tradeops_token` cookie first; falls back to `Authorization: Bearer` for backward compatibility with existing Bearer clients. `HTTPBearer` changed to `auto_error=False` so missing headers don't throw 422.
- **`auth/router.py`**: `POST /login` now sets an httpOnly, SameSite=Lax, 7-day cookie on the response instead of returning the raw token in the body. Response body changed to `{"message": "Login successful"}`. Added `POST /logout` endpoint (204) that clears the cookie.

**Frontend**
- **`auth-fetch-patch.tsx`**: Bearer injection removed; component is now a no-op. Cookies are sent automatically for same-origin `/api/` requests via the Next.js proxy rewrite.
- **`lib/api.ts`**: Removed `getToken()` and `Authorization` header injection. 401 handler clears `tradeops_investor_id` and redirects to `/login`.
- **`hooks/useInvestorId.ts`**: Removed token guard — only checks `tradeops_investor_id` in localStorage. Auth is validated by the cookie on the first API call.
- **`login/page.tsx`**: Removed `token` state and all `localStorage.setItem/getItem("tradeops_token")` calls. Mount effect now calls `GET /auth/me` to detect existing session via cookie. After login, server cookie is set and `loadProfiles()` is called without an explicit token param.
- **`sidebar.tsx`**: Sign-out now calls `POST /api/v1/auth/logout` to clear the server cookie, then clears `tradeops_investor_id`. Admin check fetches `/auth/me` without explicit Bearer header.
- **`join/page.tsx`**: Fixed stale wrong key (`"token"` → cookie-based auth). Unauthenticated users are redirected to `/login` on 401 response.

**Tests:** 389 backend tests passing. 0 TypeScript errors.

---

## [0.74.0] — 2026-05-15

### Added — Proactive Insights Cache + DB CHECK Constraints

**Proactive Insights 1-Hour Cache**
- **`portfolio_analysis/router.py`**: `GET /portfolio/insights` now caches responses per investor for 1 hour using an in-memory dict. Avoids repeated Claude API calls on every page reload. Pass `?refresh=true` to bypass the cache and force a fresh AI run.
- **`ProactiveInsightsCard.tsx`**: Refresh button now passes `?refresh=true` to the API. Confirmed `has_alerts` field was already present in the endpoint response (previously documented as missing — was a false positive from code review).

**DB CHECK Constraints on Enum Columns (migration 0034)**
- Added `CHECK` constraints to 8 enum-like `VARCHAR` columns that previously had no DB-level validation:
  - `investment_accounts.owner_type` — `IN ('personal', 'joint')`
  - `family_members.invite_status` — `IN ('not_invited', 'pending', 'accepted', 'expired')`
  - `investment_holdings.fund_status` — `NULL OR IN ('active', 'inactive')`
  - `investment_holdings.option_type` — `NULL OR IN ('call', 'put')`
  - `investment_holdings.position_type` — `NULL OR IN ('long', 'short')`
  - `price_alerts.alert_type` — `IN ('above', 'below')`
  - `market_signals.guard_status` — `IN ('APPROVED', 'MUTED')`
  - `holding_transactions.transaction_type` — `IN ('buy', 'sell', 'dividend', 'fee', 'split', 'bonus')`

**Closed — live_market_intel**: Confirmed `live_market_intel/` is not dead code — it is imported by `investment_recommendations/service.py` and the `market_prewarm` worker.

**Tests:** 408 backend tests passing. 0 TypeScript errors. DB migration: 0034.

---

## [0.73.0] — 2026-05-15

### Added — Personal/Joint Account Ownership + Projected Balance Badge + Error Boundary

**Personal/Joint Account Ownership**
- **`investments/page.tsx`**: Added "Personal / Joint" segmented toggle to the account creation form. Default is `personal`; selecting `joint` sends `owner_type: "joint"` to the backend. Joint accounts display a purple "Joint" badge on the account card header. Backend schema and migration (0033) were already in place.

**Projected Balance Badge**
- **`investments/page.tsx`**: Holdings with `price_source = "projected"` now show an amber "Projected" badge in the holdings table row. Tooltip explains it is auto-projected using compound interest from the last recorded balance date. The "Manual — refresh for live" badge no longer triggers for projected holdings (separate condition guards).

**Dashboard Error Boundary**
- **`frontend/src/app/(dashboard)/error.tsx`** (new): Next.js route-segment error boundary covering all dashboard pages. Shows a friendly "Something went wrong" panel with error ID (digest) and a "Try again" reset button. Prevents any unhandled exception from leaving the user on a blank page.


**Tests:** 408 backend tests passing. 0 TypeScript errors.

---

## [0.72.0] — 2026-05-15

### Fixed — Emergency Fund, Pension Simulator, High-Rate Alert

**Emergency Fund from Flagged Holdings**
- **`dashboard/service.py`**: Dashboard now queries holdings and accounts flagged with `is_emergency_fund = True` to compute `total_value / monthly_expenses`. Uses `max(profile_value, computed)` — previously only read the manually-entered field and ignored flagged holdings.

**Pension Simulator Makdam Consistency**
- **`pension_simulation/engine.py`**: `simulate()` now accepts optional `makdam` parameter. If provided, computes `monthly_pension = projected / makdam`; otherwise falls back to linear drawdown `projected / (withdrawal_years × 12)`.
- **`pension_simulation/router.py`**: Passes `holding.makdam` for `pension_fund` holdings.
- **`investments/page.tsx`**: Simulator subtitle shows `מקדם X` when makdam-based, or `over N yrs` for linear fallback.

**High-Rate Pension Alert Dismiss**
- **`dashboard/page.tsx`**: Added "I understand" dismiss button to the >7% return-rate warning. Persisted in `localStorage` keyed by fund names. Warning reappears if new high-rate funds are added.

**Tests:** 408 backend tests passing. 0 TypeScript errors.

---

## [0.71.0] — 2026-05-15

### Added — Auto-Projected Pension/Fund Balances

**Auto-Projected Pension/Fund Balances**
- **`portfolio_analysis/engine.py`**: Added `_project_pension_balance()` — compound-interest FV formula accounting for net annual return, fee %, and monthly contributions. Pension/savings fund holdings with `annual_return_rate > 0` and a `balance_updated_at` reference date now auto-project forward to today; `price_source = "projected"`.
- **`holdings/service.py`**: Sets `balance_updated_at = now()` automatically when `current_balance` is provided on create or update — providing the projection reference timestamp.
- **`models/investment_account.py`**: Added `balance_updated_at` (`DateTime`, nullable) to `InvestmentHolding`.
- **`schemas/investment_account.py`**: Added `balance_updated_at: datetime | None` to `InvestmentHoldingOut`.

### Added — Multi-User Family System (Invite + Linked Portfolios + Household Bucket)

**Multi-User Family System**
- **`alembic/versions/0033_family_multiuser_and_projected_balance.py`**: Adds `balance_updated_at` to `investment_holdings`, `owner_type` to `investment_accounts` (personal|joint), and invite fields to `family_members` (invite_email, invite_token, invite_status, invite_expires_at).
- **`models/investment_account.py`**: Added `owner_type: str` (default: "personal") to `InvestmentAccount`; joint accounts appear in a household bucket in the family view.
- **`models/family_profile.py`**: Added invite fields to `FamilyMember` ORM model.
- **`schemas/family_profile.py`**: Added `InviteRequest`, `InviteOut`, `InviteInfo` schemas; `FamilyMemberOut` includes `invite_status`, `invite_email`.
- **`schemas/investment_account.py`**: `owner_type` in create/update/out schemas.
- **`family_profiles/service.py`**: Added `create_invite()` (64-char hex token, 7-day expiry), `get_invite_by_token()`, `accept_invite()` (links `investor_profile_id` to member).
- **`family_profiles/router.py`**: Added `POST /{family_id}/members/{member_id}/invite` (returns invite URL), `GET /invite/{token}` (public, returns metadata), `POST /invite/{token}/accept` (requires JWT, links user's investor profile).
- **`family_portfolio/engine.py`**: `compute_family_portfolio()` now aggregates all accepted linked investor portfolios; joint accounts (`owner_type = "joint"`) go to a `_HOUSEHOLD_SENTINEL` bucket displayed as "Household" in the family view.
- **`frontend/src/app/(dashboard)/family/page.tsx`**: Full rewrite — per-member portfolio summaries, inline invite panel with email input + link generation + copy button, household generation bucket, `InviteBadge` (Linked/Invite sent).
- **`frontend/src/app/(dashboard)/join/page.tsx`** (new): Token-based invite accept page — reads `?token`, shows invite details, redirects to login if unauthenticated, posts accept, redirects to `/family` on success.
- **`frontend/src/components/ResilienceSimulatorCard.tsx`**: Added scenario presets (Job Loss, Sabbatical, Health Crisis), monthly stacked depletion bar chart (Recharts), collapsible depletion log table.

**Tests:** 408 backend tests passing. 0 TypeScript errors. DB migration: 0033.

---

## [0.70.0] — 2026-05-15

### Added — Admin AI API Cost Tracking

**Admin AI API Cost Tracking**
- **`models/ai_usage_log.py`** (new): `AiUsageLog` table — id, user_id (nullable), investor_id (nullable), feature_name, model, input_tokens, output_tokens, cost_usd, called_at.
- **`alembic/versions/0032_ai_usage_logs.py`**: migration adding `ai_usage_logs` table with indexes on user_id and called_at.
- **`ai_usage/logger.py`** (new): `log_ai_call()` utility — computes cost from token counts using per-model rate table (Haiku $0.80/$4.00 per MTok in/out, Sonnet $3.00/$15.00), logs to DB. `compute_cost()` exposed for tests.
- **`market_signals/worker.py`**: `_call_claude()` now returns `(dict, input_tokens, output_tokens)`; logs one `AiUsageLog` row per ticker signal written (feature: `"market_signals"`).
- **`ai_analysis/analyzer.py`**: `generate_report()` now returns `(report_dict, input_tokens, output_tokens)`; exposes `_SONNET_MODEL` constant.
- **`ai_analysis/service.py`**: captures token counts from `generate_report()`, logs usage (feature: `"ai_report"`) before commit.
- **`admin/schemas.py`**: `AiUsageFeatureRow`, `AiUsageUserRow`, `AiUsageSummary` Pydantic schemas.
- **`admin/router.py`** — `GET /api/v1/admin/ai-usage?days=30`: returns period totals (calls, input_tokens, output_tokens, cost_usd) aggregated by feature and by investor/user, sorted by cost descending. `days` param 1–365.
- **`admin/page.tsx`**: new "AI Cost" section — 4 summary cards (total cost, calls, input tokens, output tokens), by-feature breakdown table, by-user expandable table (click row to see per-feature breakdown). Period selector: 7d / 30d / 90d. Empty state message when no logs yet.
- **`tests/test_ai_analysis.py`**: updated `TestGenerateReport` tests to unpack tuple return; added `mock_response.usage` mock.

**Tests:** 408 backend tests passing (+19 new). 0 TypeScript errors. DB migration: 0032.

---

## [0.69.0] — 2026-05-15

### Added — Market Signal Monitor

**Market Signal Monitor**
- **`market_signals/`** (new module): `worker.py` runs daily via APScheduler (20:15 UTC) — fetches yfinance news headlines for all held tickers, calls Claude Haiku once per ticker to score sentiment (−1.0 to +1.0), detect institutional investor (whale) mentions in headlines, and generate a personalized 2-sentence rationale embedding actual portfolio context (position value, %, unrealized P&L, holding days, currency).
- **`market_signals/guard.py`** (pure functions): `evaluate_signal()` applies a two-check Personal Signal Guard — stability mute (composite_score < 50) → MUTED, concentration mute (ticker > 15% of portfolio) → MUTED, stability takes priority; `compute_composite_score()` maps sentiment to 0–100 with +15 WHALE_MENTION bonus (capped at 100); `compute_trend_direction()` splits 7-day scores into first/second half, delta > 0.1 = improving, < −0.1 = deteriorating; `build_connected_insight()` detects tax-loss harvest, rebalancing, and accumulation opportunities from portfolio context.
- **`market_signals/schemas.py`**: `SentimentTick` (date, sentiment, composite), `TickerSignal` (signal_id, ticker, signal_type, sentiment/composite scores, rationale, whale_entities, guard_status, mute_reason, position context, trend_direction, trend_history, connected_insight), `MarketSignalsResult` (aggregate counts + signals list).
- **`market_signals/router.py`**: `GET /api/v1/investors/{id}/market-signals?include_muted&days` — approved non-dismissed signals with 7-day trend; `POST /{signal_id}/dismiss` → 204.
- **`models/market_signal.py`** + **`alembic/versions/0030_market_signals.py`**: `market_signals` table — id, investor_id (FK CASCADE), ticker, signal_type, signal_date, sentiment_score, composite_score, rationale, whale_entities (JSONB), personal_guard_metadata (JSONB), guard_status, mute_reason, is_dismissed, created_at. Unique index on (investor_id, ticker, signal_date) for idempotency.
- **`workers/jobs/sentiment_worker.py`** + scheduler registration: `sentiment_signals` job at CronTrigger(hour=20, minute=15) — after price_refresh (20:00), before snapshot_writer (21:00).
- **`MarketSignalCard.tsx`** (new component): summary strip (tickers monitored, approved count, whale chip); per-ticker cards with NEWS/WHALE badge, composite score bar, 7-day sentiment sparkline with dot color, trend direction icon, position context row (%, value, P&L, holding days), amber insight block for connected insights, violet whale-entity chips, collapsible "View rationale", dismiss button. Empty state: "No signals yet — the daily worker runs at 20:15 UTC". Added to **Investments** page after LiquidityRunwayCard.
- **`tests/test_market_signals.py`** (new, 30 tests): `TestEvaluateSignal` (9 — approved, stability mute, threshold boundary, concentration mute, exact limit, priority, metadata fields); `TestComputeCompositeScore` (7 — neutral=50, max bullish=100, max bearish=0, whale bonus=+15, capped at 100, 0.5=75, −0.5=25); `TestComputeTrendDirection` (7 — single=stable, empty=stable, improving, deteriorating, small delta=stable, 2-point improving, 2-point stable); `TestBuildConnectedInsight` (7 — tax harvest, rebalancing, accumulation, neutral=None, small loss=None, short-term label, long-term label).

**Tests:** 389 backend tests passing (+30 new). 0 TypeScript errors. DB migration: 0030.

---

## [0.68.0] — 2026-05-15

### Added — Resilience Stress-Test Module

**Resilience Stress-Test**
- **`resilience/`** (new module): `engine.py` simulates a life-event scenario (job loss, expense spike) against tiered liquid assets. `simulate_depletion()` is a pure function: drains the cash reserve (Tier 0 = `liquid_savings` from financial profile) first, then Tier 1 (T+2) and Tier 2 (1-week) holdings in cost-efficiency order (cheapest-to-liquidate first, same sort as emergency lever). Never touches Tier 3 (locked: pension, real estate) — breach of Tier 3 is the failure mode. Returns `(depletion_path, months_covered, tier3_breach)`.
- **Survival Score**: `min(100, months_covered / duration_months * 100)` — 100 means Tier 3 never touched; <100 means Tier 3 breach required. Verdicts: Safe (≥80), At Risk (50–79), Critical (<50). Deterministic, no AI.
- **AI Recommendation**: Optional Claude Haiku call (skipped if no `ANTHROPIC_API_KEY`). Prompt encodes scenario params, survival score, months covered, Tier 3 total. Returns 2–3 sentence personalised recommendation.
- **`resilience/schemas.py`**: `LifeEventRequest` (duration_months 1–36, monthly_income_loss ≥0, monthly_expense_increase ≥0, optional scenario_label), `DepletionStep` (month, source_label, holding_name, ticker, gross_sold, tax_paid, net_received, cumulative_net_raised), `ResilienceResult` (full simulation output including monthly_burn, total_cash_needed, cash_reserve, tier3_total_gross, months_covered, tier3_breach, survival_score, survival_verdict, depletion_path, ai_recommendation).
- **`resilience/router.py`**: `POST /api/v1/investors/{id}/portfolio/resilience` — validates request body, fetches investor + portfolio + financial profile, calls `compute_resilience()`.
- **`ResilienceSimulatorCard.tsx`** (new component): Form with 4 inputs (duration, income loss, extra expenses, optional label); "Run Simulation" button; verdict banner with coloured shield icon + survival score bar; key metrics grid (monthly burn, total needed, cash reserve, Tier 3 locked); months-covered progress bar; collapsible depletion path table (month, asset, tier, gross sold, tax, net received); AI recommendation block when available. Added to the bottom of the **Stress Test** page.
- **`tests/test_resilience.py`** (new, 36 tests): `TestSurvivalScore` (6 tests — no-breach=100, breach-at-0=0, proportional, cap at 99 when breached), `TestSurvivalVerdict` (6 tests — 100=Safe, 80=Safe, 79=At Risk, 50=At Risk, 49=Critical, 0=Critical), `TestSimulateDepletion` (10 tests — zero burn, cash covers full duration, holds liquidated when cash exhausted, tier3 breach when pool empty, months-covered equals duration when survived, mid-scenario breach, cumulative raised, drain order, step field population, negative burn treated as zero), `TestComputeResilience` (14 tests — return type, income covers=no-breach, income loss burn calc, expense increase burn calc, no excess burn, breach flag, tier3 total, score=100 when covered, no AI key, label default/custom, currency, cash reserve from financial profile, no financial profile uses zeros).

**Tests:** 359 backend tests passing (+36 new). 0 TypeScript errors. No DB migrations.

---

## [0.67.0] — 2026-05-15

### Added — Family Consolidated View + Liquidity Runway Engine

**Family Consolidated View**
- **`family_portfolio/`** (new module): `engine.py` aggregates all investment accounts by `family_member_id` FK, groups into per-member portfolios, computes household totals. `build_family_summary()` is a pure function (no DB calls) accepting pre-fetched family, portfolio, and account→member map for testability. `generation_for()` maps `relationship_type` → generation bucket (primary, partners, children, parents, grandparents, siblings, other). `is_minor(age)` returns True for age < 18, flagging `education_mode=True` on the member.
- **`family_portfolio/schemas.py`**: `FamilyMemberPortfolio` (per-member breakdown with generation, age, is_minor, education_mode, asset_allocation), `OverlapHolding` (tickers held by 2+ members — concentration risk), `FamilyPortfolioSummary` (household AUM, by-generation totals, household asset allocation, cross-member overlap, has_minors flag).
- **`family_portfolio/router.py`**: `GET /api/v1/investors/{id}/family-portfolio` — returns 404 when no family profile exists.
- **`family/page.tsx`** (updated): `HouseholdPortfolioCard` sub-component shows household AUM, unrealized P&L, generation breakdown bar with colour-coded segments, per-member portfolio bars with education-mode warning badges, and cross-member ticker overlap alert. Minor members get "Minor" badge in member list. Card renders only when family has at least one member.
- **`tests/test_family_portfolio.py`** (new, 25 tests): `TestGenerationFor` (10 tests — all relationship types + unknown fallback), `TestIsMinor` (4 tests — 0, 17, 18, None), `TestBuildFamilySummary` (11 tests — primary bucket, generation grouping, minor education mode, adult no-education mode, has_minors flag, overlap detection, no-overlap, household asset allocation, P&L% math, member_count with no-account members).

**Liquidity Runway Engine**
- **`liquidity_runway/`** (new module): `engine.py` tiers every holding (stock/ETF/crypto → Tier 1 T+2, bonds/funds → Tier 2 1wk, real estate/pension/study fund → Tier 3 Locked). Account type overrides: `keren_hishtalmut` and `pension` accounts force Tier 3 regardless of holding asset type. Net-to-pocket = gross − estimated CGT (gains only, country-specific rate from tax_rules) − market impact buffer (Tier 1: 0.5%, Tier 2: 0%). Locked holdings excluded from liquidity calculation.
- **Emergency Lever (greedy)**: When `target_amount` is provided, sorts liquidatable holdings by `(tax+impact)/gross` ascending (cheapest-to-liquidate first), greedily selects until target is met. `selected_for_target` flag on each holding, `target_met` bool in response.
- **`liquidity_runway/schemas.py`**: `LiquidityBucket` (tier, label, total_gross, total_net_to_pocket, holding_count), `LiquidityHolding` (full breakdown per holding), `LiquidityRunway` (buckets, totals, emergency lever output).
- **`liquidity_runway/router.py`**: `GET /api/v1/investors/{id}/portfolio/liquidity-runway?target_amount=50000` — optional target_amount query param (≥0).
- **`LiquidityRunwayCard.tsx`** (new component): Visual liquidity bar (three coloured segments: green=1–3d, amber=1wk, grey=locked); "Emergency Lever" section with target input and Calculate button; target-met/not-met verdict chip; ordered list of selected holdings to sell; expandable full holdings list sorted by cost efficiency.
- **`investments/page.tsx`**: `LiquidityRunwayCard` added below Payday Calendar card.
- **`tests/test_liquidity_runway.py`** (new, 23 tests): `TestGetTier` (10 tests — all asset types + account-type override), `TestComputeLiquidityRunway` (13 tests — bucket structure, tier landing, net-to-pocket math, zero-tax on losses, total_net excludes locked, no-target no-selection, target met, target not met, locked excluded from lever, cheapest-first sort, empty portfolio, currency pass-through).

**Tests:** 323 backend tests passing (+48 new). 0 TypeScript errors. No DB migrations.

---

## [0.66.0] — 2026-05-15

### Added — Tax-Alpha Harvest Alerts + Complexity Premium

**Tax-Alpha Harvest Alerts**
- **`tax_harvesting/schemas.py`**: `HarvestOpportunity` gains `holding_period_label: str | None` (e.g., "187 days (short-term)"), `suggested_replacement: str | None`, `replacement_rationale: str | None`.
- **`tax_harvesting/service.py`**: Conservative ETF replacement suggestions per asset class — VTI (stocks), VT (ETFs/funds), AGG (bonds), VNQ (real estate). Crypto excluded (no tax-equivalent). `_holding_period_label()` and `_suggest_replacement()` helpers extracted for testability. Harvest candidates now sorted by `estimated_tax_saving` descending (most actionable first, was: loss magnitude).
- **`performance/page.tsx`**: Harvest candidate rows updated — `holding_period_label` replaces generic "Short-term/Long-term" badge, "Similar position" chip with rationale displayed below each candidate that has a suggestion.
- **`tests/test_tax_harvesting.py`** (new, 20 tests): replacement map coverage (all asset types), holding period label formatting, sort order verification, gain offset population, total saving sum invariant, no-purchase-date edge case.

**Smart Benchmarking & Complexity Premium**
- **`performance_analytics/schemas.py`**: New `LazyPortfolioComparison` model — `data_gate_passed`, `snapshot_days`, `portfolio_return_pct`, `portfolio_sharpe`, `lazy_return_pct`, `lazy_sharpe`, `lazy_composition`, `complexity_premium_pct`, `risk_adjusted_premium`, `verdict`.
- **`performance_analytics/lazy_portfolio.py`** (new module): `fetch_lazy_returns(start, end)` fetches VT and AGG returns via yfinance (Docker-only, 24h cache). `build_comparison()` is pure Python — computes lazy return (60% VT / 40% AGG), complexity premium, estimated lazy Sharpe (using ~10% annualised 60/40 vol), verdict string. 30-day data gate enforced.
- **`portfolio_analysis/router.py`**: New `GET /api/v1/investors/{id}/portfolio/complexity-premium` endpoint — reads all snapshots, computes analytics, fetches VT/AGG returns, calls `build_comparison()`.
- **`performance/page.tsx`**: "Complexity Premium — vs Lazy Portfolio" card added at bottom of performance page. Shows return grid (portfolio vs lazy vs premium), Sharpe comparison row, honest verdict banner (green/amber/neutral). Data gate empty state shown when <30 days of history.
- **`tests/test_lazy_portfolio.py`** (new, 13 tests): data gate boundary (29 vs 30 days), premium arithmetic (60/40 weighted average), positive/negative verdict logic, nil when benchmark unavailable, risk-adjusted premium, snapshot_days and currency pass-through.

**Tests:** 275 backend tests passing (33 new). 0 TypeScript errors.

---

## [0.65.0] — 2026-05-15

### Added — Payday Calendar + SWAN Stress Test

**Payday Calendar (Dividend Income)**
- **`income_projection/distribution.py`** (new pure module): `monthly_distribution()` distributes each holding's annual dividend income across 12 calendar months based on ex-date and payment frequency. Quarterly: 4 equal payments spaced 3 months from ex-date. Monthly: 1/12 per month. Annual: full amount in ex-date month. Extracted to a dependency-free module for testability.
- **`income_projection/schemas.py`**: `IncomeResult` gains `monthly_income: dict[int, float]` — month 1–12 → estimated income in base currency.
- **`PaydayCalendarCard.tsx`** (new component): 12-bar chart (Recharts BarChart) showing expected dividend income per calendar month; current month highlighted in primary colour; "Next payday" banner showing nearest upcoming ex-dividend date with estimated payment; toggle to expand full holdings table (frequency, yield on value, annual income). Hidden when portfolio has no dividend income.
- **`investments/page.tsx`**: `PaydayCalendarCard` added below FX Impact card.

**SWAN Stress Test ("Sleep Well at Night")**
- **`scenario_analysis/scenarios.py`**: `Scenario` dataclass gains `recovery_months: int | None` — historical months for equity markets to recover to pre-crash peak. Set to 54 (2008 GFC), 6 (COVID), 24 (2022 rate cycle), `None` for hypothetical scenarios.
- **`scenario_analysis/schemas.py`**: `HoldingImpact` model added (`name, ticker, asset_type, current_value, simulated_loss, simulated_value`). `ScenarioImpact` gains `recovery_months: int | None` and `holding_impacts: list[HoldingImpact]`.
- **`scenario_analysis/engine.py`**: `_apply_scenario()` now computes per-holding impact by mapping each holding's `asset_type` to its tier drawdown, floors simulated_value at 0. Holdings sorted by `simulated_loss` (biggest loss first). Existing tier-level totals unchanged.
- **`stress-test/page.tsx`**: Recovery timeline badge ("Recovered in ~6mo" / "~4.5yr") added to each scenario card and drill-down header. Per-holding impact table shown when scenario is selected: name, ticker, current value, impact, simulated value after crash. "Show all N holdings" expand button when >8 holdings.

**Tests**
- **`tests/test_scenario_analysis.py`** (new, 16 tests): holding impacts map to correct tier drawdowns, sum matches tier totals, sorted correctly, zero-value holdings excluded, value floor at zero, recovery months pass-through, full `compute()` integration.
- **`tests/test_income_projection.py`** (new, 14 tests): monthly, quarterly (with year-boundary wrap), annual, unknown frequency, multiple holdings, zero-income exclusion, sum invariants.

---

## [0.64.0] — 2026-05-15

### Added — Proactive Insights Engine + FX Impact Analysis

**FX Impact Analysis**
- **DB migration 0029**: adds `purchase_fx_rate` (Float, nullable) to `investment_holdings`.
- **Auto-population**: `holdings/service.py` captures the live FX rate (base → holding currency) at holding creation time. Holdings created before v0.64 show `fx_data_available: false`.
- **`fx_impact/engine.py`**: pure math decomposition — `asset_pnl = price-change in local currency × qty × current_rate`; `fx_pnl = cost_basis_local × (current_rate − purchase_rate)`. Options use `contract_multiplier` in cost basis. Short positions carry no special sign (multiplier only).
- **`GET /portfolio/fx-impact`**: per-holding breakdown of `asset_pnl`, `fx_pnl`, `total_pnl`, their `%` variants, plus portfolio-level totals.
- **`FxImpactCard.tsx`**: three-column summary row (Total / Asset / FX P&L), market-vs-FX attribution split bar, per-holding detail cards with inline colour bars. Shown on investments page when cross-currency holdings exist.

**Proactive Insights Engine**
- **`proactive_insights/engine.py`**:
  - `detect_drift()` — deterministic, no AI: flags ticker concentration > 20% (with severity scaling to danger > 35%), tier deviation from risk model > 5%, and options expiring within 30 days (short options = danger).
  - `generate_insights()` — calls `claude-haiku-4-5-20251001` to narrate each drift event with a 1-2 sentence insight and a specific safe rebalancing action suggestion.
  - Options positions use `contract_multiplier` for exposure calculation; `position_type` determines severity for expiry events.
- **`GET /portfolio/insights`**: returns drift events + AI insights. Falls back to raw events if no API key.
- **Notification center**: drift events from `detect_drift()` surfaced as in-app notifications (type `insight`), so they appear in the notification bell without an API call.
- **`workers/jobs/proactive_insights.py`**: daily at 07:30 UTC — runs detect + generate for all investors, sends styled HTML insights email to opted-in investors.
- **Scheduler**: `proactive_insights` job registered at 07:30 UTC.
- **`ProactiveInsightsCard.tsx`**: collapse/expand, per-event severity icon + badge, AI insight text + "Action:" suggestion chip. Refresh button reruns the AI call on demand. Shown on investments page.

---

## [0.63.0] — 2026-05-15

### Added — AI Weekly Digest Email + Natural Language Portfolio Queries

**AI Weekly Digest Email**
- **DB migration 0028**: adds `weekly_digest_enabled` (Boolean, default false) to `investor_profiles`.
- **`weekly_digest/renderer.py`**: calls `claude-haiku-4-5-20251001` with real portfolio + goals data to generate a headline, performance summary, goal update, and 1–3 actionable suggestions; renders a fully styled HTML email.
- **`workers/jobs/weekly_digest.py`**: iterates opted-in investors, calls renderer, sends via SMTP using the existing `smtplib` infrastructure (HTML `MIMEMultipart`); gracefully skips if SMTP or API key is not configured.
- **Scheduler**: `weekly_digest` job registered on `CronTrigger(day_of_week="fri", hour=18)` — every Friday at 18:00 UTC.
- **Frontend — Settings page**: added **Weekly AI Digest** toggle inside the Email Notifications card; saved alongside `alert_email` and `email_alerts_enabled` via `PUT /investors/{id}`.

**Natural Language Portfolio Queries**
- **`portfolio_chat/session.py`**: in-memory per-investor conversation history, last 5 turns, resets on restart.
- **`portfolio_chat/engine.py`**: gathers live portfolio, risk model, and goals-analysis data; passes as system context to `claude-haiku-4-5-20251001`; returns a grounded, concise reply (never invents data).
- **`POST /investors/{id}/chat`**: accepts `{ message }`, returns `{ reply, data }`.
- **`DELETE /investors/{id}/chat`**: clears server-side session history.
- **Frontend — Chat Drawer**: floating button (bottom-right on all dashboard pages) opens a 420×600 chat panel with message bubbles, suggestion chips on empty state, auto-scroll, loading indicator, clear-history button, and a disclaimer ("grounded in your real portfolio data · Not financial advice").

---

## [0.62.0] — 2026-05-14

### Added — Options Tracking

- **DB migration 0027**: adds 6 nullable columns to `investment_holdings`: `strike_price`, `expiry_date`, `option_type` (call|put), `underlying_ticker`, `contract_multiplier`, `position_type` (long|short).
- **`HoldingAssetType`**: new values `call_option` and `put_option` (stored as `String(50)` — no DB-level enum change needed).
- **Schemas**: all 6 fields added to `InvestmentHoldingCreate`, `InvestmentHoldingUpdate`, `InvestmentHoldingOut` with validation (pattern constraints on `option_type` and `position_type`).
- **`portfolio_analysis/options_engine.py`**: pure math engine — `days_to_expiry`, `expiry_status` (ok / warning / critical / expired), cost basis, unrealized P&L and %, max loss (`None` for short = unlimited).
- **`GET /investors/{id}/portfolio/options`**: returns all option positions with P&L, expiry info, account name, expiring-soon count, and short-position flag.
- **Frontend**: `call_option` / `put_option` added to asset type selector; options-specific create/edit form (underlying ticker, strike, expiry, contracts, premium, multiplier, position type); short-position warning banner; expiry countdown badge + underlying·strike inline in the holdings table row; **Options P&L summary card** shown above account list when any options exist (columns: strike, expiry, cost basis, current value, P&L, max loss — with "Unlimited ⚠️" for short).

---

## [0.61.0] — 2026-05-14

### Added — PWA Support

- **`next.config.ts`**: sets `Cache-Control: no-cache` + `Service-Worker-Allowed: /` headers on `/sw.js`.
- **`src/app/manifest.ts`**: native Next.js 14 `MetadataRoute.Manifest` — name, short_name, theme color `#0f172a`, 192×192 and 512×512 icons.
- **`src/app/icon.tsx`**: 192×192 PNG favicon generated via `ImageResponse` (dark background, sky-blue T logo + chart bars).
- **`src/app/icon512/route.tsx`**: 512×512 maskable PNG icon via `ImageResponse`.
- **`public/sw.js`**: service worker with three fetch strategies — API routes always network-only (financial data must never be stale), navigation requests network-first with `/offline` fallback, static assets (`_next/static`, fonts, images) cache-first.
- **`src/app/offline/page.tsx`**: offline fallback page shown when navigation fails while offline.
- **`src/app/layout.tsx`**: `Viewport` export (`themeColor: '#0f172a'`), Apple Web App metadata, SW registration script injected at body end.

---

## [0.60.0] — 2026-05-14

### Added — Management Fees in Pension/Study Fund Projections

- **DB migration 0026**: adds `management_fee_balance_pct` and `management_fee_contribution_pct` columns to `investment_holdings` (nullable Float).
- **Model + schemas**: both fee fields exposed on `InvestmentHolding` (Create, Update, Out). Validation: balance fee 0–5%, contribution fee 0–10%.
- **`pension_projection.py`**: net rate = gross rate − balance fee; monthly contribution deducted by contribution fee % before projecting.
- **`pension_simulation/engine.py`**: `simulate()` now accepts `management_fee_balance_pct` and `management_fee_contribution_pct`; applies net rate and post-fee monthly amount in the FV formula.
- **`pension_simulation/router.py`**: passes `holding.management_fee_balance_pct` and `holding.management_fee_contribution_pct` to `engine.simulate()`.
- **Frontend**: fee input fields ("Fee on balance % / Fee on contribution %", with Hebrew labels דמי ניהול מצבירה / מהפקדות) added to both create and edit forms for `pension_fund` and `study_fund` holdings.

### Fixed

- **`pension_projection.py`**: `NameError` — `rate` renamed to `net_rate` consistently in the dict returned per fund.
- **Retirement Readiness double-counting**: `portfolio_mc_p50` Monte Carlo was running on total portfolio (including pension balances), then added to `pension_projected` (future value of those same accounts). Fixed to run MC on non-pension holdings only.

### Changed

- **Admin panel** (`/admin`): new page for multi-tenant management. Shows stats (total users, profiles, unassigned), users table with promote/demote/delete, profiles table with inline user assignment. Only visible to `role=admin` users (link shown in sidebar).
- **`app/admin/`**: `router.py`, `schemas.py`, `dependencies.py` — `require_admin` dependency checks `current_user.role == "admin"`.
- **Auth**: replaced `passlib[bcrypt]` with direct `bcrypt` calls (`bcrypt.hashpw` / `bcrypt.checkpw`) to resolve incompatibility with `bcrypt>=4.0.0`.

---

## [0.59.0] — 2026-05-14

### Added — Production Auth & Multi-user

- **DB migration 0024** (`0024_users`): creates `users` table (`id`, `email`, `password_hash`, `role`, `created_at`) and adds nullable `user_id` FK on `investor_profiles`.
- **Migration chain fixed**: migration 0025 `down_revision` updated from 0023 → 0024.
- **Auth module** (`app/auth/`): JWT-based auth using `python-jose` + `bcrypt` via `passlib`.
  - `POST /api/v1/auth/register` — create account (email + password)
  - `POST /api/v1/auth/login` — returns `access_token` (7-day JWT, HS256)
  - `GET /api/v1/auth/me` — returns current user info
- **All API routes protected**: `Depends(get_current_user)` applied globally via `app.include_router(..., dependencies=[...])`.
- **Investor profiles scoped by user**: `GET /api/v1/investors` filters by `user_id`; `POST /api/v1/investors` sets `user_id` from JWT; ownership checked on GET/PUT/DELETE by ID.
- **Frontend auth flow**: login page updated with email/password auth step before profile selection; JWT stored in `localStorage` as `tradeops_token`.
- **Auth fetch patch**: `AuthFetchPatch` component in dashboard layout globally injects `Authorization: Bearer` into all `/api/` requests (covers pages using raw `fetch`).
- **`api.ts` updated**: injects token header, clears token + investor ID and redirects to `/login` on 401.
- **`useInvestorId` hook**: now checks for both `tradeops_token` and `tradeops_investor_id`; redirects to `/login` if either is missing.
- **Sidebar logout**: now clears both `tradeops_token` and `tradeops_investor_id`.

---

## [0.58.0] — 2026-05-13

### Added — Mobile-First Responsive UI
- **Collapsible sidebar on mobile**: desktop keeps fixed left sidebar; mobile gets a hamburger top bar that opens a full-height drawer overlay.
- **Responsive layout**: `DashboardLayout` adds `pt-14 lg:pt-0` and `lg:ml-60` so content accounts for the mobile top bar.
- **All dashboard pages**: outer containers changed from fixed `p-8` to responsive `p-4 sm:p-6 lg:p-8`, and `space-y-6 lg:space-y-8`.
- **Holdings tables**: wrapped in `overflow-x-auto` with `min-w-[600px]` so they scroll horizontally on narrow screens.
- Close-on-navigate: drawer auto-closes when the route changes.

---

## [0.57.0] — 2026-05-13

### Added — Broker Auto-Sync Scheduler
- **DB migration 0025** (`0025_account_auto_sync`): adds `auto_sync_enabled` (bool), `last_synced_at` (timestamptz), and `sync_broker_type` (varchar) to `investment_accounts`.
- **Model + schema**: `InvestmentAccount` model and `InvestmentAccountOut` schema updated with new fields.
- **API endpoint**: `PATCH /api/v1/investors/{id}/accounts/{account_id}/auto-sync` — enables/disables daily auto-sync for a specific account.
- **Worker job** (`workers/jobs/broker_auto_sync.py`): daily at 09:00 UTC, refreshes market prices for all holdings in auto-sync-enabled accounts and updates `last_synced_at`.
- **Frontend**: "Sync/Auto" toggle button on each account card header (blue when active); tooltip shows last synced date.

---

## [0.56.0] — 2026-05-13

### Added — Altshuler Shaham Trade + ALTrade Import
- New parsers in `broker_sync/parsers/`:
  - `altshuler_shaham.py`: parses CSV and Excel (.xlsx) exports from Altshuler Shaham Trade. Supports bilingual (Hebrew/English) column headers using a 30+ alias mapping. Hebrew column names include שם ני"ע, כמות, מחיר ממוצע, שווי, מטבע and their English equivalents. Supports `windows-1255` encoding for Hebrew CSV files.
  - `altrade.py`: parses CSV and Excel exports from ALTrade with its own column alias set (Security/נייר ערך, Purchase Price/מחיר קנייה, Market Value/שווי שוק, etc.).
- Both parsers auto-detect header rows, skip total/summary rows, and handle malformed numeric values gracefully.

---

## [0.55.0] — 2026-05-13

### Added — Broker Import Framework + IBKR + eToro
- New `broker_sync` module (`schemas.py`, `service.py`, `router.py`, `parsers/`).
- **API endpoint**: `POST /api/v1/investors/{id}/accounts/{account_id}/broker-sync` — multipart upload with `file` + `broker_type` field.
- **Upsert logic**: matches existing holdings by ISIN → ticker → name (case-insensitive). Updates quantity, avg_buy_price, current_value on match; creates new holding otherwise. Returns `BrokerSyncResult { imported, updated, skipped, errors }`.
- **IBKR Flex Query XML parser** (`parsers/ibkr.py`): reads `<OpenPosition>` elements (symbol, ISIN, description, position, costBasisPrice, markPrice, currency, assetCategory). Maps IBKR asset categories (STK/BOND/ETF/FUND/CRYPTO) to internal asset types.
- **eToro CSV parser** (`parsers/etoro.py`): reads portfolio export CSV (Asset, Units, Avg Open Rate, Estimated Current Value, Type). Skips CFD positions (not actual ownership).
- `openpyxl>=3.1.0` added to `requirements.txt` for Excel parsing.
- **Frontend**: new "Broker Import" button on each account card. Opens a modal with broker selector (IBKR, eToro, Altshuler Shaham, ALTrade), contextual format hint per broker, drag/click file upload, and result summary (N new · N updated · N skipped + error list if any).

---

## [0.54.0] — 2026-05-13

### Added — Goals Linked to Accounts
- **Alembic migration 0023**: nullable `linked_account_id` FK column on `financial_goals` → `investment_accounts.id` (ON DELETE SET NULL). Zero downtime — existing rows unaffected.
- `FinancialGoal` model: new `linked_account_id` mapped column.
- `FinancialGoalCreate` / `FinancialGoalUpdate` / `FinancialGoalOut` schemas: added `linked_account_id: uuid | None` and `linked_account_name: str | None` (resolved at API layer, not persisted).
- Goals router: `_enrich()` helper resolves account name from DB and sets `linked_account_name` on the response.
- Goals analysis engine: new `_GoalProxy` class that wraps a `FinancialGoal` and overrides `current_amount` / `progress_pct` with a live account value when set, without mutating the DB object. `analyze()` accepts `account_value_overrides: dict[str, float] | None`.
- Goals analysis service: `_account_current_value()` helper sums holdings' effective values (current_balance → current_value → cost basis) with FX conversion. Per-goal overrides are computed and passed to the engine.
- Frontend goals page: fetches investment accounts on load; goal create form has an optional "Link to investment account" selector (only shown when accounts exist); linked account name shown as a coloured pill on each goal card.

---

## [0.53.0] — 2026-05-13

### Added — Retirement Readiness Score
- New `retirement_readiness` module: `schemas.py`, `engine.py`, `router.py`.
- Pure engine combines pension projection (existing `pension_projection` module) + Monte Carlo P50 at retirement horizon (from `scenario_analysis`) + 4% safe withdrawal rate to produce a `ReadinessScore`.
- Score 0–100 based on income coverage ratio: projected monthly SWR income vs current monthly expenses. Verdicts: "On track" / "Mostly on track" / "At risk" / "Significant gap" / "Critical shortfall".
- `years_to_close_gap`: additional years of 7% growth needed to eliminate shortfall (shown only when gap exists).
- New API endpoint: `GET /api/v1/investors/{id}/retirement-readiness`.
- Dashboard: new `RetirementReadinessCard` component rendered after pension projection — shows score gauge, monthly income vs expenses, surplus/shortfall, breakdown tiles (total at retirement, pension, MC P50, years to retirement), and amber warning with years-to-close-gap if shortfall exists.
- Stress-test page: new "Retirement Readiness" section with full score display, metric grid, score bar, breakdown tiles, and shortfall warning.

---

## [0.52.0] — 2026-05-12

### Added — Realized P&L from closed positions
- WAVG cost-basis computation from buy/sell transaction log (`holding_transactions`). For each sell, realized P&L = proceeds − WAVG unit cost × quantity. Aggregated as `realized_pnl_total` (all time) and `realized_pnl_ytd` (current calendar year) in base currency.
- `PortfolioSummary` schema: added `realized_pnl_total` and `realized_pnl_ytd` fields.
- Investments page: 5th summary card "Realized P&L" shows total and YTD gains from closed positions; displays `—` when no sell transactions exist; grid changed to responsive 5-column layout.

### Added — Money-Weighted Return (IRR)
- Newton-Raphson IRR computed from all buy transactions as cash outflows vs current portfolio value as inflow. Annualized to produce `mwr_pct` (% / year).
- `PerformanceAnalytics` schema: added `mwr_pct: float | None`.
- Performance page: "Total Return" card relabeled "Total Return (TWR)"; MWR/IRR displayed as a sub-section with contrasting color. TWR vs MWR gap reveals whether deposit timing helped or hurt overall return.
- Analytics router queries buy transactions, converts to base currency, and passes cash flows to the engine.

### Added — Actionable rebalancing with exact unit counts
- `SuggestedTrade` model: `ticker`, `name`, `action` (buy/sell), `suggested_units`, `unit_price`, `estimated_value`, `currency`.
- `RebalanceTier` now includes `suggested_trades: list[SuggestedTrade]`. For each off-target tier, the largest live-priced holding in that tier is selected: `suggested_units = gap_amount / unit_price_base`.
- Investments page rebalance section: generic "Buy ~X ILS" replaced with "↑ Buy ~12.34 units TICKER @ 120.00 ≈ 1,480 ILS" actionable guidance. Falls back to monetary hint when no live-priced holdings are present in the tier.

---

## [0.51.0] — 2026-05-11

### Fixed — Fee-inclusive cost basis
- Brokerage fees (`InvestmentHolding.fees`) are now added to cost basis: `cost_local = quantity × avg_buy_price + fees`. Previously fees were tracked but ignored, overstating P&L for holdings with transaction costs.

### Fixed — Pension fund tax treatment
- Pension funds (`pension_fund`) and study funds (`study_fund`) no longer have flat 25% capital gains tax applied. They are taxed as income at withdrawal (not CGT) with a substantial exemption — applying CGT was producing a vastly inflated tax burden in the UI and PDF report.

### Added — Price staleness warning
- `PortfolioSummary` now exposes `has_stale_prices: bool` and `prices_updated_at: datetime | None`
- Engine sets `has_stale_prices = True` when any tickered holding falls back to cost basis (no live or manual price available)
- Service tracks the oldest live-price timestamp and surfaces it to the frontend
- Investments page shows an amber warning banner when prices are stale, prompting the user to click "Refresh prices"

### Added — Beta vs benchmark metric
- Performance analytics now computes **Beta** (portfolio sensitivity to benchmark). Beta = Cov(portfolio returns, benchmark returns) / Var(benchmark returns), computed by aligning portfolio snapshot periods with the benchmark daily series.
- Displayed as a 6th metric card on the Performance page alongside Sharpe/Sortino; `None` when fewer than 4 matched data points.

### Added — Per-holding CAGR in attribution
- `HoldingContribution` now includes `cagr_pct: float | None` — annualised return since purchase date. Formula: `(current_value / cost_basis) ^ (365/days_held) - 1`. Only computed for holdings with a `purchase_date` and held ≥ 30 days.
- Shown alongside return_pct in the Top Contributors and Top Detractors panels.

### Added — Single-stock concentration risk flag
- Portfolio correlation engine now flags any single ticker representing > 15% of the portfolio by value. Adds a warning to `ConcentrationRisk.warnings` and +20 pts to `risk_score` per concentrated ticker. Complements the existing sector-level concentration check (> 40%).

---

## [0.50.1] — 2026-05-10

### Fixed — Performance analytics: NAV-based return calculation

- **Root cause:** performance analytics computed returns by comparing raw `total_value` between snapshots. When the user adds new accounts/holdings between snapshots the portfolio value jumps, producing absurd "returns" (e.g. +25994%, 178522% volatility, Sharpe 7.31).
- **Fix:** both `engine.py` and `attribution.py` now compute returns using the NAV ratio `total_value / cost_basis` (normalised to cost basis). Capital additions move both `total_value` and `cost_basis` proportionally, so the ratio stays stable — only genuine price appreciation changes it.
- Affects: Total Return %, Annualised Return, Max Drawdown, Volatility, Sharpe, Sortino, rolling returns (1M/3M/6M/1Y), attribution total return.

---

## [0.50.0] — 2026-05-09

### Added — Professional Client Report (PDF Export)

- New module `reports/` — multi-page PDF report generator using `reportlab` (pure Python, no system dependencies, Docker-friendly)
- PDF report sections: cover page (investor name, period, base currency, generation timestamp), portfolio overview (value / cost basis / unrealized P&L + holdings table up to 30 rows), performance analytics (Sharpe, Sortino, max drawdown, annualised return, rolling returns 1M/3M/6M/1Y, benchmark comparison, top 5 contributors, top 5 detractors), stress test scenarios (5 historical crash scenarios + Monte Carlo P10/P50/P90), tax-loss harvesting summary (harvest candidates + disclaimer)
- New endpoint `GET /api/v1/investors/{id}/reports/pdf?period=monthly|quarterly` — returns `application/pdf` stream with correct `Content-Disposition` filename
- **Export PDF button** on Performance page — hover dropdown for Monthly / Quarterly report; triggers immediate browser download with generated filename
- Added `reportlab>=4.2.0` to `backend/requirements.txt`
- `.gitignore`: added `*.tsbuildinfo` pattern + untracked `frontend/tsconfig.tsbuildinfo`

---

## [0.49.0] — 2026-05-09

### Added — Tax-Loss Harvesting Alerts

- New module `tax_harvesting/` — detects portfolio holdings with unrealized losses above the 5% threshold that can offset capital gains
- Country-aware capital gains rate from the `tax_rules` engine (IL: 25%, US: 15% long-term, DE: 26.4%, FR: 30%)
- Per-opportunity fields: unrealized loss in base currency, loss %, holding period (days), short-term vs long-term flag, wash-sale risk warning (purchased <30 days ago), estimated tax saving
- Gain offsets: top 5 holdings with unrealized gains that could be partially offset by harvested losses
- New endpoint `GET /portfolio/tax-opportunities`
- **Tax Opportunities card** on Performance page: summary strip (total harvestable loss, estimated saving, offsettable gains count), per-candidate rows with all flags, gain offset chips, disclaimer footer
- README and admin-guide updated to reflect all Phase 8 features

---

## [0.48.0] — 2026-05-09

### Added — Dividend & Income Calendar

- New module `income_projection/` — fetches forward annual dividend rate + next ex-date via yfinance for all tickered holdings
- FX conversion: dividend income converted to investor base currency
- New endpoint `GET /portfolio/income`
- **Dividend Income card** on Investments page:
  - Annual income total, yield on value, yield on cost (3-box summary)
  - Upcoming ex-dividend dates in next 90 days with estimated payment
  - Top income-generating holdings ranked by annual income with mini bar chart + yield %
- Only appears when portfolio has dividend-paying holdings

---

## [0.47.0] — 2026-05-09

### Added — Scenario Analysis & Stress Testing

- New module `scenario_analysis/` — deterministic crash scenario engine + log-normal Monte Carlo
- **5 pre-built scenarios**: 2008 GFC (−50% equities), COVID crash (−34%), 2022 Rate Hike Cycle (−18% bonds, −25% equities), 40% Tech Correction, ILS Depreciation Shock (+22% USD/ILS)
- **FX impact layer** — for ILS-base-currency portfolios, USD-denominated exposure is adjusted when dollar strengthens/weakens
- **Monte Carlo projection** — 1,000 log-normal simulations over years-to-retirement (derived from investor age); P10/P50/P90 fan chart
- New endpoint `GET /portfolio/stress-test`
- New `/stress-test` page — scenario cards (click to drill-down to per-tier breakdown), Monte Carlo fan chart with projected wealth at P10/P50/P90
- "Stress Test" nav link added to sidebar

---

## [0.46.0] — 2026-05-09

### Added — Professional Investment Intelligence

**Performance Attribution & Benchmark Comparison**
- New endpoint `GET /portfolio/attribution` — holding-level attribution + rolling returns + benchmark alpha
- **Rolling returns strip** on Performance page: 1M / 3M / 6M / 1Y returns from snapshot history in a clean 4-box grid
- **Alpha badge** — prominent green/red `α +X.XX% vs TA-35 / S&P 500` badge computed over full snapshot history
- **Top Contributors / Detractors** — two-column card showing which holdings drove portfolio gains and losses, with mini bar chart, weight %, and individual return %
- **Dynamic benchmark by currency** — ILS investors compare vs `^TA35` (Tel Aviv 35); USD/others compare vs SPY. Applies to both the analytics endpoint (line chart) and the new attribution endpoint

---

## [0.45.0] — 2026-05-09

### Added — Per-holding Emergency Fund flag
- **Migration 0022** — `is_emergency_fund` boolean column added to `investment_holdings` (server default `false`, non-breaking).
- **Holding-level EF toggle** — each holding row in the Investments page now has its own shield icon button; toggling it marks only that specific holding as emergency fund, rather than the entire account.
- **Amber "EF" badge** on holding name when the flag is active, consistent with account-level badge styling.
- **Risk model uses holding-level EF** — the scoring engine queries `investment_holdings.is_emergency_fund` first; falls back to `investment_accounts.is_emergency_fund` for backward compatibility. This means users who previously marked a full account still get correct EF month calculation.

### Fixed — Risk model investment valuation
- **Net worth now uses live prices** — `risk_modeling/service.py` calls `portfolio_service.get_portfolio()` (which applies live cached market prices + FX conversion) instead of falling back to `avg_buy_price` for holdings without a `current_value`. Previously, cost-basis was used as a proxy for unrealised holdings, overstating or understating actual value.
- **`total_assets` = manual financial assets + live portfolio total** in base currency.

---

## [0.44.0] — 2026-05-09

### Added — Investment portfolio visible in Financial Profile
- **Financial profile page** now shows a live "Investment Portfolio" card: pulls from the Investments module, lists each account with its current value, total unrealized P&L, and links to the Investments page.
- **Risk model net worth fix** — investment account holding values are now included in `total_assets` when computing net worth and Financial Stability Score. Previously only manually entered `financial_assets` counted — the portfolio was invisible to the scoring engine.

### Improved — Emergency Fund account linking discoverability
- **Create form** — "Use as emergency fund" labeled checkbox added directly to the "New investment account" form so the flag can be set at creation time, not only toggled after the fact.
- **`InvestmentAccountCreate` schema** — `is_emergency_fund: bool = False` field added.
- **Account card toggle** — the shield icon button now shows a labeled "EF" badge and uses an outlined amber style when active; previously it was an unlabeled ghost icon indistinguishable from other action buttons.

---

## [0.43.0] — 2026-05-09

### Added — Emergency Fund Account Linking
- **`is_emergency_fund` flag on `investment_accounts`** (migration 0021) — any investment account (e.g., קרן השתלמות study fund) can be designated as the user's emergency fund directly from the Investments page.
- **Risk model integration** — when an account is flagged, the scoring engine sums holding values (`current_balance` → `current_value` → cost basis) and divides by monthly expenses to compute emergency fund months automatically. Takes the higher of computed vs manually entered value.
- **Investments page UI** — shield icon button on each account card; amber ShieldCheck badge when active; tooltip on hover.

### Added — Kubernetes / Helm chart (`helm/tradeops/`)
- Full Helm chart: Backend Deployment + Service, Frontend Deployment + Service, PostgreSQL StatefulSet + headless Service + PVC, Ingress (routes `/api/*` to backend, `/*` to frontend), Secret, ServiceAccount, HPA.
- `values.yaml` covers image references, resource limits, PostgreSQL config, TLS, autoscaling, and external DB support.
- Ingress design: in K8s, `/api/*` is routed directly by the Ingress controller to the backend — no Next.js proxy needed.

### Added — ArgoCD GitOps (`argocd/application.yaml`)
- ArgoCD Application manifest targeting the Helm chart in this repo.
- Automated sync with prune + self-heal; creates the `tradeops` namespace automatically.

### Added — GitHub Actions CI/CD (`.github/workflows/docker-build-push.yml`)
- Builds multi-arch Docker images (amd64 + arm64) for backend and frontend on every push to `main`.
- Pushes to GHCR: `ghcr.io/erezrozenbaum/tradeops-backend` and `ghcr.io/erezrozenbaum/tradeops-frontend`.
- Tags with commit SHA and `latest`; version tags (`v*`) produce semver-tagged images.
- Commits updated image tags back to `helm/tradeops/values.yaml` so ArgoCD auto-deploys the new image.

### Added — Frontend Dockerfile (`frontend/Dockerfile`)
- Existing Dockerfile extended with `NEXT_PUBLIC_API_URL` build arg (defaults to `http://localhost:8000` for local dev; in K8s the ingress handles routing so this is irrelevant).

### Updated — Admin Guide (`docs/admin-guide.md`)
- Fully rewritten to v0.43.0: covers all features through this release, K8s Helm deployment, ArgoCD GitOps flow, GitHub Actions pipeline, all 21 DB migrations, troubleshooting for new features.

---

## [0.42.1] — 2026-05-09

### Fixed
- **Economic Calendar** — `datetime.date` objects from yfinance no longer silently parse to `None`; fix checks `isinstance(raw, date)` before `isinstance(raw, datetime)` so future earnings dates (e.g., NVDA 2026-05-20, NEM 2026-07-23) are returned correctly.
- **Holdings News Feed** — yfinance ≥0.2.x nests article data under a `content` key; parser now reads `content.title`, `content.provider.displayName`, `content.canonicalUrl.url`, and `content.pubDate` (ISO 8601) with fallback to the old flat format.

---

## [0.42.0] — 2026-05-08

### Added — Economic Calendar
- **`economic_calendar/` module** — fetches upcoming earnings dates for all held + watched tickers via yfinance `.calendar`. Cached 24h per ticker.
- **`GET /api/v1/investors/{id}/calendar`** — returns `EarningsEvent` list sorted by date ascending.
- **Dashboard earnings panel** — "Upcoming Earnings" card showing ticker, company, date, and days-until indicator (amber ≤7d, blue ≤14d).
- **Investments page earnings badge** — each holding row shows an inline "Earnings in Xd" badge for tickers with upcoming earnings.

### Added — Correlation Matrix & Concentration Risk
- **`portfolio_correlation/` module** — computes pairwise Pearson correlation using 90-day daily return history from yfinance. Flags pairs >0.8 as high-correlation. Sector concentration analysis: >40% in single sector is flagged. Risk score 0–100.
- **`GET /api/v1/investors/{id}/portfolio/correlation`** — returns full correlation matrix + concentration risk.
- **Performance page heatmap** — colour-coded correlation matrix (red=high, amber=moderate, green=negative). Concentration Risk card with sector weight bars, warnings, and risk score badge. Loads independently (non-blocking).

### Added — Position Sizing & Max-Loss Guidance
- **`InstrumentRecommendation` schema extended** — adds `suggested_position_size_pct`, `max_loss_amount`, `stop_loss_note` fields (all optional for backward compatibility).
- **Analyzer prompt updated** — Claude now provides per-recommendation position sizing: % of investable capital (capped at 10% per position) + monetary max loss at a 10% stop-loss.
- **Recommendations page** — position size and max-loss badges rendered on each instrument card.

### Added — Holdings News Feed
- **`holdings_news/` module** — fetches recent headlines for held + watched tickers via yfinance `.news`. Cached 1h per ticker.
- **`GET /api/v1/investors/{id}/news?limit=20`** — returns `NewsItem` list sorted by date descending.
- **`/news` page** — standalone news feed page, grouped by ticker with clickable headlines and publisher metadata. Accessible via sidebar "News Feed".
- **Dashboard news widget** — "Holdings News" card showing top 5 headlines with ticker labels and dates.

### Note — CSV Import
- Already fully implemented in a prior session. Backend: `holdings/csv_parser.py` + `POST /import-csv` endpoint. Frontend: per-account CSV upload button on investments page.

---

## [0.41.0] — 2026-05-08

### Fixed
- **API URL routing** — Performance, Transactions, and Watchlist pages were calling `http://backend:8000` directly from the browser (unresolvable Docker hostname). Changed all three pages to use relative `/api/v1/...` URLs which route through the Next.js rewrite proxy correctly.

### Added
- **Help & Guide page** (`/help`) — Full user guide surfaced in the UI: recommended onboarding flow (8 steps), per-page descriptions for every section (Personal, Strategy, Portfolio, Intelligence, System), and technical notes (API key setup, snapshot timing, migrations). Accessible via sidebar "Help & Guide".
- **Market research AI result cache** — Backend now caches the Claude AI analysis output per investor for 6 hours, matching the screener cache TTL. Subsequent requests within the cache window return instantly instead of re-running a 45-60s Claude API call.
- **Market research loading progress** — Loading state now shows elapsed seconds, phase-based step labels ("Fetching market data…", "Screening fundamentals…", "Generating AI theses…"), and step completion indicators so users know the analysis is still running.

---

## [0.40.1] — 2026-05-08

### Fixed
- **Frontend type errors** — replaced invalid `Badge variant="outline"` with `variant="muted"` / `variant="warning"` in performance and watchlist pages; replaced Radix-style `SelectItem/SelectTrigger/SelectContent/SelectValue` imports with native `<select>` + `<option>` in transactions page to match project's plain HTML select component. Resolves CI type-check failures.

---

## [0.40.0] — 2026-05-08

### Added — Performance History & Equity Curve
- **Daily snapshot writer** (`workers/jobs/snapshot_writer.py`) — runs at 21:00 UTC, captures portfolio state for all investors with holdings; idempotent (one snapshot per investor per day).
- **`/portfolio/history` period filter** — endpoint now accepts `period=1m|3m|6m|1y|all` instead of just `limit`; returns up to 500 snapshots for the requested range.
- **`/performance` page** — equity curve (AreaChart), cost-basis overlay, period selector (1M/3M/6M/1Y/All), key metric cards (Total Return, Max Drawdown, Sharpe, Volatility, vs S&P 500).

### Added — Core Risk Metrics
- **`performance_analytics/` module** — pure-Python engine computing: total return %, annualised CAGR, max drawdown, current drawdown, Sharpe ratio, Sortino ratio, annualised volatility, best/worst snapshot period.
- **SPY benchmark comparison** — yfinance-fetched cumulative return series normalised to portfolio start date; 24-hour in-memory cache.
- **`GET /investors/{id}/portfolio/analytics`** — returns `PerformanceAnalytics` JSON; period filter same as history endpoint.
- **Return vs benchmark chart** — dual-line chart on performance page showing portfolio % return vs S&P 500 from the same starting point.

### Added — Transaction Log / Trade Journal
- **Migration 0019** — `holding_transactions` table: investor_id, account_id, holding_id (nullable), transaction_type (buy/sell/dividend/fee/split/bonus), ticker, quantity, price_per_unit, total_amount, fees, currency, transaction_date, notes.
- **`transactions/` module** — full CRUD service + router.
- **`GET/POST /investors/{id}/transactions`** — list (with filters: account, ticker, type, date range) and create.
- **`GET/PUT/DELETE /investors/{id}/transactions/{tx_id}`** — read, update, delete.
- **`/transactions` page** — summary cards (total bought/sold/fees), add-transaction form with auto-computed total (qty × price), filterable table, delete with confirmation.

### Added — Price Alerts on Specific Levels
- **Migration 0020** — `price_alerts` table: investor_id, ticker, alert_type (above/below), target_price, currency, is_active, triggered_at, triggered_price.
- **`price_alerts/` module** — service + router.
- **`GET/POST /investors/{id}/alerts`** — list and create alerts.
- **`DELETE /investors/{id}/alerts/{alert_id}`** — delete/dismiss an alert.
- **`price_alert_checker` worker job** — runs at 20:30 UTC daily (after price refresh); checks all active alerts against latest cached prices; sets `triggered_at` + `triggered_price` on match.
- **Notifications integration** — triggered price alerts from last 7 days appear in the notification center with a link to Watchlist to delete/dismiss.
- **Watchlist page redesign** — Bell icon on each row opens price alert modal; shows active alert count badge and "Triggered!" badge; alert modal shows existing alerts with delete, and a type selector (above/below) + target price input.
- `snapshot_writer` and `price_alert_checker` jobs registered in `scheduler.py`.

### Changed
- `portfolio_analysis/service.py` — `get_history()` now accepts `since: datetime | None` for date-range filtering; added `has_snapshot_today()` deduplication helper.

---

## [0.39.0] — 2026-05-08

### Added
- **Tax Rules Engine** (`backend/app/tax_rules/`) — structured, country-specific tax rules injected into all AI context payloads (AI Report, AI Recommendations).
  - **Israel (IL):** 25% CGT on stocks/ETFs/crypto; pension fund (קרן פנסיה) retirement income correctly described as taxed as ordinary income with ~8,900 ILS/month exemption (NOT flat 25%); Keren Hishtalmut described as completely tax-free after 6 years; dividend rules; real estate rules; annual reporting requirements.
  - **United States (US):** STCG vs LTCG bracket table (2024); NIIT 3.8%; wash-sale rule; 401(k) traditional/Roth; IRA traditional/Roth with contribution limits and income phase-outs; crypto as property.
  - **United Kingdom (GB):** CGT rates by income band; annual exempt amount; ISA tax-free account with £20k limit; SIPP.
  - **Germany (DE):** 26.375% effective rate (Abgeltungssteuer + solidarity surcharge); €1,000 annual exempt amount.
  - **France (FR):** 30% PFU; PEA account tax-free after 5 years.
- `get_tax_context_for_investor(investor)` service — resolves country from `tax_residency` or `country` field and returns structured rules + AI-readable summary text.

### Changed
- `ai_analysis/analyzer.py` — `build_context()` now accepts `tax_context` kwarg and includes `tax_rules` key in Claude context. System prompt updated with explicit instructions to use country-specific tax rules and correct common Israeli tax misconceptions.
- `ai_analysis/service.py` — fetches tax context and passes it to `build_context()`.
- `investment_recommendations/analyzer.py` — `build_recommendation_context()` now accepts `tax_context`; system prompt updated with tax-efficiency guidance (prioritise Keren Hishtalmut for IL, 401k/IRA for US, distinguish LTCG from STCG).
- `investment_recommendations/service.py` — fetches tax context and passes it to the recommendation context builder.

---

## [0.38.2] — 2026-05-08

### Added
- **Crypto universe in Market Research** — BTC, ETH, SOL, BNB, XRP fetched from yfinance and passed to Claude as a dedicated `crypto_universe` pool. Claude can now select 1–2 crypto picks for the high-opportunity tier based on 52-week entry signal. A "Crypto Universe" section on the page shows all 5 coins with entry score and 52-week range.
- **Full Screened Universe table** — collapsible table on the Market Research page showing all 25 scored stock candidates with: opportunity score, ticker, sector, price, analyst upside, forward P/E, revenue growth, net margin, and 52-week position. Users can now see the full screener output, not just AI-selected picks.
- **Crypto scoring function** (`_score_crypto`) — separate scoring for crypto assets using 52-week range position (0–60 pts) plus a base presence score (20 pts), since crypto has no P/E, analyst targets, or fundamental metrics.

### Changed
- **AI picks increased from 7–10 to 12–15** — prompt updated: stable tier 3–4 picks, moderate tier 5–6 picks, high-opportunity tier 3–4 picks (including optional 1–2 crypto).
- **`max_tokens` 4096 → 8096** in market research analyzer — prevents Claude's JSON response from being truncated mid-output on large screener contexts.
- **Sector ETF fix** — `hist["Close"].squeeze()` applied to handle yfinance multi-level column format; was silently returning 0 sectors on every startup.

### Fixed
- `research_prewarm` worker now handles the updated `run_screen()` 3-tuple return (fundamentals, sectors, crypto).

---

## [0.38.1] — 2026-05-08

### Fixed
- **Market Research page returning 404** — `@router.get("/")` in `market_research/router.py` registered the route with a trailing slash. With `redirect_slashes=False` set globally, requests to `/market-research` (no slash) were never matched. Changed to `@router.get("")` to match all other routers in the project.

---

## [0.38.0] — 2026-05-07

### Added
- **Deep Market Research Engine** — new `market_research/` backend module + `/market-research` frontend page providing genuine fundamental analysis, not generic ETF advice.
  - **Fundamental screener**: screens 60+ stocks and ETFs across 8 sectors using `yfinance` (free, no API key). Scores each instrument on 5 axes: analyst conviction (upside to consensus target + rating), valuation (forward P/E, PEG ratio), revenue growth, quality (profit margin, ROE), and 52-week entry position. Results cached 6 hours; concurrent fetching via `ThreadPoolExecutor(max_workers=10)`.
  - **Sector performance tracking**: live 1M / 3M / 1Y returns for XLK, XLF, XLV, XLE, XLY, XLI, XLC, XLU sector ETFs with bullish/neutral/bearish classification.
  - **AI investment brief**: Claude Sonnet receives top 25 screened candidates with full fundamentals + sector data + investor profile. Returns specific, data-backed investment theses across three tiers (stable / moderate / high_opportunity). Each thesis references actual P/E ratios, revenue growth, analyst targets, and time-horizon reasoning — not generic advice.
  - **Three-tier portfolio construction**: stable (30–35%), moderate growth (40%), high opportunity (20–25%) — matching the portfolio allocation the user described.
  - **Frontend page** at `/market-research`: sector performance grid, three-tier pick cards with expanded "Why now" / "Key risk" panels, key metric pills (forward P/E, revenue growth, net margin, dividend yield, 52w range position), analyst target + upside display, 6h localStorage cache with stale banner.
  - **Research pre-warm background job**: runs on startup and every 6 hours to keep the fundamental cache warm, eliminating cold-start latency.
  - **Route Handler** with 120s timeout and 3-attempt retry (8s/16s backoff) for the long-running screener+AI call.
  - `yfinance>=0.2.36` added to `requirements.txt`.
  - 20 unit tests for the screener scoring algorithm.

---

## [0.37.0] — 2026-05-06

### Fixed
- **AI Recommendations always failing** — `generate_recommendations` called `json.loads(raw)` with no error handling; when Claude returned malformed JSON the unhandled exception propagated through FastAPI → Next.js proxy returned an HTML error page → frontend showed generic "Failed to generate recommendations". Now returns a safe fallback dict on JSON parse failure.
- **AI Report always failing (schema mismatch)** — `AnalysisReportOut` Pydantic schema was missing `portfolio_analysis` and `goals_progress` fields that the AI prompt generates; Pydantic validation rejected every response → all AI reports returned 422. Both fields added to schema.
- **AI Report JSON parse error** — `generate_report` had the same unhandled `json.loads` call; fixed with same safe fallback pattern.
- **Long-running AI requests dropped on uvicorn reload** — Recommendations and AI Report endpoints went through the generic Next.js fallback rewrite (no retry, no timeout). Created dedicated Route Handlers for both with 3-attempt retry logic and 90s timeout, matching the agent endpoint pattern.

### Changed
- **AI model upgraded: Haiku → Sonnet** — both `investment_recommendations/analyzer.py` and `ai_analysis/analyzer.py` now use `claude-sonnet-4-6` instead of `claude-haiku-4-5-20251001`. Sonnet produces more reliable structured JSON output for complex multi-schema prompts, reducing parse failures.
- **Market scanner cache pre-warmed on startup** — new `market_prewarm` background job runs immediately on server start and every 30 minutes thereafter, keeping the 30-minute in-memory signal cache warm. Previously, a cold cache added 20-40 seconds to every recommendations request because the parallel Yahoo Finance calls ran inline.
- **AI pages load instantly from cache** — Agent, Recommendations, and AI Report pages now persist the last successful result to `localStorage`. On next visit the report is shown immediately with a "Generated X ago" label; a "Refresh now" prompt appears when the cache is stale (12h for agent, 24h for recommendations/reports).
- **Actionable error messages** — all three AI pages now map HTTP status codes to specific messages: 503 → API key not configured; 502 → backend unreachable; 404 → investor not found. Generic "Please try again" replaced throughout.
- **Setup guidance in empty states** — when no cached report exists, all three AI pages show a setup card with direct links to Financial Profile, Risk Model, Holdings (and Goals/Backtests/Paper Trading for reports), explaining what data improves AI output quality.

---

## [0.36.0] — 2026-05-06

### Added
- **Live Market Opportunity Engine** — replaces static catalog recommendations with real market intelligence:
  - New `live_market_intel` module: `fetcher.py` pulls live data from CoinGecko Markets API (top crypto with 24h/7d changes) and Yahoo Finance (stocks/ETFs with 52-week range + 7-day price history); `scanner.py` classifies each instrument as `dip / near_low / recovery / momentum / stable` and ranks by opportunity score; 30-minute in-memory cache to avoid excessive API calls
  - AI recommendations engine now receives real price data (current price, 24h%, 7d%, 52w position, signal note) for every instrument before generating advice — recommendations now reference actual market conditions
  - New `Live Market Signals` section on recommendations page: grid of signal cards with current price, 24h/7d % badges (green/red), signal type badge, 52-week range bar, and "Add to Watchlist" button; only shows non-stable signals
  - Catalog expanded: +3 crypto (SOL-USD, BNB-USD, ADA-USD), +4 high-growth stocks (AMD, PLTR, NFLX, CRM), +3 financial/value stocks (JPM, V, XOM) — total 57 instruments
  - CoinGecko ID map in `market_data/fetcher.py` extended for SOL, BNB, ADA so individual quote lookups work

---

## [0.35.0] — 2026-05-02

### Changed
- **Investment Recommendations — Actionable Roadmap redesign** — AI now generates a structured `investment_roadmap` with three risk tiers (Conservative / Balanced / Growth), each showing exact monthly amounts per instrument and a phase timeline (where you are now → what comes next). Frontend redesigned to lead with the roadmap: tabbed tier selector, per-instrument "Add to watchlist" button, phase progress cards, and a compact situation summary. Removes wall-of-text guidance in favour of concrete, numbers-first layout.

---

## [0.34.0] — 2026-05-02

### Added
- **Email alert digest** — new `notification_alerts` worker job runs daily at 08:30 UTC; queries all investors with `email_alerts_enabled=true`, calls the notification center for all actionable warnings (goals at risk, rebalancing needed, stale prices), and sends a single plain-text digest email per investor; requires `SMTP_HOST/USER/PASS` env vars
- **Settings page — Email Notifications section** — toggle to enable/disable alerts, email address input, Save button (calls `PUT /api/v1/investors/{id}`); inline SMTP setup guidance
- **`.env.example`** updated with SMTP configuration block and Gmail App Password instructions

### Changed
- `goal_evaluation` worker: removed per-alert email sending (now handled by `notification_alerts`); logging-only sweep remains at 07:00 UTC

---

## [0.33.0] — 2026-05-02

### Added
- **Dashboard "Today's priorities" card** — loads top AI action items from the Investment Agent on demand; shows action, ticker, suggested amount, urgency icon (Immediate / Soon / When ready); links to full `/agent` page
- **Pension & Study Fund projection card on dashboard** — new `GET /portfolio/pension-projection` endpoint; pure compound-growth engine (`pension_projection.py`) projects all `pension_fund` and `study_fund` holdings to retirement age (67); shows total projected value, years to retirement, combined monthly contribution, and estimated monthly retirement income (20-year drawdown); per-fund breakdown with assumed annual return rate

---

## [0.32.0] — 2026-05-02

### Changed
- **AI Recommendations — progress over paralysis**: Prompt rewritten to always deliver a concrete forward investment plan with specific instruments and monthly amounts, even for low-stability investors. Removed "focus on emergency fund only" hard rule. Now mandates 4-6 recommendations including stocks and dividends, not just ETFs. `max_tokens` raised to 3500 for richer output.
- **Market Scanner — full catalog visible**: Removed `education_only` preservation-only gate; "Not Ready" investors now see the full instrument list ranked by their risk model, with a warning note instead of a hard filter. Shows real stocks, growth ETFs, crypto alongside preservation instruments.
- **Recommendations context** — `build_recommendation_context` now includes `spouse_income` in household income / surplus calculation (was using primary income only).
- **Investments page** — Family member section is always shown when creating an account (previously hidden when no members exist); now shows a link to the Family Profile page when no members are set up.

---

## [0.31.0] — 2026-05-02

### Added
- **Market scan gate removed** — "Not Ready" investors now see preservation/education instruments instead of a hard block; soft warning banner replaces the empty screen
- **Household income model** — `spouse_income` field on financial profiles (migration 0018); goals analysis, AI report, and AI agent now use combined household income for surplus/savings-rate calculations; partner income shown as separate stat card on Financial page
- **Account → family member assignment** (migration 0018) — investment accounts can now be attached to a specific family member; family member name shown on account card header; member selector appears in the "New account" form when a family profile exists
- **AI signals on Market Scan page** — "Ask AI" button runs the AI Investment Agent and shows personalised buy signals (ticker, why now, suggested allocation %, fit score) inline on the scan page

### Changed
- Financial page: "Monthly income" renamed to "Primary income" when spouse_income is set; partner income shown as separate summary card
- Goals analysis surplus calculation uses household income (primary + spouse) instead of primary income only

---

## [0.30.0] — 2026-05-02

### Added
- **Portfolio value history** — `price_refresh` worker now saves a portfolio snapshot for every investor after daily price refresh; chart on investments page populates automatically over time
- **Debt Payoff Planner** — `GET /api/v1/investors/{id}/debt-planner?strategy=avalanche|snowball&extra_monthly=N`
  - Avalanche (highest-interest-first) and snowball (smallest-balance-first) strategies
  - Returns per-debt payoff order, months to debt-free, total interest, debt-free date
  - `/debt-planner` page: strategy selector, extra payment input, summary cards, ordered debt cards
- **Watchlist** — track market instruments without owning them
  - Migration 0017: `watchlist_items` table with unique constraint per investor+ticker
  - `GET/POST/DELETE /api/v1/investors/{id}/watchlist` — cached price and age enriched on read
  - Daily `price_refresh` worker now also fetches prices for watchlist tickers
  - `/watchlist` page: add by ticker/name/type, shows current price and data age
- **In-app Notification Center** — computed on-the-fly from existing data
  - `GET /api/v1/investors/{id}/notifications` — returns at-risk goals, rebalance alerts, stale prices, setup suggestions
  - `/notifications` page: severity-grouped list with direct navigation links
  - Sidebar: Notifications link in System section
- **AI Investment Agent** — flagship multi-context Claude agent
  - `GET /api/v1/investors/{id}/agent` — gathers full investor context (profile, portfolio, goals, stability score, risk model, 40+ catalog instruments with live prices) and calls Claude Sonnet
  - Returns: `portfolio_health_score` (0-100), `market_pulse`, `portfolio_assessment`, `action_plan` (concrete actions with amounts), `top_opportunities` (fit-scored instruments), `capital_thresholds` (step-by-step plan at each savings milestone), `risk_warnings`
  - Capital thresholds: tells you exactly what to buy with 500 / 1000 / 2500 / 5000 base-currency units — the plan is ready when you have the capital
  - `/agent` page: health score ring, market pulse, action cards with urgency badges, opportunity grid with fit scores, visual capital ladder, risk warnings
  - Sidebar: "AI Agent" as the first item in the Intelligence section

---

## [0.29.0] — 2026-05-02

### Fixed
- **Migration 0014 enum name** — corrected `ALTER TYPE` target from `asset_type` to `assettype` (the actual PostgreSQL type name created in migration 0001); backend now starts cleanly after migration
- **Profile save failure** — `nationality` and `tax_residency` columns were `VARCHAR(3)` but accept full country names from the UI; migration 0016 widens both to `VARCHAR(100)`
- **CSV file upload** — added `python-multipart` to `requirements.txt`; FastAPI requires this package for any `UploadFile` / `File(...)` endpoint (the CSV import endpoint introduced in 0.28.0 was broken without it)

---

## [0.28.0] — 2026-05-02

### Fixed
- **Risk model auto-regeneration** — profile save now fires `POST /risk-model` in background so the risk model stays in sync with profile changes (experience level, risk tolerance, time horizon, etc.)
- **Vehicle as a financial asset type** — added `vehicle` to the `AssetType` enum; migration 0014 adds it to the PostgreSQL enum; financial profile add/edit dropdowns now include "Vehicle"

### Added
- **Email alerts** — daily goal at-risk notifications via SMTP
  - Migration 0015: adds `alert_email` (VARCHAR 255) and `email_alerts_enabled` (BOOLEAN, default false) to `investor_profiles`
  - `app/notifications/email.py` — `send_alert_email()` using `smtplib` + STARTTLS; silent no-op when SMTP env vars are absent
  - `goal_evaluation` worker now sends personalised alert email to any investor who has `email_alerts_enabled=true` and at-risk goals
  - Profile page: "Email Alerts" section with alert email address field + enable checkbox in edit form; view mode shows current settings
  - Configure via env: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `ALERT_FROM_EMAIL`
- **CSV import for holdings** — bulk import holdings from a CSV file
  - Backend: `POST /api/v1/investors/{id}/accounts/{account_id}/holdings/import-csv` — accepts multipart CSV upload; returns `{ imported, errors }`
  - `app/holdings/csv_parser.py` — parses rows, validates `asset_type`, handles UTF-8/BOM/Latin-1, returns per-row errors for invalid rows while continuing to import valid ones
  - CSV format: `name`, `asset_type`, `currency` (required); `ticker`, `isin`, `quantity`, `avg_buy_price`, `purchase_date`, `notes` (optional)
  - Investments page: "CSV" button on each account card header triggers a hidden file picker; result banner shows imported count and any row errors

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

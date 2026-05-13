# Changelog

All notable changes to TradeOps AI are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).  
Versions are assigned retroactively to match the git commit history.

---

## [Unreleased]

---

## [0.56.0] — 2026-05-13

### Added — TASK 56: Altshuler Shaham Trade + ALTrade Import
- New parsers in `broker_sync/parsers/`:
  - `altshuler_shaham.py`: parses CSV and Excel (.xlsx) exports from Altshuler Shaham Trade. Supports bilingual (Hebrew/English) column headers using a 30+ alias mapping. Hebrew column names include שם ני"ע, כמות, מחיר ממוצע, שווי, מטבע and their English equivalents. Supports `windows-1255` encoding for Hebrew CSV files.
  - `altrade.py`: parses CSV and Excel exports from ALTrade with its own column alias set (Security/נייר ערך, Purchase Price/מחיר קנייה, Market Value/שווי שוק, etc.).
- Both parsers auto-detect header rows, skip total/summary rows, and handle malformed numeric values gracefully.

---

## [0.55.0] — 2026-05-13

### Added — TASK 54+55: Broker Import Framework + IBKR + eToro
- New `broker_sync` module (`schemas.py`, `service.py`, `router.py`, `parsers/`).
- **API endpoint**: `POST /api/v1/investors/{id}/accounts/{account_id}/broker-sync` — multipart upload with `file` + `broker_type` field.
- **Upsert logic**: matches existing holdings by ISIN → ticker → name (case-insensitive). Updates quantity, avg_buy_price, current_value on match; creates new holding otherwise. Returns `BrokerSyncResult { imported, updated, skipped, errors }`.
- **IBKR Flex Query XML parser** (`parsers/ibkr.py`): reads `<OpenPosition>` elements (symbol, ISIN, description, position, costBasisPrice, markPrice, currency, assetCategory). Maps IBKR asset categories (STK/BOND/ETF/FUND/CRYPTO) to internal asset types.
- **eToro CSV parser** (`parsers/etoro.py`): reads portfolio export CSV (Asset, Units, Avg Open Rate, Estimated Current Value, Type). Skips CFD positions (not actual ownership).
- `openpyxl>=3.1.0` added to `requirements.txt` for Excel parsing.
- **Frontend**: new "Broker Import" button on each account card. Opens a modal with broker selector (IBKR, eToro, Altshuler Shaham, ALTrade), contextual format hint per broker, drag/click file upload, and result summary (N new · N updated · N skipped + error list if any).

---

## [0.54.0] — 2026-05-13

### Added — TASK 51: Goals Linked to Accounts
- **Alembic migration 0023**: nullable `linked_account_id` FK column on `financial_goals` → `investment_accounts.id` (ON DELETE SET NULL). Zero downtime — existing rows unaffected.
- `FinancialGoal` model: new `linked_account_id` mapped column.
- `FinancialGoalCreate` / `FinancialGoalUpdate` / `FinancialGoalOut` schemas: added `linked_account_id: uuid | None` and `linked_account_name: str | None` (resolved at API layer, not persisted).
- Goals router: `_enrich()` helper resolves account name from DB and sets `linked_account_name` on the response.
- Goals analysis engine: new `_GoalProxy` class that wraps a `FinancialGoal` and overrides `current_amount` / `progress_pct` with a live account value when set, without mutating the DB object. `analyze()` accepts `account_value_overrides: dict[str, float] | None`.
- Goals analysis service: `_account_current_value()` helper sums holdings' effective values (current_balance → current_value → cost basis) with FX conversion. Per-goal overrides are computed and passed to the engine.
- Frontend goals page: fetches investment accounts on load; goal create form has an optional "Link to investment account" selector (only shown when accounts exist); linked account name shown as a coloured pill on each goal card.

---

## [0.53.0] — 2026-05-13

### Added — TASK 50: Retirement Readiness Score
- New `retirement_readiness` module: `schemas.py`, `engine.py`, `router.py`.
- Pure engine combines pension projection (existing `pension_projection` module) + Monte Carlo P50 at retirement horizon (from `scenario_analysis`) + 4% safe withdrawal rate to produce a `ReadinessScore`.
- Score 0–100 based on income coverage ratio: projected monthly SWR income vs current monthly expenses. Verdicts: "On track" / "Mostly on track" / "At risk" / "Significant gap" / "Critical shortfall".
- `years_to_close_gap`: additional years of 7% growth needed to eliminate shortfall (shown only when gap exists).
- New API endpoint: `GET /api/v1/investors/{id}/retirement-readiness`.
- Dashboard: new `RetirementReadinessCard` component rendered after pension projection — shows score gauge, monthly income vs expenses, surplus/shortfall, breakdown tiles (total at retirement, pension, MC P50, years to retirement), and amber warning with years-to-close-gap if shortfall exists.
- Stress-test page: new "Retirement Readiness" section with full score display, metric grid, score bar, breakdown tiles, and shortfall warning.

---

## [0.52.0] — 2026-05-12

### Added — TASK 48: Realized P&L from closed positions
- WAVG cost-basis computation from buy/sell transaction log (`holding_transactions`). For each sell, realized P&L = proceeds − WAVG unit cost × quantity. Aggregated as `realized_pnl_total` (all time) and `realized_pnl_ytd` (current calendar year) in base currency.
- `PortfolioSummary` schema: added `realized_pnl_total` and `realized_pnl_ytd` fields.
- Investments page: 5th summary card "Realized P&L" shows total and YTD gains from closed positions; displays `—` when no sell transactions exist; grid changed to responsive 5-column layout.

### Added — TASK 49: Money-Weighted Return (IRR)
- Newton-Raphson IRR computed from all buy transactions as cash outflows vs current portfolio value as inflow. Annualized to produce `mwr_pct` (% / year).
- `PerformanceAnalytics` schema: added `mwr_pct: float | None`.
- Performance page: "Total Return" card relabeled "Total Return (TWR)"; MWR/IRR displayed as a sub-section with contrasting color. TWR vs MWR gap reveals whether deposit timing helped or hurt overall return.
- Analytics router queries buy transactions, converts to base currency, and passes cash flows to the engine.

### Added — TASK 52: Actionable rebalancing with exact unit counts
- `SuggestedTrade` model: `ticker`, `name`, `action` (buy/sell), `suggested_units`, `unit_price`, `estimated_value`, `currency`.
- `RebalanceTier` now includes `suggested_trades: list[SuggestedTrade]`. For each off-target tier, the largest live-priced holding in that tier is selected: `suggested_units = gap_amount / unit_price_base`.
- Investments page rebalance section: generic "Buy ~X ILS" replaced with "↑ Buy ~12.34 units TICKER @ 120.00 ≈ 1,480 ILS" actionable guidance. Falls back to monetary hint when no live-priced holdings are present in the tier.

---

## [0.51.0] — 2026-05-11

### Fixed — TASK 42: Fee-inclusive cost basis
- Brokerage fees (`InvestmentHolding.fees`) are now added to cost basis: `cost_local = quantity × avg_buy_price + fees`. Previously fees were tracked but ignored, overstating P&L for holdings with transaction costs.

### Fixed — TASK 43: Pension fund tax treatment
- Pension funds (`pension_fund`) and study funds (`study_fund`) no longer have flat 25% capital gains tax applied. They are taxed as income at withdrawal (not CGT) with a substantial exemption — applying CGT was producing a vastly inflated tax burden in the UI and PDF report.

### Added — TASK 44: Price staleness warning
- `PortfolioSummary` now exposes `has_stale_prices: bool` and `prices_updated_at: datetime | None`
- Engine sets `has_stale_prices = True` when any tickered holding falls back to cost basis (no live or manual price available)
- Service tracks the oldest live-price timestamp and surfaces it to the frontend
- Investments page shows an amber warning banner when prices are stale, prompting the user to click "Refresh prices"

### Added — TASK 45: Beta vs benchmark metric
- Performance analytics now computes **Beta** (portfolio sensitivity to benchmark). Beta = Cov(portfolio returns, benchmark returns) / Var(benchmark returns), computed by aligning portfolio snapshot periods with the benchmark daily series.
- Displayed as a 6th metric card on the Performance page alongside Sharpe/Sortino; `None` when fewer than 4 matched data points.

### Added — TASK 46: Per-holding CAGR in attribution
- `HoldingContribution` now includes `cagr_pct: float | None` — annualised return since purchase date. Formula: `(current_value / cost_basis) ^ (365/days_held) - 1`. Only computed for holdings with a `purchase_date` and held ≥ 30 days.
- Shown alongside return_pct in the Top Contributors and Top Detractors panels.

### Added — TASK 47: Single-stock concentration risk flag
- Portfolio correlation engine now flags any single ticker representing > 15% of the portfolio by value. Adds a warning to `ConcentrationRisk.warnings` and +20 pts to `risk_score` per concentrated ticker. Complements the existing sector-level concentration check (> 40%).

---

## [0.50.1] — 2026-05-10

### Fixed — Performance analytics: NAV-based return calculation

- **Root cause:** performance analytics computed returns by comparing raw `total_value` between snapshots. When the user adds new accounts/holdings between snapshots the portfolio value jumps, producing absurd "returns" (e.g. +25994%, 178522% volatility, Sharpe 7.31).
- **Fix:** both `engine.py` and `attribution.py` now compute returns using the NAV ratio `total_value / cost_basis` (normalised to cost basis). Capital additions move both `total_value` and `cost_basis` proportionally, so the ratio stays stable — only genuine price appreciation changes it.
- Affects: Total Return %, Annualised Return, Max Drawdown, Volatility, Sharpe, Sortino, rolling returns (1M/3M/6M/1Y), attribution total return.

---

## [0.50.0] — 2026-05-09

### Added — TASK 41: Professional Client Report (PDF Export)

- New module `reports/` — multi-page PDF report generator using `reportlab` (pure Python, no system dependencies, Docker-friendly)
- PDF report sections: cover page (investor name, period, base currency, generation timestamp), portfolio overview (value / cost basis / unrealized P&L + holdings table up to 30 rows), performance analytics (Sharpe, Sortino, max drawdown, annualised return, rolling returns 1M/3M/6M/1Y, benchmark comparison, top 5 contributors, top 5 detractors), stress test scenarios (5 historical crash scenarios + Monte Carlo P10/P50/P90), tax-loss harvesting summary (harvest candidates + disclaimer)
- New endpoint `GET /api/v1/investors/{id}/reports/pdf?period=monthly|quarterly` — returns `application/pdf` stream with correct `Content-Disposition` filename
- **Export PDF button** on Performance page — hover dropdown for Monthly / Quarterly report; triggers immediate browser download with generated filename
- Added `reportlab>=4.2.0` to `backend/requirements.txt`
- `.gitignore`: added `*.tsbuildinfo` pattern + untracked `frontend/tsconfig.tsbuildinfo`

---

## [0.49.0] — 2026-05-09

### Added — TASK 40: Tax-Loss Harvesting Alerts

- New module `tax_harvesting/` — detects portfolio holdings with unrealized losses above the 5% threshold that can offset capital gains
- Country-aware capital gains rate from the `tax_rules` engine (IL: 25%, US: 15% long-term, DE: 26.4%, FR: 30%)
- Per-opportunity fields: unrealized loss in base currency, loss %, holding period (days), short-term vs long-term flag, wash-sale risk warning (purchased <30 days ago), estimated tax saving
- Gain offsets: top 5 holdings with unrealized gains that could be partially offset by harvested losses
- New endpoint `GET /portfolio/tax-opportunities`
- **Tax Opportunities card** on Performance page: summary strip (total harvestable loss, estimated saving, offsettable gains count), per-candidate rows with all flags, gain offset chips, disclaimer footer
- README and admin-guide updated to reflect all Phase 8 features (TASK 37–40)

---

## [0.48.0] — 2026-05-09

### Added — TASK 39: Dividend & Income Calendar

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

### Added — TASK 38: Scenario Analysis & Stress Testing

- New module `scenario_analysis/` — deterministic crash scenario engine + log-normal Monte Carlo
- **5 pre-built scenarios**: 2008 GFC (−50% equities), COVID crash (−34%), 2022 Rate Hike Cycle (−18% bonds, −25% equities), 40% Tech Correction, ILS Depreciation Shock (+22% USD/ILS)
- **FX impact layer** — for ILS-base-currency portfolios, USD-denominated exposure is adjusted when dollar strengthens/weakens
- **Monte Carlo projection** — 1,000 log-normal simulations over years-to-retirement (derived from investor age); P10/P50/P90 fan chart
- New endpoint `GET /portfolio/stress-test`
- New `/stress-test` page — scenario cards (click to drill-down to per-tier breakdown), Monte Carlo fan chart with projected wealth at P10/P50/P90
- "Stress Test" nav link added to sidebar

---

## [0.46.0] — 2026-05-09

### Added — Phase 8: Professional Investment Intelligence (TASK 37)

**Performance Attribution & Benchmark Comparison**
- New endpoint `GET /portfolio/attribution` — holding-level attribution + rolling returns + benchmark alpha
- **Rolling returns strip** on Performance page: 1M / 3M / 6M / 1Y returns from snapshot history in a clean 4-box grid
- **Alpha badge** — prominent green/red `α +X.XX% vs TA-35 / S&P 500` badge computed over full snapshot history
- **Top Contributors / Detractors** — two-column card showing which holdings drove portfolio gains and losses, with mini bar chart, weight %, and individual return %
- **Dynamic benchmark by currency** — ILS investors compare vs `^TA35` (Tel Aviv 35); USD/others compare vs SPY. Applies to both the analytics endpoint (line chart) and the new attribution endpoint
- `docs/execution_plan.md` — Phase 8 added with TASK 37–41 specs

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

### Added — TASK 32: Economic Calendar
- **`economic_calendar/` module** — fetches upcoming earnings dates for all held + watched tickers via yfinance `.calendar`. Cached 24h per ticker.
- **`GET /api/v1/investors/{id}/calendar`** — returns `EarningsEvent` list sorted by date ascending.
- **Dashboard earnings panel** — "Upcoming Earnings" card showing ticker, company, date, and days-until indicator (amber ≤7d, blue ≤14d).
- **Investments page earnings badge** — each holding row shows an inline "Earnings in Xd" badge for tickers with upcoming earnings.

### Added — TASK 33: Correlation Matrix & Concentration Risk
- **`portfolio_correlation/` module** — computes pairwise Pearson correlation using 90-day daily return history from yfinance. Flags pairs >0.8 as high-correlation. Sector concentration analysis: >40% in single sector is flagged. Risk score 0–100.
- **`GET /api/v1/investors/{id}/portfolio/correlation`** — returns full correlation matrix + concentration risk.
- **Performance page heatmap** — colour-coded correlation matrix (red=high, amber=moderate, green=negative). Concentration Risk card with sector weight bars, warnings, and risk score badge. Loads independently (non-blocking).

### Added — TASK 34: Position Sizing & Max-Loss Guidance
- **`InstrumentRecommendation` schema extended** — adds `suggested_position_size_pct`, `max_loss_amount`, `stop_loss_note` fields (all optional for backward compatibility).
- **Analyzer prompt updated** — Claude now provides per-recommendation position sizing: % of investable capital (capped at 10% per position) + monetary max loss at a 10% stop-loss.
- **Recommendations page** — position size and max-loss badges rendered on each instrument card.

### Added — TASK 35: Holdings News Feed
- **`holdings_news/` module** — fetches recent headlines for held + watched tickers via yfinance `.news`. Cached 1h per ticker.
- **`GET /api/v1/investors/{id}/news?limit=20`** — returns `NewsItem` list sorted by date descending.
- **`/news` page** — standalone news feed page, grouped by ticker with clickable headlines and publisher metadata. Accessible via sidebar "News Feed".
- **Dashboard news widget** — "Holdings News" card showing top 5 headlines with ticker labels and dates.

### Note — TASK 36: CSV Import
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

### Added — TASK 28: Performance History & Equity Curve
- **Daily snapshot writer** (`workers/jobs/snapshot_writer.py`) — runs at 21:00 UTC, captures portfolio state for all investors with holdings; idempotent (one snapshot per investor per day).
- **`/portfolio/history` period filter** — endpoint now accepts `period=1m|3m|6m|1y|all` instead of just `limit`; returns up to 500 snapshots for the requested range.
- **`/performance` page** — equity curve (AreaChart), cost-basis overlay, period selector (1M/3M/6M/1Y/All), key metric cards (Total Return, Max Drawdown, Sharpe, Volatility, vs S&P 500).

### Added — TASK 29: Core Risk Metrics
- **`performance_analytics/` module** — pure-Python engine computing: total return %, annualised CAGR, max drawdown, current drawdown, Sharpe ratio, Sortino ratio, annualised volatility, best/worst snapshot period.
- **SPY benchmark comparison** — yfinance-fetched cumulative return series normalised to portfolio start date; 24-hour in-memory cache.
- **`GET /investors/{id}/portfolio/analytics`** — returns `PerformanceAnalytics` JSON; period filter same as history endpoint.
- **Return vs benchmark chart** — dual-line chart on performance page showing portfolio % return vs S&P 500 from the same starting point.

### Added — TASK 30: Transaction Log / Trade Journal
- **Migration 0019** — `holding_transactions` table: investor_id, account_id, holding_id (nullable), transaction_type (buy/sell/dividend/fee/split/bonus), ticker, quantity, price_per_unit, total_amount, fees, currency, transaction_date, notes.
- **`transactions/` module** — full CRUD service + router.
- **`GET/POST /investors/{id}/transactions`** — list (with filters: account, ticker, type, date range) and create.
- **`GET/PUT/DELETE /investors/{id}/transactions/{tx_id}`** — read, update, delete.
- **`/transactions` page** — summary cards (total bought/sold/fees), add-transaction form with auto-computed total (qty × price), filterable table, delete with confirmation.

### Added — TASK 31: Price Alerts on Specific Levels
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

### Planning
- Added TASK 28–36 to execution plan: Performance History, Core Risk Metrics (Sharpe/drawdown/benchmark), Transaction Log, Price Alerts, Economic Calendar, Correlation Matrix, Position Sizing, News Feed, CSV Import.

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
- **Deep Market Research Engine (TASK 26)** — new `market_research/` backend module + `/market-research` frontend page providing genuine fundamental analysis, not generic ETF advice.
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
- **Live Market Opportunity Engine (TASK 24)** — replaces static catalog recommendations with real market intelligence:
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
- **Debt Payoff Planner (TASK C)** — `GET /api/v1/investors/{id}/debt-planner?strategy=avalanche|snowball&extra_monthly=N`
  - Avalanche (highest-interest-first) and snowball (smallest-balance-first) strategies
  - Returns per-debt payoff order, months to debt-free, total interest, debt-free date
  - `/debt-planner` page: strategy selector, extra payment input, summary cards, ordered debt cards
- **Watchlist (TASK D)** — track market instruments without owning them
  - Migration 0017: `watchlist_items` table with unique constraint per investor+ticker
  - `GET/POST/DELETE /api/v1/investors/{id}/watchlist` — cached price and age enriched on read
  - Daily `price_refresh` worker now also fetches prices for watchlist tickers
  - `/watchlist` page: add by ticker/name/type, shows current price and data age
- **In-app Notification Center (TASK B)** — computed on-the-fly from existing data
  - `GET /api/v1/investors/{id}/notifications` — returns at-risk goals, rebalance alerts, stale prices, setup suggestions
  - `/notifications` page: severity-grouped list with direct navigation links
  - Sidebar: Notifications link in System section
- **AI Investment Agent (TASK 23)** — flagship multi-context Claude agent
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
- **Email alerts (TASK 20)** — daily goal at-risk notifications via SMTP
  - Migration 0015: adds `alert_email` (VARCHAR 255) and `email_alerts_enabled` (BOOLEAN, default false) to `investor_profiles`
  - `app/notifications/email.py` — `send_alert_email()` using `smtplib` + STARTTLS; silent no-op when SMTP env vars are absent
  - `goal_evaluation` worker now sends personalised alert email to any investor who has `email_alerts_enabled=true` and at-risk goals
  - Profile page: "Email Alerts" section with alert email address field + enable checkbox in edit form; view mode shows current settings
  - Configure via env: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `ALERT_FROM_EMAIL`
- **CSV import for holdings (TASK 21)** — bulk import holdings from a CSV file
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

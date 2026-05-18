# TradeOps AI — Architecture

**Version:** 0.90.0  
**Last updated:** 2026-05-18

---

## System overview

TradeOps AI is a personal financial intelligence platform. It is not a trading bot. It helps users understand their financial position, model risk, select validated strategies, and simulate outcomes before committing real capital.

```
Browser (Next.js 14)
      │  REST/JSON + SSE
      │  HttpOnly cookie (tradeops_token)
      ▼
FastAPI (Python 3.11)  ←→  Claude API (AI features)
      │  SQLAlchemy ORM       │
      ▼                       │  redis-py
PostgreSQL 16            Redis 7
                         ├── login rate limiting (sorted-set sliding window)
                         └── JWT JTI blacklist (SET + TTL)
```

All services run as Docker containers orchestrated by Docker Compose (local) or Helm/Kubernetes (production).  
CI (GitHub Actions) runs backend tests and builds both Docker images on every push to `main`.

### Next.js proxy

`next.config.mjs` defines a fallback rewrite: all `/api/*` requests not handled by a Next.js Route Handler are proxied to the backend (`NEXT_PUBLIC_API_URL`). This means:
- The browser always calls the frontend origin — no cross-origin cookie issues.
- HttpOnly cookies set by the backend are visible to the browser under the frontend domain.
- Four dedicated Next.js Route Handlers exist for long-running AI requests (agent, ai-report, market-research, recommendations) to handle timeouts and retry logic; all other API calls fall through to the proxy.

---

## Backend modules

```
backend/app/
├── main.py                     # FastAPI app factory, CORS, lifespan
├── core/config.py              # Settings from environment variables
├── db/
│   ├── base.py                 # SQLAlchemy declarative base
│   └── session.py              # DB session dependency
├── models/                     # SQLAlchemy ORM models (one file per entity)
├── schemas/                    # Pydantic request/response schemas
│
├── investor_profiles/          # Personal investor data, experience, minor flag
├── financial_profiles/         # Income, expenses, savings, debts, assets, liabilities
├── family_profiles/            # Household view, family members, shared goals
├── goals/                      # Financial goals with targets, dates, progress
│
├── financial_scoring/          # Deterministic stability score engine
├── risk_modeling/              # Percentage-based risk allocation model
│
├── strategy_library/           # Curated strategy templates (seeded via migration)
├── strategy_selection/         # AI-assisted ranking by investor suitability
│
├── backtesting/
│   ├── engine.py               # Deterministic simulation engine (seeded RNG)
│   ├── service.py
│   └── router.py
│
├── paper_trading/
│   ├── engine.py               # Monthly tick simulation
│   ├── service.py
│   └── router.py
│
├── ai_analysis/
│   ├── analyzer.py             # Claude API integration
│   ├── service.py              # Data aggregation for report context
│   └── router.py
│
├── financial_decision/
│   ├── engine.py               # Pure deterministic decision function (no DB)
│   ├── service.py              # Data aggregation + engine call
│   ├── schemas.py              # InvestmentDecision output model
│   └── router.py               # GET /investors/{id}/decision
│
├── holdings/
│   ├── service.py              # Account + holding CRUD
│   └── router.py               # /investors/{id}/accounts + /holdings
│
├── currency_engine/
│   └── rates.py                # FX rate fetch (open.er-api.com) + 24h DB cache
│
├── market_data/
│   ├── fetcher.py              # Alpha Vantage GLOBAL_QUOTE HTTP call
│   ├── service.py              # get_cached_price / fetch_and_cache / refresh_tickers with 24h TTL
│   ├── router.py               # GET /market/quote/{ticker}
│   │                           # GET /market/stream?tickers=...&interval=30 (SSE, TASK 90)
│
├── portfolio_analysis/
│   ├── engine.py               # Pure analysis function (P&L, allocation, exposure, after-tax P&L, FX rates)
│   ├── rebalance_engine.py     # Pure rebalance function (asset tier vs risk model target)
│   ├── service.py              # Data assembly + engine call
│   ├── schemas.py              # PortfolioSummary (+ pnl_after_tax, fx_rates), AccountAnalysis, HoldingAnalysis
│   ├── rebalance_schemas.py    # RebalanceTier, RebalanceResult
│   └── router.py               # GET /investors/{id}/portfolio + /rebalance
│
├── goals_analysis/
│   ├── engine.py               # Pure analysis: progress, contribution needed, gap, on_track
│   ├── service.py              # Data assembly + engine call
│   ├── schemas.py              # GoalAnalysis, GoalsAnalysisResult
│   └── router.py               # GET /investors/{id}/goals-analysis
│
├── market_scanner/
│   ├── catalog.py              # Curated 25-instrument catalog (ETFs, stocks, crypto)
│   ├── engine.py               # Pure filter + rank function (no DB)
│   ├── service.py              # Data assembly + engine call
│   ├── schemas.py              # InstrumentSuggestion, MarketScanResult
│   └── router.py               # GET /investors/{id}/market-scan
│
├── investment_recommendations/
│   ├── analyzer.py             # Claude API call — personalised recommendations from catalog
│   ├── service.py              # Data assembly + engine call
│   ├── schemas.py              # InstrumentRecommendation, PortfolioAction, RecommendationReport
│   └── router.py               # GET /investors/{id}/recommendations
│
├── market_research/            # Deep fundamental analysis + AI investment brief (TASK 57)
│   ├── screener.py             # 63-instrument universe, scoring
│   ├── analyzer.py             # Claude Sonnet AI thesis generation
│   ├── service.py              # Cache + orchestration
│   └── router.py               # GET /investors/{id}/market-research
│
├── broker_sync/                # Multi-broker import + scheduled auto-sync (TASK 53-56)
│   ├── parsers/                # IBKR Flex XML, eToro CSV, Altshuler Shaham, ALTrade
│   ├── ibkr_rest.py            # IBKR Client Portal Gateway REST sync (TASK 88)
│   ├── service.py              # Upsert logic (match by ISIN → ticker → name)
│   └── router.py               # POST /investors/{id}/accounts/{id}/broker-sync
│
├── pdf_import/                 # AI-powered PDF statement parsing (TASK 86)
│   ├── extractor.py            # pypdf text extraction + Claude Haiku parsing
│   └── router.py               # POST /investors/{id}/pdf-import/parse|import
│
├── crypto_staking/             # Staking APY tracking as income (TASK 87)
│   ├── service.py              # build_staking_report, enable/disable staking
│   └── router.py               # GET/POST/DELETE /investors/{id}/crypto-staking
│
├── action_feed/                # Daily action feed — morning briefing (TASK 84)
│   ├── engine.py               # Aggregates 5 signal sources; priority 1/2/3; dedup; cap 12
│   ├── schemas.py              # ActionItem, DailyActionFeed
│   └── router.py               # GET /investors/{id}/action-feed
│
├── pairs_trading/              # Statistical arbitrage (TASK 85)
│   ├── engine.py               # OLS hedge ratio, ADF(0) cointegration, Z-score signals
│   ├── schemas.py              # PairAnalysis, PairSignalSave, PairSignalOut
│   └── router.py               # GET /analyze, POST /signals
│
├── market_signals/             # Daily news sentiment + whale mention monitor (Phase 11)
│   └── router.py               # GET /investors/{id}/market-signals
│
├── pension_simulation/         # Standalone pension projector
├── debt_planner/               # Debt payoff planner (avalanche/snowball)
├── watchlist/                  # Per-investor ticker watchlist
├── notifications/              # In-app notification store
├── investment_agent/           # Free-form AI financial assistant
├── transactions/               # Immutable holding transaction log
├── price_alerts/               # User-defined price triggers
├── economic_calendar/          # Earnings dates for held + watched tickers
├── portfolio_correlation/      # 90-day Pearson correlation matrix
├── holdings_news/              # Latest news articles per held ticker
├── reports/                    # PDF report export (monthly/quarterly)
├── retirement_readiness/       # 0–100 readiness score (MC P50 + 4% SWR)
├── portfolio_chat/             # Natural language Q&A with 5-turn context
├── family_portfolio/           # Household consolidated view
├── liquidity_runway/           # Tiered liquidation model
├── resilience/                 # Life-event survival simulator
│
├── auth/
│   ├── service.py              # JWT creation/decoding, bcrypt password hashing
│   ├── dependencies.py         # get_current_user FastAPI dependency (cookie + Bearer)
│   ├── investor_access.py      # verify_investor_access — ownership enforcement
│   ├── blacklist.py            # JTI blacklist: Redis primary, in-memory fallback
│   ├── rate_limiter.py         # Login rate limiter: Redis sorted-set sliding window
│   ├── router.py               # POST /auth/login|register|logout  GET /auth/me
│   └── schemas.py              # UserCreate, UserLogin, UserOut, Token
│
├── live_trading/
│   ├── ibkr.py                 # IBKR Client Portal Gateway HTTP client (market + limit orders)
│   ├── engine.py               # 5-gate readiness check + order risk validation
│   ├── service.py              # submit_order, cancel_order, kill_switch
│   ├── schemas.py              # OrderRequest, AcknowledgeRiskRequest (gateway_url SSRF-validated)
│   └── router.py               # /investors/{id}/live-trading — gated by all 5 safety checks
│
├── audit/                      # Event log for all significant actions
├── dashboard/                  # Aggregated summary endpoint
├── admin/                      # Multi-tenant admin panel + AI cost tracking
└── workers/                    # APScheduler background jobs
    ├── scheduler.py            # Job registry + start/stop
    └── jobs/
        ├── market_signals_job.py   # 20:15 UTC daily — sentiment per holding
        ├── broker_auto_sync.py     # 09:00 UTC daily — auto-sync enabled accounts
        ├── weekly_digest.py        # 18:00 UTC Friday — email digest
        └── research_prewarm.py     # Scheduled market research refresh
```

### API routing

All routes are under `/api/v1/`. Assembled in `app/api/v1/router.py`.

**Auth routes** (public — no ownership check required):

| Prefix | Module | Notes |
|--------|--------|-------|
| `/auth/register` | auth | `POST` — create account, bcrypt-hashed |
| `/auth/login` | auth | `POST` — sets HttpOnly `tradeops_token` cookie (7-day JWT with JTI) |
| `/auth/logout` | auth | `POST` — blacklists JTI in Redis, clears cookie |
| `/auth/me` | auth | `GET` — returns current user from token |

**Investor-scoped routes** — all require `verify_investor_access` (JWT valid + investor owned by caller):

| Prefix | Module | Tags |
|--------|--------|------|
| `/investors` | investor_profiles, financial_profiles, dashboard, audit | investors, financial-profiles, dashboard, audit |
| `/investors/{id}/goals` | goals | goals |
| `/investors/{id}/risk-model` | risk_modeling | risk-model |
| `/investors/{id}/strategies` | strategy_selection | strategies |
| `/investors/{id}/backtests` | backtesting | backtesting |
| `/investors/{id}/paper-portfolios` | paper_trading | paper-trading |
| `/investors/{id}/ai-report` | ai_analysis | ai-analysis |
| `/investors/{id}/decision` | financial_decision | decision |
| `/investors/{id}/goals-analysis` | goals_analysis | goals-analysis |
| `/investors/{id}/portfolio` | portfolio_analysis | portfolio |
| `/investors/{id}/portfolio/rebalance` | portfolio_analysis | portfolio |
| `/investors/{id}/portfolio/refresh-prices` | portfolio_analysis | portfolio |
| `/investors/{id}/portfolio/history` | portfolio_analysis | portfolio |
| `/investors/{id}/market-scan` | market_scanner | market-scan |
| `/investors/{id}/recommendations` | investment_recommendations | recommendations |
| `/investors/{id}/market-research` | market_research | market-research |
| `/investors/{id}/accounts/{id}/broker-sync` | broker_sync | broker-sync |
| `/investors/{id}/accounts/{id}/broker-sync/ibkr-rest` | broker_sync | broker-sync |
| `/investors/{id}/pdf-import` | pdf_import | pdf-import |
| `/investors/{id}/crypto-staking` | crypto_staking | crypto-staking |
| `/investors/{id}/action-feed` | action_feed | action-feed |
| `/investors/{id}/pairs-trading` | pairs_trading | pairs-trading |
| `/investors/{id}/market-signals` | market_signals | market-signals |
| `/investors/{id}/pension-simulation` | pension_simulation | pension-simulation |
| `/investors/{id}/debt-planner` | debt_planner | debt-planner |
| `/investors/{id}/watchlist` | watchlist | watchlist |
| `/investors/{id}/notifications` | notifications | notifications |
| `/investors/{id}/agent` | investment_agent | investment-agent |
| `/investors/{id}/transactions` | transactions | transactions |
| `/investors/{id}/alerts` | price_alerts | price-alerts |
| `/investors/{id}/calendar` | economic_calendar | economic-calendar |
| `/investors/{id}/portfolio/correlation` | portfolio_correlation | portfolio-correlation |
| `/investors/{id}/news` | holdings_news | holdings-news |
| `/investors/{id}/reports` | reports | reports |
| `/investors/{id}/retirement-readiness` | retirement_readiness | retirement-readiness |
| `/investors/{id}/chat` | portfolio_chat | chat |
| `/investors/{id}/family-portfolio` | family_portfolio | family-portfolio |
| `/investors/{id}/portfolio/liquidity-runway` | liquidity_runway | liquidity-runway |
| `/investors/{id}/portfolio/resilience` | resilience | resilience |
| `/investors/{id}/live-trading` | live_trading | live-trading |
| `/market` | market_data | market-data (REST + SSE) |
| `/investors/{id}/accounts` | holdings | holdings |
| `/investors/{id}/accounts/{id}/holdings` | holdings | holdings |
| `/family-profiles` | family_profiles | family-profiles |
| `/strategies/templates` | strategy_library | strategy-templates |
| `/admin` | admin | admin |

**Dependency groups used in `router.py`:**
```python
_own = [Depends(verify_investor_access)]          # JWT + ownership check
_ai  = [Depends(verify_investor_access),           # JWT + ownership + monthly budget guard
        Depends(require_ai_budget)]
```
AI-gated routes (`_ai`): `ai-report`, `agent`, `market-scan`, `recommendations`, `market-research`, `chat`.

Interactive docs: `http://localhost:8000/docs`

---

## Database schema

Managed by Alembic. Migrations in `backend/alembic/versions/`.

| Migration | Description |
|-----------|-------------|
| `0001` | Core tables (investor_profiles, financial_*, family_*, goals, risk_models) |
| `0002` | Strategy templates + seed data (6 templates) |
| `0003` | Backtest tables (backtest_runs, backtest_periods) |
| `0004` | Paper trading tables (paper_portfolios, paper_ticks) |
| `0005` | investor_profiles extended (investment_goal, risk_tolerance, time_horizon, preferred_assets) |
| `0006` | risk_models enforcement fields (age_tier, allowed/blocked families, live_trading_allowed, max_trade_size_pct) |
| `0007` | Holdings tables (investment_accounts, investment_holdings) |
| `0008` | currency_rates cache table |
| `0009` | price_snapshots market data cache |
| `0010` | portfolio_snapshots value history |
| `0011` | goal tracking modes (target_amount_mode, linked_account_id) |
| `0012` | pension_fund fields (monthly_contribution, monthly_contribution_employee/employer, fund_status, annual_return_rate) |
| `0013` | study_fund fields (total_deposits, current_balance, purchase_date) |
| `0014` | vehicle asset_type |
| `0015` | price_alerts email field |
| `0016` | widen nationality columns |
| `0017` | watchlist_items table |
| `0018` | family financial model (financial_goals family FK, family_members) |
| `0019` | holding_transactions table |
| `0020` | price_alerts table |
| `0021` | emergency_fund flag on financial_profiles |
| `0022` | is_emergency_fund flag on investment_holdings |
| `0023` | goal linked_account_id FK |
| `0024` | users table + JWT auth |
| `0025` | account auto-sync fields (auto_sync_enabled, last_synced_at) |
| `0026` | holding management fees (management_fee_balance_pct, management_fee_contribution_pct) |
| `0027` | options holdings (strike_price, expiry_date, option_type, underlying_ticker, contract_multiplier, position_type) |
| `0028` | investor weekly digest flag |
| `0029` | holding purchase_fx_rate |
| `0030` | market_signals table (NEWS_SENTIMENT, WHALE_MENTION, PAIRS_ZSCORE; composite_score 0–100) |
| `0031` | investment_holdings makdam column (Israeli pension coefficient) |
| `0032` | ai_usage_logs table (token counts, cost_usd per Claude API call) |
| `0033` | family multi-user invite fields; investment_accounts owner_type; holding balance_updated_at |
| `0034` | CHECK constraints on enum-like VARCHAR columns (owner_type, invite_status, asset_type, etc.) |
| `0035` | live_trading_sessions table (gateway_url, session_token, status, order log) |
| `0036` | audit_events index on investor_profile_id; CHECK constraints on investable_capital_pct, max_trade_size_pct |

### Core tables

```
investor_profiles          — personal data, currency, experience, minor flag; + investment_goal, risk_tolerance, time_horizon, preferred_assets, trading_frequency, guardian_required
financial_profiles         — income/expenses/savings/debts per investor
financial_assets           — individual assets linked to financial_profile
financial_liabilities      — individual liabilities linked to financial_profile
financial_goals            — goals with target amounts and dates
family_profiles            — household profiles
family_members             — members linked to family_profile

risk_models                — generated risk allocation models per investor; + enforcement fields (age_tier, allowed/blocked strategy families, live_trading_allowed, etc.)

investment_accounts        — investor's accounts by provider + type (pension, brokerage, crypto, etc.)
investment_holdings        — individual positions per account (ticker, ISIN, quantity, avg buy price, current value)
currency_rates             — FX rate cache (base → target, fetched_at); 24h TTL
price_snapshots            — market price cache per ticker (Alpha Vantage); 24h TTL
portfolio_snapshots        — historical portfolio value snapshots (saved on every price refresh)

strategy_templates         — curated strategy definitions (seeded)
strategy_recommendations   — ranked strategies generated for an investor

backtest_runs              — backtest execution records
backtest_periods           — monthly portfolio value snapshots per run

paper_portfolios           — paper trading portfolios
paper_ticks                — monthly simulation ticks per portfolio

audit_events               — all significant system actions
```

---

## Frontend structure

Next.js 14 with App Router, Tailwind CSS, Recharts.

```
frontend/src/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx          # Login + investor profile creation
│   ├── (dashboard)/
│   │   ├── layout.tsx              # Sidebar navigation shell (mobile hamburger + desktop fixed)
│   │   ├── dashboard/page.tsx      # Dashboard: stat cards, Daily Action Feed, portfolio widget
│   │   ├── investments/page.tsx    # Accounts, holdings, SSE live prices, broker import
│   │   ├── performance/page.tsx    # TWR, MWR, attribution, alpha, complexity premium
│   │   ├── stress-test/page.tsx    # Historical scenarios, Monte Carlo, resilience simulator
│   │   ├── transactions/page.tsx   # Holding transaction log
│   │   ├── watchlist/page.tsx      # Ticker watchlist
│   │   ├── debt-planner/page.tsx   # Debt payoff planner
│   │   ├── financial/page.tsx      # Financial profile CRUD + assets/liabilities
│   │   ├── goals/page.tsx          # Financial goals
│   │   ├── family/page.tsx         # Family profile + household portfolio
│   │   ├── profile/page.tsx        # Investor profile view + edit
│   │   ├── risk/page.tsx           # Risk model view and generation
│   │   ├── strategies/page.tsx     # Strategy recommendations
│   │   ├── backtesting/page.tsx    # Run and view backtests
│   │   ├── paper-trading/page.tsx  # Paper portfolio tick simulation
│   │   ├── market-scan/page.tsx    # Market scanner
│   │   ├── pairs-trading/page.tsx  # Pairs trading: Z-score gauge, cointegration (TASK 85)
│   │   ├── pdf-import/page.tsx     # PDF statement import (TASK 86)
│   │   ├── crypto-staking/page.tsx # Crypto staking rewards + APY (TASK 87)
│   │   ├── market-research/page.tsx # Deep market research + 3-tier picks
│   │   ├── ai-agent/page.tsx       # Free-form AI financial assistant
│   │   ├── recommendations/page.tsx # Tailored recommendations
│   │   ├── audit/page.tsx          # Audit event log
│   │   ├── admin/page.tsx          # Admin panel (admin role required)
│   │   └── settings/page.tsx       # Account and platform info
│   └── page.tsx                    # Root redirect → /dashboard
├── components/ui/                  # Shared UI primitives (Card, Badge, Button, etc.)
├── hooks/
│   └── useInvestorId.ts            # Reads investor ID from localStorage, redirects if absent
└── lib/
    ├── api.ts                      # Typed API client helpers
    └── utils.ts                    # formatCurrency, formatPercent, cn()
```

### Session management

JWT authentication (HS256, 7-day expiry). Token stored in an HttpOnly `SameSite=Strict` cookie (`tradeops_token`). Every token includes a unique `jti` (JWT ID) claim.

The active investor UUID is stored in `localStorage` under `tradeops_investor_id`. The `useInvestorId` hook reads this and redirects to `/login` if absent. This controls *which profile* is displayed; it does not bypass auth — all API requests still require a valid JWT.

See [Authentication & Authorization](#authentication--authorization) for the full security model.

---

## Authentication & Authorization

### Token lifecycle

1. `POST /auth/login` — verifies bcrypt password, issues a HS256 JWT containing `{"sub": user_id, "exp": +7 days, "jti": uuid4}`. Sets the `tradeops_token` HttpOnly, `SameSite=Strict` cookie with matching `max_age`.
2. Every subsequent request — `get_current_user` dependency extracts the token (cookie preferred, `Authorization: Bearer` fallback), decodes it, checks JTI against the Redis blacklist, and returns the `User` model.
3. `POST /auth/logout` — decodes the token **without** blacklist check, writes `jwt_bl:{jti}` to Redis with TTL = remaining token lifetime, then clears the cookie. The token is now permanently invalid even if an attacker replayed the cookie.

### JTI blacklist

Location: `auth/blacklist.py`

- **Primary store**: Redis — `SET jwt_bl:{jti} 1 EX <remaining_seconds>`. TTL matches the token's remaining lifetime exactly so no manual cleanup is needed.
- **Fallback**: per-process in-memory dict `{jti: expires_at}` — used automatically when Redis is unreachable. Expired entries are pruned on every write.
- **Degraded mode**: during a Redis outage, a JTI revoked in one worker/pod may still pass in another. This is the accepted trade-off; Redis liveness probes keep outages brief.
- **Backward compatibility**: tokens issued before v0.90.0 have no `jti` field. `decode_token()` skips the blacklist check when `jti` is absent — existing sessions remain valid until natural expiry.

### Multi-tenant ownership model

One **user** → many **investor profiles**. Every investor-scoped route carries `{investor_id}` in the path. The `verify_investor_access` dependency (`auth/investor_access.py`) checks:

```python
profile = db.get(InvestorProfile, investor_id)
if not profile or profile.user_id != current_user.id:
    raise HTTPException(404)  # 404 not 403 — avoids leaking existence
```

Admins bypass this check via the admin router's separate `require_admin` dependency.

### Route protection summary

| Scope | Dependency | Applied to |
|-------|-----------|------------|
| Public | None | `/auth/*`, `/market/*` |
| Authenticated | `get_current_user` | `/auth/me`, investor creation |
| Investor-owned | `_own` = `verify_investor_access` | All 35+ `/investors/{id}/...` routes |
| AI-gated | `_ai` = ownership + `require_ai_budget` | ai-report, agent, recommendations, market-research, market-scan, chat |
| Admin-only | `require_admin` | `/admin/*` |

### Password hashing

bcrypt via `bcrypt` library. No migration needed to change hash algorithm for existing users — new hashes are verified by the algorithm stored in the hash prefix.

---

## Financial scoring engine

Location: `backend/app/financial_scoring/engine.py`

Deterministic, no ML. Inputs from the investor's financial profile. Output:

```json
{
  "score": 0–100,
  "classification": "unstable | fragile | stable | strong",
  "risk_modifier": "reduce | neutral | allow_growth",
  "recommendations": ["..."]
}
```

Scoring factors:
- Income-to-expense ratio
- Emergency fund months
- Debt-to-income ratio
- Net worth (assets vs liabilities)
- Job stability
- Income trend
- Dependents count
- Savings rate

The stability score directly constrains the risk allocation model — low stability restricts aggressive strategies regardless of the user's stated risk preference.

---

## Risk allocation model

Location: `backend/app/risk_modeling/`

Percentage-based, not a vague low/medium/high label. Example output:

```json
{
  "investable_capital_pct": 40,
  "low_risk_pct": 25,
  "growth_pct": 10,
  "high_risk_pct": 5,
  "classification": "conservative | moderate | growth | aggressive",
  "stability_score": 72
}
```

The model is recalculated on demand and stored in the `risk_models` table. Each investor may have multiple historical models.

v0.9.0 additions — enforcement fields computed alongside allocation:
- `age_tier` — minor / young_adult / adult / pre_retirement / retirement (derived from DOB)
- `allowed_strategy_families` / `blocked_strategy_families` — JSONB lists
- `live_trading_allowed` — gated on stability score ≥ 50 + intermediate+ experience
- `requires_paper_trading` — true for beginners or low-stability investors
- `max_trade_size_pct`, `max_open_positions` — position-level risk limits

---

## Financial decision engine

Location: `backend/app/financial_decision/`

Stateless, deterministic. Called via `GET /api/v1/investors/{id}/decision`. Not persisted.

Output:

```json
{
  "can_invest": true,
  "readiness_classification": "ready | ready_with_limits | not_ready | education_only",
  "recommended_investment_pct": 35,
  "max_high_risk_pct": 5,
  "blocked_actions": ["live_trading"],
  "required_actions": ["maintain_emergency_fund"],
  "warnings": ["High debt ratio detected"],
  "explanation": "..."
}
```

Decision rules (in priority order):
1. No financial profile → `not_ready`
2. `is_minor` or `age_tier == "minor"` → `education_only`
3. `investment_goal == "education"` → `education_only`
4. `stability_score < 30` or `emergency_fund_months < 1` → `not_ready`
5. `stability_score 30–60` or `debt_to_income > 40%` or `emergency_fund < 3mo` → `ready_with_limits`
6. Otherwise → `ready`

Blocked/required actions sourced from the investor's latest risk model enforcement fields.

---

## Strategy library

Location: `backend/app/strategy_library/`

Six seeded templates (created in migration `0002`):

| Template | Type | Risk Level |
|----------|------|------------|
| Financial Education Mode | education | minimal |
| Build Financial Foundation | savings_first | very_low |
| Capital Preservation | preservation | low |
| Balanced Growth | balanced | moderate |
| Growth Focused | growth | moderate_high |
| Active Trading | active | high |

Strategy selection ranks these by investor suitability using the stability score, risk model, experience level, and goals.

---

## Backtesting engine

Location: `backend/app/backtesting/engine.py`

- Deterministic: seeded RNG ensures reproducibility
- Simulates month-by-month portfolio returns using strategy parameters
- Records a `backtest_periods` snapshot for each month
- Computes: total return, annualised return, max drawdown, Sharpe ratio, win rate

---

## Paper trading engine

Location: `backend/app/paper_trading/engine.py`

- Portfolio starts with initial capital defined by the investor's financial profile
- Each "tick" simulates one calendar month
- Tick return is computed from the strategy template's expected return distribution with risk-adjusted variance
- Portfolio status: `active` or `closed`

---

## AI features

Six features call the Anthropic Claude API. All require `ANTHROPIC_API_KEY`. All are gated by the `require_ai_budget` dependency (monthly per-investor spend cap, configurable via `AI_MONTHLY_BUDGET_USD`).

| Feature | Module | Model | Route |
|---------|--------|-------|-------|
| AI Report | `ai_analysis/` | `claude-sonnet-4-6` | `GET /investors/{id}/ai-report` |
| Deep Market Research | `market_research/` | `claude-sonnet-4-6` | `GET /investors/{id}/market-research` |
| Recommendations | `investment_recommendations/` | `claude-sonnet-4-6` | `GET /investors/{id}/recommendations` |
| AI Agent | `investment_agent/` | `claude-sonnet-4-6` | `GET /investors/{id}/agent` |
| Portfolio Chat | `portfolio_chat/` | `claude-haiku-4-5-20251001` | `POST /investors/{id}/chat` |
| Market Signals | `market_signals/` (worker) | `claude-haiku-4-5-20251001` | background job 20:15 UTC |

### AI cost tracking

Every Claude API call logs to the `ai_usage_logs` table via `log_ai_call()` (`ai_usage/logger.py`):
- `feature_name`, `model`, `input_tokens`, `output_tokens`, `cost_usd`, `investor_id`, `called_at`
- Cost is computed from published per-token pricing for each model
- Market research skips logging on cache hits (no tokens consumed)
- Portfolio chat skips logging when the API call fails (0 tokens consumed)

Visible in the admin panel under **AI API Cost** with 7/30/90-day views, breakdown by feature, and per-user drill-down.

### AI output rules (enforced in prompts)
- Never guarantee returns
- Never recommend leverage, margin, options, futures, or shorting
- Only recommend instruments from the curated catalog (no invented tickers)
- If investor is a minor: education/preservation instruments only
- Strategies come from controlled templates — AI cannot invent new ones

---

## Audit log

Location: `backend/app/audit/`

All significant actions emit an audit event:
- Investor profile created/updated
- Risk model generated
- Strategies generated
- Backtest run executed
- Paper portfolio created / ticked / closed
- AI report generated
- Investment decision evaluated (`decision.evaluated`)

Events are queryable per investor with pagination: `GET /api/v1/investors/{id}/audit-events?skip=N&limit=50`

---

## CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`):
1. Detects version from `CHANGELOG.md`
2. Runs `pytest` against the backend
3. Runs TypeScript type check (`tsc --noEmit`) on the frontend
4. Builds the backend Docker image
5. Builds the frontend Docker image
6. Creates a GitHub release if the detected version is new

Triggered on every push to `main`. Release creation is idempotent — pushing without bumping the version creates no duplicate release.

---

## Features added since v0.29.0 (v0.30–v0.63)

The sections above describe the baseline architecture at v0.29.0. All additions since then follow the same patterns.

### Workers / background jobs (APScheduler)

| Job ID | Schedule | What it does |
|--------|----------|--------------|
| `price_refresh` | Daily 20:00 UTC | Fetches live prices for all tickered holdings |
| `snapshot_writer` | Daily 21:00 UTC | Saves end-of-day portfolio snapshots |
| `price_alert_checker` | Daily 20:30 UTC | Evaluates price alerts, creates notifications |
| `goal_evaluation` | Daily 07:00 UTC | Sweeps all goals, updates status |
| `notification_alerts` | Daily 08:30 UTC | Sends alert email digest if SMTP configured |
| `broker_auto_sync` | Daily 09:00 UTC | Re-imports from auto-sync broker accounts |
| `weekly_digest` | Friday 18:00 UTC | AI-generated HTML digest email (v0.63) |
| `market_prewarm` | Every 30 min | Keeps live market signal cache warm |
| `research_prewarm` | Every 6 hours | Keeps market research screener cache warm |

### API endpoints added (v0.30–v0.63)

| Endpoint | Module | Notes |
|----------|--------|-------|
| `GET /portfolio/history` | portfolio_analysis | Historical snapshots — 1m/3m/6m/1y/all |
| `GET /portfolio/analytics` | performance_analytics | Sharpe, Sortino, MWR, drawdown, SPY benchmark |
| `GET /portfolio/attribution` | performance_analytics | Holding-level attribution, rolling returns, alpha |
| `GET /portfolio/stress-test` | scenario_analysis | Historical crash scenarios + Monte Carlo |
| `GET /portfolio/income` | income_projection | Dividend income projection |
| `GET /portfolio/rebalance` | rebalance_engine | Tier-level drift vs risk model, suggested trades |
| `GET /portfolio/tax-opportunities` | tax_harvesting | Tax-loss harvesting candidates |
| `GET /portfolio/options` | options_engine | Options P&L, expiry status, short-position flags |
| `GET /portfolio/fx-impact` | *(planned v0.64)* | Asset P&L vs Currency P&L decomposition |
| `GET /pension-simulation` | pension_simulation | FV projection with management fees |
| `GET /retirement-readiness` | retirement_readiness | Retirement readiness score |
| `POST/GET /transactions` | transactions | Holding transaction log |
| `GET /goals-analysis` | goals_analysis | Goal gap analysis + contribution needed |
| `GET /market-scan` | market_scanner | Multi-signal scanner (momentum, RSI, MACD) |
| `GET /recommendations` | investment_recommendations | AI stock/ETF recommendations |
| `GET /market-research` | market_research | Sector screener + AI narrative |
| `GET /news` | holdings_news | News headlines per holding |
| `GET /calendar` | economic_calendar | Upcoming macro events |
| `GET /reports` | reports | Full PDF-ready AI report |
| `POST /chat` | portfolio_chat | Natural language Q&A (v0.63) |
| `GET /broker-sync` | broker_sync | Import positions from IBKR/eToro/Altshuler |
| `GET/POST /alerts` | price_alerts | Price alert management |
| `GET /notifications` | notifications | In-app notification center |

### Frontend pages added

| Page | Route | Description |
|------|-------|-------------|
| Investments | `/investments` | Accounts, holdings, options, pension, broker sync |
| AI Report | `/ai-report` | Full AI analysis report |
| Backtesting | `/backtesting` | Strategy simulation |
| Paper Trading | `/paper-trading` | Live paper portfolio simulation |
| Goals | `/goals` | Goal management + progress |
| Debt Planner | `/debt-planner` | Debt payoff strategy |
| Market | `/market` | Scanner + research + calendar |
| Settings | `/settings` | Email alerts, digest, cache management |
| Offline | `/offline` | PWA offline fallback (v0.61) |

### PWA (v0.61)

Service worker at `public/sw.js`. API routes = network-only. Navigation = network-first with `/offline` fallback. Static assets = cache-first. Icons generated via `ImageResponse` (192×192, 512×512 maskable).

### Options tracking (v0.62)

`call_option` / `put_option` asset types. P&L engine: `cost_basis = premium × qty × multiplier`. Short positions: max_loss = unlimited. Expiry status: ok / warning (≤30d) / critical (≤7d) / expired.

### AI chat (v0.63)

In-memory 5-turn conversation history per investor. Context includes live portfolio, risk model, and goals analysis. Replies grounded in real data — never invents figures.

## Known gaps (current)

- **No real live trading** — intentionally disabled by default. Requires 5-gate readiness check: paper track record (Sharpe > 0.5, ≥30 days), risk acknowledgment, admin approval, order risk limits, and active IBKR connection. Kill switch halts session and cancels all open orders immediately.
- **No tax engine** — tax-loss harvesting is analysis-only (candidates + estimated saving). Actual tax calculations are country-specific and not implemented.
- **FX historical rates** — `currency_rates` table holds only the current rate per pair. Historical FX rates are not stored, which limits P&L attribution decomposition into FX vs asset components.
- **Refresh token rotation** — the current auth uses a single 7-day access token with JTI blacklist on logout. Short-lived access tokens with rotating refresh tokens are not implemented; the 7-day window is acceptable given server-side revocation via the blacklist.

> **What is implemented** (common misconceptions):
> - Full JWT authentication with HttpOnly cookies since v0.24 (migration 0024)
> - Role-based access control: `user` and `admin` roles enforced on all routes
> - Multi-tenant ownership: all investor routes verify the requester owns the profile
> - Token revocation on logout via Redis JTI blacklist (v0.90.0)
> - Login rate limiting: 5 attempts per IP per 5 minutes, Redis-backed (v0.88.0)

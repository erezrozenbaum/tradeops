# TradeOps AI — Architecture

**Version:** 0.15.0  
**Last updated:** 2026-04-27

---

## System overview

TradeOps AI is a personal financial intelligence platform. It is not a trading bot. It helps users understand their financial position, model risk, select validated strategies, and simulate outcomes before committing real capital.

```
Browser (Next.js)
      │
      │  REST/JSON
      ▼
FastAPI (Python 3.11)
      │
      │  SQLAlchemy ORM
      ▼
PostgreSQL 16
      │
      │  HTTP (Anthropic SDK)
      ▼
Claude API  (AI report generation only)
```

All services run as Docker containers orchestrated by Docker Compose.  
CI (GitHub Actions) runs backend tests and builds both Docker images on every push to `main`.

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
│   └── router.py               # GET /market/quote/{ticker}
│
├── portfolio_analysis/
│   ├── engine.py               # Pure analysis function (P&L, allocation, exposure)
│   ├── rebalance_engine.py     # Pure rebalance function (asset tier vs risk model target)
│   ├── service.py              # Data assembly + engine call
│   ├── schemas.py              # PortfolioSummary, AccountAnalysis, HoldingAnalysis
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
├── audit/                      # Event log for all significant actions
├── dashboard/                  # Aggregated summary endpoint
└── workers/                    # Reserved for background jobs (not yet implemented)
```

### API routing

All routes are under `/api/v1/`. Assembled in `app/api/v1/router.py`:

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
| `/investors/{id}/market-scan` | market_scanner | market-scan |
| `/market` | market_data | market-data |
| `/investors/{id}/accounts` | holdings | holdings |
| `/investors/{id}/accounts/{id}/holdings` | holdings | holdings |
| `/family-profiles` | family_profiles | family-profiles |
| `/strategies/templates` | strategy_library | strategy-templates |

Interactive docs: `http://localhost:8000/docs`

---

## Database schema

Managed by Alembic. Migrations in `backend/alembic/versions/`.

| Migration | Description |
|-----------|-------------|
| `0001_initial.py` | All core tables |
| `0002_strategy_tables.py` | Strategy templates + seed data (6 templates) |
| `0003_paper_trading.py` | Paper portfolio and tick tables |
| `0004_audit_events.py` | Audit event table |
| `0005_investor_profile_extended.py` | Added `investment_goal`, `risk_tolerance`, `time_horizon`, `preferred_assets`, `trading_frequency`, `guardian_required` to investor_profiles |
| `0006_risk_model_enforcement_fields.py` | Added `age_tier`, `allowed_strategy_families`, `blocked_strategy_families`, `live_trading_allowed`, `requires_paper_trading`, `max_trade_size_pct`, `max_open_positions` to risk_models |
| `0007_holdings.py` | `investment_accounts` and `investment_holdings` tables |
| `0008_currency_rates.py` | `currency_rates` cache table |
| `0009_price_snapshots.py` | `price_snapshots` market data cache table |

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
│   │   ├── layout.tsx              # Sidebar navigation shell
│   │   ├── dashboard/page.tsx      # Dashboard overview + Investment Readiness + Portfolio widget
│   ├── investments/page.tsx    # Investment accounts + holdings tracking + portfolio summary
│   │   ├── financial/page.tsx      # Financial profile CRUD + assets/liabilities
│   │   ├── goals/page.tsx          # Financial goals
│   │   ├── family/page.tsx         # Family profile
│   │   ├── profile/page.tsx        # Investor profile view + edit (incl. investment preferences)
│   │   ├── risk/page.tsx           # Risk model view and generation
│   │   ├── strategies/page.tsx     # Strategy recommendations
│   │   ├── backtesting/page.tsx    # Run and view backtests
│   │   ├── paper-trading/page.tsx  # Paper portfolio simulation
│   │   ├── market-scan/page.tsx    # Market scanner — curated instrument suggestions
│   ├── reports/page.tsx        # AI financial report
│   │   ├── audit/page.tsx          # Audit event log
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

No authentication in MVP. The active investor is identified by a UUID stored in `localStorage` under the key `tradeops_investor_id`. The `useInvestorId` hook reads this value on mount and redirects to `/login` if absent.

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

## AI analysis

Location: `backend/app/ai_analysis/`

- Uses the Anthropic Claude API (`claude-sonnet-4-5` or configured model)
- `service.py` aggregates investor data: financial profile, risk model, strategy recommendations, backtest results, paper trading history
- `analyzer.py` sends a structured prompt and parses the 7-section response
- Output is returned directly to the caller — not persisted (stateless per request)
- Requires `ANTHROPIC_API_KEY` in environment

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

## Known gaps (post-MVP)

- No authentication — investor switching is based on localStorage only
- No real live trading (intentionally disabled)
- No real market data integration (simulated returns only)
- No bank/brokerage account integration
- No tax engine
- No role-based access control
- Workers module is a placeholder (no background jobs yet)

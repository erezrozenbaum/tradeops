# TradeOps AI

<div align="center">

**Personal Financial Intelligence Platform**

[![Version](https://img.shields.io/badge/version-3.1.0-blue?style=flat-square)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=flat-square&logo=docker&logoColor=white)](infra/docker-compose.yml)

*Understand your finances. Model risk accurately. Validate strategies. Simulate before you invest.*

</div>

---

> [!WARNING]
> **TradeOps AI is an educational and analytical financial intelligence platform.**
> It does not provide financial, investment, legal, or tax advice of any kind.
>
> All investment decisions remain solely the responsibility of the user.
> AI-generated insights, simulations, recommendations, and research outputs are analytical decision-support tools —
> they may be incomplete, delayed, inaccurate, or unsuitable for your specific financial situation.
>
> Always independently verify information and consult a licensed financial professional
> before making any investment, trading, or financial planning decision.
> Past simulated or backtested performance does not guarantee future results.
>
> Not available in jurisdictions where such tools require regulatory licensing or approval.
> See [`LEGAL_DISCLAIMER.md`](LEGAL_DISCLAIMER.md) for the full disclaimer.

---

## Table of Contents

- [What it is](#what-it-is)
- [Philosophy](#philosophy)
- [Features](#features)
- [Architecture](#architecture)
- [Trust & Safety Architecture](#trust--safety-architecture)
- [Quickstart](#quickstart)
- [Environment Variables](#environment-variables)
- [Documentation](#documentation)
- [Safety Principles](#safety-principles)
- [Legal](#legal)

---

## What it is

TradeOps AI is **not a trading bot**. It is a personal and family financial intelligence platform that helps you:

| What it does | What it does not do |
|---|---|
| Analyse your complete financial position | Execute trades autonomously |
| Model risk as actual percentages of capital | Provide licensed financial advice |
| Surface AI-assisted insights and research | Guarantee returns or outcomes |
| Simulate strategies before committing capital | Override deterministic risk controls |
| Track net worth, goals, tax, and FX impact | Operate in place of a financial professional |
| Gate live trading behind 5 safety checks | Allow live trading for minors |

---

## Philosophy

```
Financial safety → clarity → education → validation → automation
```

The platform recommends the right foundations before investing: build an emergency fund, reduce high-interest debt, and establish a risk model based on your real situation — not a vague "high / medium / low" preference.

The correct flow is:

```
Personal & Family Profile
        ↓
Financial Status (income, expenses, debts, assets)
        ↓
Financial Stability Score (deterministic 0–100)
        ↓
Risk Allocation Model (% of investable capital per tier)
        ↓
Strategy Recommendation (curated templates only)
        ↓
Backtesting (deterministic, seeded simulation)
        ↓
Paper Trading (real simulator, virtual cash)
        ↓
Risk-Controlled Live Execution (gated, opt-in)
```

---

## Features

### Core Platform

| Feature | Description |
|---|---|
| **Investor & Family profiles** | Household financial modeling, dependents, education mode for minors |
| **Financial profile** | Income, expenses, savings rate, debts, assets, liabilities |
| **Financial Stability Score** | Deterministic 0–100 score — restricts aggressive strategies when fragile |
| **Risk Allocation Model** | Percentage-based investable capital per risk tier (not vague low/medium/high) |
| **Goals engine** | Linked accounts, progress tracking, monthly contribution gap analysis |
| **Net Worth Dashboard** | Full balance sheet: portfolio + manual assets − liabilities, 12-month trend, FI projection |

### Portfolio Intelligence

| Feature | Description |
|---|---|
| **Investment accounts & holdings** | Multi-account, multi-currency, all asset types |
| **Live price refresh** | Alpha Vantage / yfinance with 24h cache; SSE streaming (30s interval) |
| **FX Impact** | P&L split into Asset P&L (price movement) vs Currency P&L (FX movement) |
| **Performance attribution** | TWR, MWR (IRR), alpha vs benchmark, per-holding CAGR |
| **Rebalancing engine** | Actionable BUY/SELL suggestions per allocation tier |
| **Correlation matrix** | 90-day Pearson correlation, concentration risk flags |
| **Stress testing** | 5 historical crash scenarios + Monte Carlo P10/P50/P90 |
| **Tax-loss harvesting** | Candidates sorted by estimated saving, wash-sale warnings |
| **Tax Year Summary** | WACC-method realized gains, year-over-year P&L, estimated 25% flat tax |
| **Liquidity runway** | T+2 / 1-week / locked tier breakdown, emergency liquidation path |
| **Resilience simulator** | Job loss / expense shock survival score with depletion path |

### Strategy & Simulation

| Feature | Description |
|---|---|
| **Strategy library** | Curated templates matched to risk model and suitability |
| **Backtesting** | Deterministic seeded simulation engine |
| **Paper trading** | Real virtual trading: buy/sell any ticker, live price fetch with automatic FX conversion to portfolio currency, WACC positions, order history |
| **Pairs trading** | Statistical arbitrage: OLS hedge ratio, ADF cointegration, Z-score signals |

### AI Intelligence *(requires `ANTHROPIC_API_KEY`)*

> All AI features produce **decision-support outputs only**. No AI feature executes trades or constitutes financial advice.

| Feature | Description |
|---|---|
| **AI Coach** | Proactive rule-based + AI-narrated insights: emergency fund, idle cash, goal gaps, concentration risk, tax-loss opportunities |
| **AI Report** | Full portfolio analysis generated by Claude |
| **AI-assisted Suggestions** | Tailored picks matched to risk model, goals, and holdings |
| **Deep Market Research** | Screens 63 instruments; AI investment theses, 3-tier portfolio; persistent history |
| **AI Agent** | Free-form financial assistant grounded in real portfolio data |
| **AI Portfolio Chat** | Natural language Q&A, 5-turn context window |
| **Market Signal Monitor** | Daily news sentiment + whale mention detection per holding |
| **Daily Action Feed** | Aggregated morning briefing: suggested actions, prioritised |
| **AI Weekly Digest** | Friday email with portfolio performance and 1–3 suggestions |

### Data Import

| Feature | Description |
|---|---|
| **Broker Import** | IBKR Flex XML, eToro CSV, Altshuler Shaham, ALTrade (XLSX/CSV) |
| **IBKR REST Sync** | Live position sync from IBKR Client Portal Gateway |
| **PDF Statement Import** | AI-powered parsing of any broker PDF format |
| **Broker Auto-Sync** | Daily scheduled sync for connected accounts |
| **Crypto Staking Tracking** | APY-based staking rewards as income |
| **Options tracking** | Call/put with strike/expiry/multiplier; long/short P&L |

### Live Trading *(Gated — disabled by default)*

| Feature | Description |
|---|---|
| **5-gate readiness check** | Paper track record (Sharpe > 0.5, ≥30 days), risk acknowledgment, admin approval, order risk limits, IBKR connection |
| **Risk acknowledgment gate** | Explicit multi-point user acknowledgment required before any session activation |
| **Live trading admin queue** | Admin panel: eligible investors, gate status, Sharpe ratio; Approve/Revoke with audit trail |
| **IBKR Client Portal Gateway** | Market and limit orders; cancellation; position sync |
| **Kill switch** | Halts session and cancels all open orders immediately |

### Operational

| Feature | Description |
|---|---|
| **JWT authentication** | HS256, HttpOnly `SameSite=Strict` cookie; cookie + `Authorization: Bearer` |
| **Token revocation** | Redis JTI blacklist on logout; in-memory fallback |
| **Role-based access** | `user` and `admin` roles; all 35+ investor routes enforce ownership |
| **Audit log** | Every significant action recorded |
| **Admin panel** | User management, AI cost tracking per feature |
| **Login rate limiting** | 5 attempts per IP per 5-minute window (Redis-backed) |
| **AI monthly budget guard** | Configurable per-investor USD spending cap |
| **PWA** | Installable, offline-capable |
| **Mobile-first UI** | Responsive sidebar, touch-friendly layouts |
| **Kubernetes / Helm** | Production-hardened chart with NetworkPolicy, PDB, securityContext |

### Financial Command Center *(v2.8.0)*

| Feature | Description |
|---|---|
| **Today's Command Center** | Unified daily intelligence screen — answers "What should I focus on next, and why?" Replaces the dashboard as the primary landing page |
| **Top 3 Prioritized Actions** | Rule-based action engine ranks the highest-impact next steps (emergency fund, concentration risk, behavioral warnings, contribution gaps) — adapted to maturity stage |
| **7-Day Financial Evolution Feed** | Delta feed comparing key metrics (Twin score, stability, behavioral risk, net worth) vs 7 days ago; explains what changed and why |
| **Health Radar Inline** | 8-dimension radar chart surfaced on the main screen — instant financial clarity |
| **Financial Twin Insights** | Positive drivers and drag factors that are actually shaping financial progress |
| **Behavioral Risk Surface** | Active warnings shown inline — no need to navigate to a separate page |
| **Parallel Futures Preview** | Simplified 3-path projection (current / +savings / debt-free) with FI probability — links to full simulation |
| **Decision Replay Highlight** | Most impactful counterfactual insight surfaced on the main screen |
| **Maturity-Aware AI Summary** | AI Thought Partner summary adapts tone and depth to investor's maturity stage; inline verbosity toggle |
| **Investor Progression Track** | Stage progression bar + unlocked features + next unlock target |

### Observability & Data Integrity *(v2.7.1)*

| Feature | Description |
|---|---|
| **Langfuse AI tracing** | Every AI call traced: feature, model, tokens, input/output. Full prompt history, replay, and quality scoring. Optional — no-op when keys absent. |
| **Prometheus metrics** | `/metrics` endpoint: request rate, p50/p95/p99 latency, error rate, in-progress count, per-endpoint breakdown |
| **Grafana dashboard** | Pre-provisioned at `:3001` — wired to Prometheus with TradeOps backend dashboard out of the box |
| **Great Expectations** | 5 data quality suites validate financial tables daily: no negative quantities, positive FX rates and prices, valid currency codes, portfolio snapshot integrity |
| **Migration safety CI** | Every PR runs Alembic upgrade + table count check + downgrade round-trip against a real Postgres container |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (Next.js 14)                      │
│              REST/JSON + SSE · HttpOnly Cookie               │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                FastAPI (Python 3.11)                         │
│                                                              │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────┐  │
│  │ Deterministic  │  │   AI Layer      │  │  Workers     │  │
│  │ Risk Engine    │  │  Claude API     │  │  APScheduler │  │
│  │ Score · Rebal  │  │  (traced via    │  │  14 daily    │  │
│  │ Gate · Backtest│  │   Langfuse)     │  │  jobs        │  │
│  └────────────────┘  └─────────────────┘  └──────────────┘  │
│                  │ SQLAlchemy ORM                            │
└──────────────────┼──────────────────────────────────────────┘
                   │
    ┌──────────────┴───────────────┐
    │                              │
┌───▼─────────┐          ┌─────────▼──────┐
│ PostgreSQL  │          │  Redis 7       │
│ 16          │          │                │
│ 40+         │          │ · Rate limit   │
│ migrations  │          │ · JWT blacklist│
└─────────────┘          └────────────────┘
```

All services run as Docker containers. Helm chart at `helm/tradeops/` for Kubernetes.

**Key design decisions:**
- The **deterministic Risk Engine** always runs before any AI suggestion. AI cannot override risk controls.
- AI features are **decision-support only** — they never trigger trades, never bypass safety gates.
- **Paper trading is required** before any live trading session can be approved.
- Every significant action is **audit-logged** with full context.

See [`docs/architecture.md`](docs/architecture.md) for the full module and routing reference.

---

## Trust & Safety Architecture

TradeOps is built deterministic-first. Every layer has a defined role and cannot be bypassed by the layer above it.

```
User action
    ↓
Deterministic Risk Engine  ← always runs first, AI cannot override
    ↓
AI decision-support layer  ← interprets, explains, suggests; never executes
    ↓
Safety gates (5-check live trading)  ← block live execution unless all pass
    ↓
Audit log  ← every significant action recorded with full context
```

### What this means in practice

| Concern | How it is enforced |
|---|---|
| **AI cannot execute trades** | All orders route through the deterministic Risk Engine; AI has no order-placement path |
| **AI cannot override risk limits** | Risk Engine runs before any AI suggestion is shown; limits are code, not prompts |
| **Live trading disabled by default** | Requires: paper track record (Sharpe ≥ 0.5, ≥ 30 days) + risk acknowledgment + admin approval |
| **Every AI call is traced** | Langfuse records feature, model, token counts, input (truncated), output, investor_id for every call |
| **Financial data quality validated daily** | Great Expectations runs 5 suites at 02:00 UTC; failures written to audit log |
| **DB migrations tested on every push** | CI runs Alembic upgrade → table count check → downgrade → upgrade on a real Postgres container |
| **Metrics exposed for monitoring** | Prometheus `/metrics` endpoint; pre-provisioned Grafana dashboard at `:3001` |
| **All significant actions audit-logged** | Immutable `audit_events` table records every operation with investor context |
| **Minors are education-only** | `guardian_required` flag enforced at the risk modeling layer; live trading blocked |
| **The system can say "don't invest yet"** | Financial Stability Score may restrict aggressive strategies; high debt triggers debt-first recommendation |

This architecture makes TradeOps auditable by design — not as an afterthought.

### Explainable Financial Cognition (v1.5.0–v2.0.0)

TradeOps goes beyond recommendations to build longitudinal financial understanding:

| Feature | What it does |
|---|---|
| **Decision Provenance** | Every AI recommendation, coach insight, and rebalance is recorded with full frozen inputs — risk model snapshot, holdings, market signals, token counts |
| **Decision Replay** | Re-run any past AI recommendation on its original frozen inputs to test non-determinism and counterfactual reasoning |
| **Decision Timeline** | Unified chronological feed merging AI events and portfolio transactions; causal notes show portfolio impact in the 7 days following each decision |
| **Strategy Drift Detection** | Compares actual portfolio tier allocation (low-risk / growth / high-risk) against risk model targets; alignment score 0–100 |
| **Behavioral Intelligence** | Detects trading patterns (overtrading, long-term discipline, strategy follow-through) from 12 months of transaction history; behavioral score 0–100 |
| **Performance Attribution** | Breaks portfolio value change into capital deployed, market return, and fees drag; multi-dimensional confidence score per attribution result |
| **Investor Maturity Engine** | Deterministic 4-stage scoring (Foundation → Discipline → Optimization → Advanced Cognition) across 8 weighted dimensions; unlocks features as the investor matures; refreshed weekly |
| **Financial Twin** | 8-dimensional behavioral mirror (Stability, Discipline, Emotional Risk, Consistency, Resilience, Risk Alignment, Long-Term Discipline, Contribution Momentum); updated daily; SVG radar chart |
| **Financial Health Radar** | 9-dimensional financial health score (Stability, Liquidity, Discipline, Diversification, Emotional Control, Contribution Consistency, Tax Efficiency, Risk Alignment, Resilience); co-computed with Twin |
| **Behavioral Risk Warnings** | 7 deterministic detection rules (panic selling, performance chasing, revenge trading, overtrading spike, concentration addiction, risk creep, strategy abandonment); active/resolved event tracking; daily background scan |
| **Extended Attribution** | 3 supplementary illustrative estimates added to the Attribution page: Behavioral Drag (short-term trade fees), FX Drag (currency movement P&L), Concentration Cost (losses from top-3 concentrated holdings) |
| **Simulation Engine** | 6 financial futures scenarios: 3 deterministic (Debt Payoff, Save More, Job Loss) + 3 Monte Carlo / 1 000-iteration seeded (Market Crash, Retirement, Custom); p10/p50/p90 trajectory chart; fully reproducible; required disclaimer on every run |
| **Counterfactual Replay** | 3 backward-looking what-if replays forked from historical decision points: Rebalance (follow recommendation), Constraint (enforce allocation rule from first violation), Hold (reverse panic-sell); dual-path chart showing counterfactual vs actual path; delta and delta % |
| **Maturity-Aware AI Thought Partner** | AI Investment Agent adapts communication style to the investor's maturity stage (Foundation → Advanced Cognition); injects twin snapshot + behavioral risk history into every prompt; `?verbosity=beginner\|standard\|advanced` override |

These features share a common foundation: all significant decisions are recorded with deterministic inputs and AI outputs, making the entire decision history queryable, explainable, and auditable.

---

## Quickstart

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) 24.x+
- `ANTHROPIC_API_KEY` — optional, enables all AI features

### 1. Clone and configure

```bash
git clone https://github.com/erezrozenbaum/tradeops.git
cd tradeops
cp backend/.env.example backend/.env
```

Edit `backend/.env` and set at minimum:

```env
JWT_SECRET_KEY=your-32-char-minimum-secret-key-here
ANTHROPIC_API_KEY=sk-ant-...   # optional — AI features only
```

### 2. Start

```bash
docker compose -f infra/docker-compose.yml up -d
```

Database migrations run automatically on backend startup.

### 3. Open

| Service | URL |
|---------|-----|
| App | http://localhost:3000 |
| API docs | http://localhost:8000/docs |

### 4. Create your first account

Visit http://localhost:3000, register, then follow the onboarding flow:

```
Profile → Financial → Goals → Risk Model → Strategies → Paper Trade
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET_KEY` | Yes | HS256 signing key (min 32 chars) |
| `ANTHROPIC_API_KEY` | No | Enables all AI features |
| `ALPHA_VANTAGE_API_KEY` | No | Higher price fetch rate limit |
| `WORKERS_ENABLED` | No | `true` to enable background jobs |
| `REDIS_URL` | No | Redis URL (e.g. `redis://redis:6379/0`). Falls back to in-memory if unset. |
| `SMTP_HOST/USER/PASS` | No | Required for weekly digest emails |
| `ALLOWED_ORIGINS` | No | CORS origins (comma-separated) |

---

## Documentation

| Doc | Description |
|-----|-------------|
| [`docs/architecture.md`](docs/architecture.md) | Full module map, API routing, frontend structure, worker schedule |
| [`docs/schema.md`](docs/schema.md) | Complete DB schema + 40-migration history |
| [`docs/admin-guide.md`](docs/admin-guide.md) | Installation, Kubernetes, operations, troubleshooting |
| [`CHANGELOG.md`](CHANGELOG.md) | Full version history |
| [`LEGAL_DISCLAIMER.md`](LEGAL_DISCLAIMER.md) | Full legal disclaimer, risk disclosure, AI limitations |

---

## Safety Principles

These are non-negotiable and enforced in code — not just policy:

1. **AI never directly executes trades** — every order goes through the deterministic Risk Engine
2. **Live trading disabled by default** — requires paper track record (Sharpe ≥ 0.5, ≥ 30 days) + admin approval + explicit risk acknowledgment
3. **Every order passes the Risk Engine** — max position size, max open positions, concentration limits
4. **Strategy recommendations from curated templates only** — AI cannot invent strategies
5. **Minors are education-only by default** — `guardian_required` flag enforced at the risk modeling layer
6. **The system can recommend "don't invest yet"** — financial stability score may block aggressive strategies
7. **The system can recommend debt reduction first** — high-interest debt is flagged before investment
8. **All significant actions are audit-logged** — full context, immutable

---

## Legal

TradeOps AI is **not a registered investment advisor, broker, or financial institution**.

It is educational and analytical software. See [`LEGAL_DISCLAIMER.md`](LEGAL_DISCLAIMER.md) for:
- No financial advice disclaimer
- Risk disclosure
- AI limitations and accuracy
- Third-party data disclaimer
- Tax disclaimer
- Live trading risk
- Jurisdiction disclaimer
- Open-source warranty ("AS IS")

---

## License

MIT — see [LICENSE](LICENSE) for details.

> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
> TradeOps AI is not a licensed financial advisor, broker, or portfolio manager.
> Use entirely at your own risk.

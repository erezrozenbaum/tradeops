# TradeOps AI

<div align="center">

**Personal Financial Intelligence Platform**

[![Version](https://img.shields.io/badge/version-0.97.0-blue?style=flat-square)](CHANGELOG.md)
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
| **Paper trading** | Real virtual trading: buy/sell any ticker, live price fetch, WACC positions, order history |
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
│  │ Score · Rebal  │  │  (decision-     │  │  14 daily    │  │
│  │ Gate · Backtest│  │   support only) │  │  jobs        │  │
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

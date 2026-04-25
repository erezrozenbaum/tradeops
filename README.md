# TradeOps AI

Personal Financial Intelligence Platform — AI-assisted financial analysis, strategy recommendation, backtesting, and paper trading.

> **MVP status.** Live trading is intentionally disabled. The system is designed for financial education, analysis, and validated simulation only.

---

## What it does

```
Investor Profile → Financial Context → Risk Model → Strategy → Backtest → Paper Trade → AI Report
```

1. **Investor & financial profiling** — personal data, income/expenses, assets, debts, goals
2. **Financial stability scoring** — deterministic engine assessing readiness to invest
3. **Risk allocation model** — percentage-based capital allocation tied to the stability score
4. **Strategy recommendations** — ranked list from a curated template library
5. **Backtesting** — deterministic simulation of strategy performance over configurable periods
6. **Paper trading** — month-by-month portfolio simulation without real capital
7. **AI financial report** — Claude-powered 7-section narrative analysis

---

## Tech stack

| Layer      | Technology                              |
|------------|-----------------------------------------|
| Backend    | Python 3.11, FastAPI, SQLAlchemy, Alembic |
| Database   | PostgreSQL 16                           |
| Frontend   | Next.js 14 (App Router), Tailwind CSS, Recharts |
| AI         | Anthropic Claude API                    |
| Container  | Docker, Docker Compose                  |
| CI         | GitHub Actions                          |

---

## Quick start (Docker Compose)

### Prerequisites
- Docker Desktop
- Anthropic API key (for AI report generation)

### 1. Clone

```bash
git clone https://github.com/erezrozenbaum/tradeops.git
cd tradeops
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
DATABASE_URL=postgresql://tradeops:tradeops@db:5432/tradeops
ANTHROPIC_API_KEY=sk-ant-...
SECRET_KEY=change-me-in-production
```

### 3. Start

```bash
cd infra
docker compose up
```

This will:
- Start PostgreSQL
- Run `alembic upgrade head` (schema migrations + strategy template seed)
- Start the FastAPI backend on `http://localhost:8000`
- Start the Next.js dev server on `http://localhost:3000`

### 4. Open the app

Go to [http://localhost:3000](http://localhost:3000).  
On first run, the login page will open the profile creation form automatically — fill in your details and you'll be taken straight to the dashboard.

---

## Development (local, without Docker)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
# set DATABASE_URL in backend/.env pointing to a local or Docker PostgreSQL
alembic upgrade head
uvicorn app.main:app --reload
```

API docs available at [http://localhost:8000/docs](http://localhost:8000/docs).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App available at [http://localhost:3000](http://localhost:3000).

---

## Project structure

```
tradeops/
├── backend/
│   ├── app/
│   │   ├── api/v1/router.py        # Route assembly
│   │   ├── models/                  # SQLAlchemy ORM models
│   │   ├── schemas/                 # Pydantic request/response schemas
│   │   ├── investor_profiles/
│   │   ├── financial_profiles/
│   │   ├── family_profiles/
│   │   ├── goals/
│   │   ├── financial_scoring/       # Stability score engine
│   │   ├── risk_modeling/
│   │   ├── strategy_library/
│   │   ├── strategy_selection/
│   │   ├── backtesting/             # Simulation engine
│   │   ├── paper_trading/
│   │   ├── ai_analysis/             # Claude integration
│   │   ├── audit/
│   │   └── dashboard/
│   ├── alembic/versions/            # DB migrations
│   └── tests/
├── frontend/
│   └── src/app/
│       ├── (auth)/login/            # Login + profile creation
│       └── (dashboard)/
│           ├── page.tsx             # Dashboard overview
│           ├── risk/
│           ├── strategies/
│           ├── backtesting/
│           ├── paper-trading/
│           ├── reports/
│           ├── audit/
│           └── settings/
├── infra/
│   └── docker-compose.yml
└── docs/
    ├── architecture.md
    ├── admin-guide.md
    └── project_spec.md
```

---

## API reference

Interactive docs: `http://localhost:8000/docs` (Swagger UI)

Key endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/v1/investors/` | List / create investor profiles |
| GET | `/api/v1/investors/{id}` | Get investor profile |
| GET/POST | `/api/v1/investors/{id}/financial-profile` | Financial profile |
| GET/POST | `/api/v1/investors/{id}/risk-model` | Risk allocation model |
| GET/POST | `/api/v1/investors/{id}/strategies` | Strategy recommendations |
| GET/POST | `/api/v1/investors/{id}/backtests` | Backtest runs |
| GET/POST | `/api/v1/investors/{id}/paper-portfolios` | Paper trading portfolios |
| POST | `/api/v1/investors/{id}/ai-report` | Generate AI financial report |
| GET | `/api/v1/investors/{id}/audit-events` | Audit log |
| GET | `/api/v1/strategies/templates` | Strategy template library |

---

## Safety principles

- Live trading is **disabled** in MVP scope
- Minors are restricted to education-only mode
- All strategy recommendations come from curated templates — AI cannot invent trading logic
- Every significant action is written to the audit log
- The system can recommend *not* investing (emergency fund, debt reduction first)
- Risk allocation is percentage-based, not a vague low/medium/high slider

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

---

## License

Private — all rights reserved.

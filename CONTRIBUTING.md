# Contributing to TradeOps AI

Thank you for your interest in contributing. This document explains how to set up the dev environment, code standards, and the PR process.

---

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Code Standards](#code-standards)
- [Running Tests](#running-tests)
- [Submitting a PR](#submitting-a-pr)
- [Financial Safety Rules](#financial-safety-rules)

---

## Development Setup

### Prerequisites

- Docker Desktop 24.x+
- Python 3.11+ (for local backend work)
- Node.js 20+ (for local frontend work)
- Git

### 1. Clone

```bash
git clone https://github.com/erezrozenbaum/tradeops.git
cd tradeops
```

### 2. Configure secrets

```bash
cp backend/.env.example backend/.env
# Edit backend/.env — set JWT_SECRET_KEY at minimum
```

### 3. Start with Docker

```bash
docker compose -f infra/docker-compose.yml up -d
```

All services start: PostgreSQL, Redis, backend (FastAPI), frontend (Next.js).

### 4. Local backend (optional — for faster iteration)

```bash
cd backend
python -m venv venv
source venv/bin/activate        # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Requires a running PostgreSQL and Redis (can use Docker for those only).

### 5. Local frontend (optional)

```bash
cd frontend
npm install
npm run dev
```

---

## Project Structure

```
tradeops/
├── backend/
│   ├── app/
│   │   ├── api/            # FastAPI routers
│   │   ├── models/         # SQLAlchemy models
│   │   ├── core/           # Auth, config, security
│   │   ├── workers/        # APScheduler background jobs
│   │   └── <module>/       # Feature modules (service + router + schemas)
│   └── alembic/versions/   # DB migrations
├── frontend/
│   └── src/app/(dashboard)/ # Next.js App Router pages
├── infra/                   # docker-compose + nginx + redis config
├── helm/tradeops/           # Kubernetes Helm chart
└── docs/                    # Architecture, schema, admin guide
```

See [`docs/architecture.md`](docs/architecture.md) for the full module map.

---

## Code Standards

### Backend (Python)

- **Style**: [ruff](https://docs.astral.sh/ruff/) — `ruff check .` must pass with zero warnings
- **Security**: [bandit](https://bandit.readthedocs.io/) — `bandit -r app/ -ll` must pass
- **Vulnerability scan**: `pip-audit` — no HIGH/CRITICAL open vulnerabilities
- **Type hints**: required on all public functions
- **Imports**: standard → third-party → local; no wildcard imports
- **No raw SQL**: use SQLAlchemy ORM; never interpolate user input into queries
- **No secrets in code**: all config via environment variables

```bash
cd backend
ruff check .
bandit -r app/ -ll
pip-audit
```

### Frontend (TypeScript / Next.js)

- **Type checking**: `tsc --noEmit` must pass
- **No `any` types** without explicit justification in a comment
- **Components**: functional only; no class components
- **Styling**: Tailwind CSS utility classes; no inline style objects unless unavoidable
- **Data fetching**: direct `fetch()` calls to the backend API in page components

```bash
cd frontend
npx tsc --noEmit
npm run lint
```

### Database migrations

- Every schema change requires an Alembic migration
- Migration file names follow the pattern `NNNN_short_description.py`
- Migrations must be reversible (`downgrade()` must restore the previous state)
- Never modify existing migration files after they have been merged

---

## Running Tests

```bash
# Backend
cd backend
pytest

# Frontend type check
cd frontend
npx tsc --noEmit
```

The CI pipeline also runs:
- Alembic upgrade → table count check → downgrade → upgrade on a real Postgres container
- `pip-audit` for backend CVEs
- `npm audit` for frontend CVEs

---

## Submitting a PR

1. **Branch from `main`**: `git checkout -b feature/your-feature-name`
2. **Keep PRs focused** — one feature or fix per PR
3. **Pass all checks** before opening the PR:
   - `ruff check .` (backend)
   - `bandit -r app/ -ll` (backend)
   - `tsc --noEmit` (frontend)
   - `pytest` (backend)
4. **Update documentation** if your change affects:
   - A new feature → add to README feature table
   - A DB schema change → update `docs/schema.md`
   - An API endpoint change → update `docs/architecture.md`
   - A user-facing change → add to `CHANGELOG.md`
5. **PR description** must include:
   - What changed and why
   - Risk classification (safe / moderate / risky)
   - Test plan

---

## Financial Safety Rules

These rules are non-negotiable. PRs that violate them will not be merged.

1. **AI must never directly execute trades** — all orders route through the deterministic Risk Engine
2. **Live trading is disabled by default** — the gate requires paper track record + admin approval
3. **No strategy logic in AI prompts** — strategy recommendations come from curated templates only
4. **All significant actions must be audit-logged** — use `create_audit_event()` for any state-changing operation
5. **Minors are education-only** — `guardian_required` flag must be respected at every level
6. **The system can recommend "don't invest yet"** — never suppress financial stability blocks
7. **No financial advice** — any new AI feature must include a disclaimer that its output is decision-support only

If you are unsure whether a change touches financial safety, open an issue to discuss before implementing.

---

## Questions?

Open a [GitHub Issue](https://github.com/erezrozenbaum/tradeops/issues) for bugs or feature discussions.
For security issues, see [SECURITY.md](SECURITY.md).

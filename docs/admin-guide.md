# TradeOps AI — Admin Guide

**Version:** 0.8.0  
**Last updated:** 2026-04-25

This guide covers installation, configuration, database management, and day-to-day operations for running TradeOps AI in a local or self-hosted environment.

---

## Table of contents

1. [Prerequisites](#1-prerequisites)
2. [Environment configuration](#2-environment-configuration)
3. [Starting the platform](#3-starting-the-platform)
4. [Database management](#4-database-management)
5. [Managing investor profiles](#5-managing-investor-profiles)
6. [Strategy templates](#6-strategy-templates)
7. [Monitoring and logs](#7-monitoring-and-logs)
8. [Stopping and resetting](#8-stopping-and-resetting)
9. [Troubleshooting](#9-troubleshooting)
10. [CI/CD](#10-cicd)

---

## 1. Prerequisites

| Tool | Minimum version |
|------|----------------|
| Docker Desktop | 24.x |
| Docker Compose plugin | v2 |
| Git | any recent version |
| Anthropic API key | required for AI reports |

No local Python or Node.js installation is required when using Docker Compose.

---

## 2. Environment configuration

The only required configuration file is `backend/.env`.

```bash
cp backend/.env.example backend/.env   # copy template if it exists
# or create from scratch:
```

**`backend/.env` — all variables**

```env
# Required
DATABASE_URL=postgresql://tradeops:tradeops@db:5432/tradeops
ANTHROPIC_API_KEY=sk-ant-...

# Optional — defaults shown
SECRET_KEY=change-me-in-production
ENVIRONMENT=development
```

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string. When running via Docker Compose, use `db` as the host. |
| `ANTHROPIC_API_KEY` | Yes (for AI reports) | Your Anthropic API key. The platform functions without it but the "Generate Report" button will return an error. |
| `SECRET_KEY` | Recommended | Used for any internal signing. Change before any internet-facing deployment. |

---

## 3. Starting the platform

```bash
cd infra
docker compose up          # foreground, shows all logs
docker compose up -d       # detached (background)
```

Start-up sequence (automatically ordered by health checks):

1. **PostgreSQL** starts and passes the `pg_isready` health check
2. **Backend** runs `alembic upgrade head` (idempotent — safe to run on every start), then starts `uvicorn` with `--reload`
3. **Frontend** installs npm dependencies and starts the Next.js dev server

First cold start takes 2–3 minutes while npm downloads packages.

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API docs (Swagger) | http://localhost:8000/docs |
| API docs (ReDoc) | http://localhost:8000/redoc |

---

## 4. Database management

### Running migrations manually

```bash
docker compose exec backend alembic upgrade head
```

This is also run automatically on every container start.

### Creating a new migration

```bash
docker compose exec backend alembic revision --autogenerate -m "description"
```

Review the generated file in `backend/alembic/versions/` before applying.

### Rolling back one migration

```bash
docker compose exec backend alembic downgrade -1
```

### Viewing migration history

```bash
docker compose exec backend alembic history
docker compose exec backend alembic current
```

### Connecting to PostgreSQL directly

```bash
docker compose exec db psql -U tradeops -d tradeops
```

Common queries:

```sql
-- List all investors
SELECT id, full_name, country, base_currency, created_at FROM investor_profiles ORDER BY created_at;

-- Count audit events per investor
SELECT investor_profile_id, COUNT(*) FROM audit_events GROUP BY investor_profile_id;

-- View strategy templates
SELECT id, name, strategy_type, risk_level FROM strategy_templates ORDER BY risk_level;

-- View recent backtest runs
SELECT br.id, ip.full_name, br.period_months, br.total_return_pct, br.created_at
FROM backtest_runs br
JOIN investor_profiles ip ON ip.id = br.investor_profile_id
ORDER BY br.created_at DESC LIMIT 20;
```

---

## 5. Managing investor profiles

### Via the UI

Open http://localhost:3000. If no profiles exist, the creation form opens automatically.  
Fields required: full name, date of birth, country code (2–3 chars), base currency, local currency, experience level.

### Via the API (Swagger UI)

Open http://localhost:8000/docs, find `POST /api/v1/investors/`, and submit:

```json
{
  "full_name": "Jane Smith",
  "date_of_birth": "1990-06-15",
  "country": "US",
  "base_currency": "USD",
  "local_currency": "USD",
  "experience_level": "beginner",
  "is_minor": false
}
```

### Deleting an investor profile

There is no delete endpoint in the MVP. Use SQL directly:

```sql
-- Replace <id> with the investor UUID
DELETE FROM investor_profiles WHERE id = '<id>';
```

Note: related rows in financial_profiles, goals, risk_models, etc. will cascade-delete if foreign keys are set with `ON DELETE CASCADE`, otherwise delete child rows first.

---

## 6. Strategy templates

Strategy templates are seeded by migration `0002_strategy_tables.py` and are read-only in the MVP.

To view current templates:

```bash
curl http://localhost:8000/api/v1/strategies/templates
```

To add a new template, edit the migration seed data or insert directly:

```sql
INSERT INTO strategy_templates (id, name, strategy_type, risk_level, description, ...)
VALUES (gen_random_uuid(), 'My Strategy', 'custom', 'moderate', '...');
```

---

## 7. Monitoring and logs

### View logs

```bash
docker compose logs -f              # all services
docker compose logs -f backend      # backend only
docker compose logs -f frontend     # frontend only
docker compose logs -f db           # postgres only
```

### Backend log format

FastAPI/uvicorn logs to stdout in development mode. Each request is logged with method, path, and status code.

### Audit log (application-level)

All significant user actions are recorded in the `audit_events` table:

```bash
curl "http://localhost:8000/api/v1/investors/<id>/audit-events?limit=50"
```

Or view in the UI at http://localhost:3000/audit.

---

## 8. Stopping and resetting

### Stop containers (preserve data)

```bash
docker compose down
```

### Stop and remove the database volume (full reset)

```bash
docker compose down -v
```

This destroys all PostgreSQL data. On next `docker compose up`, migrations run fresh and all investor data is gone.

### Rebuild images after code changes

```bash
docker compose build backend
docker compose build
docker compose up
```

The frontend dev server reloads automatically on file changes (hot reload via Next.js). The backend also hot-reloads via `uvicorn --reload`.

---

## 9. Troubleshooting

### Backend fails to start — "could not connect to server"

PostgreSQL is not ready yet. The backend depends on the `db` service health check, but on very slow machines the first start can take longer than the retry window.

```bash
docker compose up db          # start only postgres
# wait for "database system is ready to accept connections"
docker compose up backend     # start backend separately
```

### Backend fails — "relation does not exist"

Migrations did not run. Run manually:

```bash
docker compose exec backend alembic upgrade head
```

### Frontend shows "Could not connect to the API"

The backend is not running or not reachable. Check:

```bash
docker compose ps             # is backend container running?
docker compose logs backend   # any startup errors?
curl http://localhost:8000/docs   # is the API responding?
```

### AI report returns error

Verify `ANTHROPIC_API_KEY` is set in `backend/.env` and the container was restarted after setting it:

```bash
docker compose exec backend env | grep ANTHROPIC
```

### Frontend npm install hangs

The first start downloads all npm packages inside the container. This can take 2–5 minutes on a slow connection. Check with:

```bash
docker compose logs -f frontend
```

### Port conflict

If ports 3000 or 8000 are in use, edit `infra/docker-compose.yml`:

```yaml
ports:
  - "3001:3000"    # map host 3001 → container 3000
```

---

## 10. CI/CD

### GitHub Actions

The workflow at `.github/workflows/ci.yml` runs on every push to `main`:

1. **Backend tests** — `pytest` with a test PostgreSQL instance
2. **Backend Docker image build**
3. **Frontend Docker image build**

### Running tests locally

```bash
# Backend tests
cd backend
pip install -r requirements.txt
DATABASE_URL=postgresql://... pytest

# Or via Docker
docker compose exec backend pytest
```

### Building production Docker images locally

```bash
docker build -t tradeops-backend ./backend
docker build -t tradeops-frontend ./frontend
```

The frontend Dockerfile produces a standalone Next.js image (optimised for production). The `public/` directory must contain at least a `.gitkeep` file so the Docker `COPY` step does not fail on an empty directory.

---

## Maintenance checklist

When making changes to the platform:

- [ ] If DB schema changed: create an Alembic migration and test `upgrade` + `downgrade`
- [ ] If a new API endpoint added: update `docs/architecture.md` API table
- [ ] If a new frontend page added: update the frontend structure section in `docs/architecture.md`
- [ ] Update `CHANGELOG.md` with the change under `[Unreleased]`
- [ ] Run the CI workflow (push to `main` or open a PR)

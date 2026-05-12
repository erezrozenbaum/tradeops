# TradeOps AI — Admin Guide

**Version:** 0.51.0  
**Last updated:** 2026-05-11

This guide covers installation, configuration, database management, Kubernetes deployment, and day-to-day operations for TradeOps AI.

---

## Table of contents

1. [Prerequisites](#1-prerequisites)
2. [Environment configuration](#2-environment-configuration)
3. [Starting with Docker Compose (local/dev)](#3-starting-with-docker-compose-localdev)
4. [Database management](#4-database-management)
5. [Managing investor profiles](#5-managing-investor-profiles)
6. [Strategy templates](#6-strategy-templates)
7. [Monitoring and logs](#7-monitoring-and-logs)
8. [Stopping and resetting](#8-stopping-and-resetting)
9. [Kubernetes deployment (Helm)](#9-kubernetes-deployment-helm)
10. [ArgoCD — GitOps CI/CD](#10-argocd--gitops-cicd)
11. [GitHub Actions — Docker image pipeline](#11-github-actions--docker-image-pipeline)
12. [Troubleshooting](#12-troubleshooting)
13. [Feature reference](#13-feature-reference)
14. [Maintenance checklist](#14-maintenance-checklist)

---

## 1. Prerequisites

### Docker Compose (local development)

| Tool | Minimum version |
|------|----------------|
| Docker Desktop | 24.x |
| Docker Compose plugin | v2 |
| Git | any recent version |
| Anthropic API key | required for AI features |

No local Python or Node.js installation is required.

### Kubernetes deployment

| Tool | Notes |
|------|-------|
| Kubernetes cluster | 1.27+ (AKS, EKS, GKE, k3s, minikube all work) |
| Helm | 3.12+ |
| nginx-ingress controller | for Ingress routing |
| cert-manager | optional, for automatic TLS |
| ArgoCD | optional, for GitOps CD |

---

## 2. Environment configuration

The only required configuration file for Docker Compose is `backend/.env`.

```bash
cp backend/.env.example backend/.env
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
| `DATABASE_URL` | Yes | PostgreSQL connection string. In Docker Compose the host is `db`. |
| `ANTHROPIC_API_KEY` | Yes (for AI features) | AI Report, Market Research, Recommendations, and AI Agent all require this. The platform runs without it but those features return errors. |
| `SECRET_KEY` | Recommended | Change before any internet-facing deployment. |

---

## 3. Starting with Docker Compose (local/dev)

```bash
cd infra
docker compose up -f docker-compose.yml          # foreground
docker compose up -f docker-compose.yml -d       # detached
```

Start-up order (automatically ordered by health checks):

1. **PostgreSQL** starts and passes the `pg_isready` health check
2. **Backend** runs `alembic upgrade head` (idempotent), then starts `uvicorn --reload`
3. **Frontend** installs npm dependencies and starts the Next.js server

First cold start takes 2–3 minutes while npm downloads packages.

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| Swagger UI | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |

---

## 4. Database management

### Running migrations manually

```bash
docker compose -f infra/docker-compose.yml exec backend alembic upgrade head
```

Migrations also run automatically on every container start.

### Migration history (22 migrations as of v0.49.0)

| # | Description |
|---|-------------|
| 0001 | Initial schema (investor_profiles, financial_profiles, etc.) |
| 0002 | Strategy tables |
| 0003 | Backtest tables |
| 0004 | Paper trading tables |
| 0005 | Investor profile extensions |
| 0006 | Risk model enforcement fields |
| 0007 | Holdings (investment_accounts, investment_holdings) |
| 0008 | Currency rates |
| 0009 | Price snapshots |
| 0010 | Portfolio snapshots |
| 0011 | Goal tracking modes |
| 0012 | Pension fund fields |
| 0013 | Study fund fields |
| 0014 | Vehicle asset type |
| 0015 | Alert email field |
| 0016 | Widen nationality columns |
| 0017 | Watchlist |
| 0018 | Family financial model |
| 0019 | Holding transactions |
| 0020 | Price alerts |
| 0021 | `is_emergency_fund` flag on `investment_accounts` |
| 0022 | `is_emergency_fund` flag on `investment_holdings` |

### Creating a new migration

```bash
docker compose -f infra/docker-compose.yml exec backend alembic revision --autogenerate -m "description"
```

Review the generated file in `backend/alembic/versions/` before applying.

### Rolling back

```bash
docker compose -f infra/docker-compose.yml exec backend alembic downgrade -1
```

### Connecting to PostgreSQL directly

```bash
docker compose -f infra/docker-compose.yml exec db psql -U tradeops -d tradeops
```

Useful queries:

```sql
-- List all investors
SELECT id, full_name, country, base_currency, created_at FROM investor_profiles ORDER BY created_at;

-- Accounts marked as emergency fund
SELECT ia.provider_name, ia.account_type, ia.is_emergency_fund
FROM investment_accounts ia
WHERE ia.is_emergency_fund = true;

-- Holdings marked as emergency fund
SELECT ih.name, ih.asset_type, ih.current_value, ih.current_balance, ih.is_emergency_fund
FROM investment_holdings ih
WHERE ih.is_emergency_fund = true;

-- Count audit events per investor
SELECT investor_profile_id, COUNT(*) FROM audit_events GROUP BY investor_profile_id;

-- View strategy templates
SELECT id, name, strategy_type, risk_level FROM strategy_templates ORDER BY risk_level;
```

---

## 5. Managing investor profiles

### Via the UI

Open http://localhost:3000. If no profiles exist, the creation form opens automatically.

### Via the API

```bash
curl -X POST http://localhost:8000/api/v1/investors \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Jane Smith",
    "date_of_birth": "1990-06-15",
    "country": "US",
    "base_currency": "USD",
    "local_currency": "USD",
    "experience_level": "beginner",
    "is_minor": false
  }'
```

### Deleting an investor profile

```sql
DELETE FROM investor_profiles WHERE id = '<uuid>';
```

All related rows cascade-delete automatically.

---

## 6. Strategy templates

Templates are seeded by migration `0002_strategy_tables.py`.

```bash
curl http://localhost:8000/api/v1/strategies/templates
```

---

## 7. Monitoring and logs

```bash
docker compose -f infra/docker-compose.yml logs -f              # all services
docker compose -f infra/docker-compose.yml logs -f backend      # backend only
docker compose -f infra/docker-compose.yml logs -f frontend     # frontend only
```

### Background workers (APScheduler)

The backend runs 7 scheduled jobs:

| Job | Schedule | Description |
|-----|----------|-------------|
| `price_refresh` | Every 30 min | Refreshes live prices for all held tickers via yfinance |
| `snapshot_writer` | Daily 21:00 UTC | Captures portfolio snapshot for performance tracking |
| `price_alert_checker` | Every 15 min | Evaluates price alerts and sends email notifications |
| `goal_evaluation` | Daily | Evaluates goal progress |
| `notification_alerts` | Every 30 min | Generates risk/goal notifications |
| `market_prewarm` | Every 30 min | Pre-warms market scan cache |
| `research_prewarm` | Every 6 hours | Pre-warms market research cache |

### Audit log

```bash
curl "http://localhost:8000/api/v1/investors/<id>/audit-events?limit=50"
```

Or view in the UI at http://localhost:3000/audit.

---

## 8. Stopping and resetting

```bash
# Stop containers, preserve data
docker compose -f infra/docker-compose.yml down

# Stop and wipe the database
docker compose -f infra/docker-compose.yml down -v

# Rebuild after code changes
docker compose -f infra/docker-compose.yml build backend
docker compose -f infra/docker-compose.yml up -d backend
```

---

## 9. Kubernetes deployment (Helm)

The Helm chart is at `helm/tradeops/`. It deploys:

- **Backend** — FastAPI (Deployment, ClusterIP Service)
- **Frontend** — Next.js standalone (Deployment, ClusterIP Service)
- **PostgreSQL** — (StatefulSet + headless Service + PVC) — can be disabled to use an external DB
- **Ingress** — routes `/api/*` to backend, `/*` to frontend
- **Secret** — holds `DATABASE_URL` and `ANTHROPIC_API_KEY`
- **HPA** — optional horizontal pod autoscaler for the backend

### Quick install

```bash
# 1. Add/pull the repo
git clone https://github.com/erezrozenbaum/tradeops.git
cd tradeops

# 2. Install with defaults (uses bundled PostgreSQL, no TLS)
helm install tradeops ./helm/tradeops \
  --set secret.anthropicApiKey=sk-ant-... \
  --set ingress.host=tradeops.example.com

# 3. Watch pods come up
kubectl get pods -w -l app.kubernetes.io/instance=tradeops
```

### Custom values example

```yaml
# my-values.yaml
backend:
  image:
    repository: ghcr.io/erezrozenbaum/tradeops-backend
    tag: "abc1234"   # specific commit SHA
  replicas: 2

frontend:
  image:
    repository: ghcr.io/erezrozenbaum/tradeops-frontend
    tag: "abc1234"

ingress:
  enabled: true
  className: nginx
  tls: true
  host: tradeops.mycompany.com
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod

secret:
  anthropicApiKey: "sk-ant-..."
  postgresPassword: "change-me-strong-password"

postgresql:
  storage:
    size: 20Gi
    storageClass: gp3

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 8
```

```bash
helm install tradeops ./helm/tradeops -f my-values.yaml
helm upgrade tradeops ./helm/tradeops -f my-values.yaml
```

### Using an external database

```yaml
# my-values.yaml
postgresql:
  enabled: false

secret:
  databaseUrl: "postgresql://user:pass@your-rds-host:5432/tradeops"
```

### Building your own images

Images are published to GHCR by GitHub Actions on every push to `main`. To build locally:

```bash
docker build -t my-registry/tradeops-backend:latest ./backend
docker build -t my-registry/tradeops-frontend:latest ./frontend
docker push my-registry/tradeops-backend:latest
docker push my-registry/tradeops-frontend:latest
```

Then override in your values:

```yaml
backend:
  image:
    repository: my-registry/tradeops-backend
    tag: latest
frontend:
  image:
    repository: my-registry/tradeops-frontend
    tag: latest
```

---

## 10. ArgoCD — GitOps CI/CD

The ArgoCD Application manifest is at `argocd/application.yaml`. It watches the `helm/tradeops/` path in this repository and auto-syncs on changes.

### Install ArgoCD (one-time cluster setup)

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for pods to be ready
kubectl wait --for=condition=available --timeout=120s deployment/argocd-server -n argocd

# Get initial admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

### Register the TradeOps application

```bash
# Apply the pre-configured Application manifest
kubectl apply -f argocd/application.yaml

# Or add via CLI
argocd app create tradeops \
  --repo https://github.com/erezrozenbaum/tradeops.git \
  --path helm/tradeops \
  --dest-server https://kubernetes.default.svc \
  --dest-namespace tradeops \
  --sync-policy automated \
  --auto-prune \
  --self-heal
```

### GitOps flow

```
Developer push to main
        │
        ▼
GitHub Actions (docker-build-push.yml)
  • Builds backend + frontend Docker images
  • Tags with commit SHA (e.g., abc1234)
  • Pushes to ghcr.io/erezrozenbaum/
  • Commits updated image tags to helm/tradeops/values.yaml
        │
        ▼
ArgoCD detects values.yaml change
  • Diffs Helm chart against cluster state
  • Auto-syncs: rolling update with new images
  • Prunes resources removed from Git
```

### Secrets management in GitOps

`ANTHROPIC_API_KEY` and `postgresPassword` must not be committed to Git in plain text. Recommended approaches:

1. **Bitnami Sealed Secrets** — encrypt secrets with the cluster's public key, commit the sealed form, ArgoCD decrypts them
2. **External Secrets Operator** — pull secrets from AWS Secrets Manager, Azure Key Vault, or HashiCorp Vault at sync time
3. **ArgoCD Vault Plugin** — templated secrets replaced at sync time

For simple self-hosted setups, set the secret values via `helm upgrade --set secret.anthropicApiKey=...` and keep them out of Git.

---

## 11. GitHub Actions — Docker image pipeline

Workflow file: `.github/workflows/docker-build-push.yml`

**Triggers:** push to `main`, push of `v*` tags

**Jobs:**

| Step | Description |
|------|-------------|
| Build & push backend | Multi-arch image (amd64 + arm64) to `ghcr.io/erezrozenbaum/tradeops-backend` |
| Build & push frontend | Multi-arch image to `ghcr.io/erezrozenbaum/tradeops-frontend` |
| Update Helm values | Commits updated image tags to `helm/tradeops/values.yaml` with `[skip ci]` |

**Image tags:**
- `latest` — always points to the last successful `main` build
- `<short-sha>` (e.g., `abc1234`) — immutable reference to a specific build
- `<semver>` (e.g., `v0.42.1`) — when pushing a version tag

**Required repository permissions:**  
No extra secrets needed. The workflow uses `GITHUB_TOKEN` (auto-provided) for both GHCR push and the auto-commit step.

**To trigger a production-tagged release:**

```bash
git tag v0.43.0
git push origin v0.43.0
# → builds images tagged v0.43.0 + latest
```

---

## 12. Troubleshooting

### Backend fails to start — "could not connect to server"

PostgreSQL is not ready. On very slow machines the health check retry window may expire.

```bash
docker compose -f infra/docker-compose.yml up db
# wait for "database system is ready to accept connections"
docker compose -f infra/docker-compose.yml up backend
```

### Backend fails — "relation does not exist"

Migrations did not run.

```bash
docker compose -f infra/docker-compose.yml exec backend alembic upgrade head
```

### AI features return errors

Verify the key is set and the container sees it:

```bash
docker compose -f infra/docker-compose.yml exec backend env | grep ANTHROPIC
# Should print: ANTHROPIC_API_KEY=sk-ant-...
```

### Economic Calendar returns 0 events

Most ETFs (QQQ, VOO) and crypto have no earnings dates — this is expected. Stocks like NVDA, NEM will show upcoming earnings. If a known earnings stock returns nothing, the in-memory cache may hold a stale failure; restart the backend to clear it.

### News Feed shows empty articles

yfinance periodically changes its news API response structure. The service handles both the old flat format and the new nested `content` format (as of yfinance ≥0.2.x). If articles appear empty, check the yfinance version in `backend/requirements.txt` and update the parser in `backend/app/holdings_news/service.py`.

### Correlation matrix shows `data_quality: partial`

This is normal. Non-tradeable tickers (crypto tickers without Yahoo Finance symbols, Israeli stocks on TLV) cannot fetch 90-day price history. The matrix is computed from whichever tickers have data.

### Kubernetes — backend pods in CrashLoopBackOff

1. Check logs: `kubectl logs deployment/tradeops-backend`
2. Most common cause: `DATABASE_URL` is wrong. Verify the secret: `kubectl get secret tradeops -o jsonpath='{.data.DATABASE_URL}' | base64 -d`
3. Migration failure: backend exits if `alembic upgrade head` fails. Check if the DB is reachable from the pod.

### Kubernetes — frontend shows "Could not connect to the API"

The Ingress routes `/api/*` to the backend service. Verify:

```bash
kubectl get ingress tradeops
kubectl describe ingress tradeops
# Check that /api path points to the backend service on port 8000
```

---

## 13. Feature reference

### AI Intelligence features (require ANTHROPIC_API_KEY)

| Feature | Endpoint | Cache | Notes |
|---------|----------|-------|-------|
| AI Report | `/ai-report` | None (on-demand) | Full portfolio analysis |
| Recommendations | `/recommendations` | None (on-demand) | Tailored to risk model + goals |
| Market Research | `/market-research` | 6 hours | Screens 63 instruments; takes 45–60 s cold |
| AI Agent | `/agent` | None | Free-form financial assistant |

### Market data features (no API key needed — yfinance)

| Feature | Endpoint | Cache | Notes |
|---------|----------|-------|-------|
| Price refresh | `/portfolio` (POST) | 30 min | Live prices for held tickers |
| Market Scan | `/market-scan` | 30 min | Momentum, volume anomaly, sector rotation |
| Economic Calendar | `/calendar` | 24 hours per ticker | Upcoming earnings for held + watched tickers |
| Correlation Matrix | `/portfolio/correlation` | 24 hours | 90-day Pearson correlation + sector concentration |
| News Feed | `/news` | 1 hour per ticker | Latest articles for held + watched tickers |

### Professional Investment Intelligence (Phase 8)

| Feature | Endpoint | Cache | Notes |
|---------|----------|-------|-------|
| Performance Attribution | `/portfolio/attribution` | None (computed on demand) | Holding-level contribution, rolling returns, alpha vs benchmark; per-holding CAGR since purchase |
| Stress Testing | `/portfolio/stress-test` | None | 5 historical crash scenarios + Monte Carlo P10/P50/P90 |
| Income Projection | `/portfolio/income` | 24 hours per ticker | Annual dividend income + upcoming ex-dividend dates |
| Tax-Loss Harvesting | `/portfolio/tax-opportunities` | None | Holdings with >5% unrealized loss; estimated tax saving; wash-sale flag |
| PDF Report Export | `/reports/pdf?period=monthly\|quarterly` | None (on-demand) | Multi-page client-grade PDF: cover, portfolio, performance, stress test, tax summary |

### Analytics Correctness & Investor-Grade Depth (Phase 9)

| Fix / Feature | Scope | Notes |
|--------------|-------|-------|
| Fee-inclusive cost basis | `portfolio_analysis/engine.py` | `fees` field now added to cost basis; previously ignored, overstating P&L |
| Pension fund tax fix | `portfolio_analysis/engine.py` | Pension/study funds exempt from flat 25% CGT; taxed as income at withdrawal |
| Price staleness warning | `PortfolioSummary` schema + UI | Amber banner when any tickered holding falls back to cost basis (no live price) |
| Beta vs benchmark | `performance_analytics/engine.py` | Cov/Var regression against benchmark series; shown on Performance page |
| Per-holding CAGR | `performance_analytics/attribution.py` | Annualised return since purchase date; shown in contributors/detractors panel |
| Single-stock concentration | `portfolio_correlation/engine.py` | Flags any ticker > 15% of portfolio; adds warning + risk score |

**Performance Attribution** — `/portfolio/attribution`  
Computes rolling returns (1M/3M/6M/1Y) from daily portfolio snapshots. Benchmark is dynamic: Israeli (ILS) investors compare against TA-35 (`^TA35`); all others compare against S&P 500 (SPY). Alpha = portfolio return − benchmark return. Top 5 contributors and top 5 detractors shown by holding.

**Stress Testing** — `/portfolio/stress-test`  
Five pre-built historical scenarios (2008 GFC, COVID crash, 2022 rate hike cycle, 40% tech correction, ILS depreciation shock) apply per-tier drawdown percentages to the current portfolio. FX shock layer adjusts USD-denominated exposure for ILS-base-currency portfolios. Monte Carlo runs 1,000 log-normal simulations over years-to-retirement (computed from `date_of_birth`), returning P10/P50/P90 wealth paths.

**Dividend Income** — `/portfolio/income`  
Fetches forward annual dividend rate and next ex-date via yfinance for all tickered holdings. Converts dividend income to base currency. Returns upcoming ex-dividend dates within 90 days. Results cached 24h per ticker.

**Tax-Loss Harvesting** — `/portfolio/tax-opportunities`  
Identifies holdings with unrealized loss >5% (configurable threshold). Uses country-specific capital gains rate from the tax rules engine (IL: 25%, US: 15% long-term, DE: 26.375%, FR: 30%). Reports short-term vs long-term holding period, wash-sale risk (purchased <30 days ago), and estimated tax saving per opportunity.

**PDF Report Export** — `/reports/pdf?period=monthly|quarterly`  
Generates a multi-page client-grade PDF report using `reportlab` (pure Python; no system-level dependencies; Docker-friendly). Report sections: cover page with investor name / period / base currency / generation timestamp; portfolio overview with full holdings table; performance analytics (Sharpe, Sortino, max drawdown, rolling returns, benchmark alpha, top contributors/detractors); stress test scenarios + Monte Carlo projection; tax-loss harvesting summary. Returns `application/pdf` with a timestamped filename. The "Export PDF" button on the Performance page provides a hover dropdown for Monthly or Quarterly report.

**Dependency note:** `reportlab>=4.2.0` is required and installed from `requirements.txt` during Docker image build. No additional system packages are needed.

### Emergency fund linking

Emergency fund designation can be set at two granularities:

**Account level** (migration 0021):
1. **At creation** — check "Use as emergency fund" in the New account form
2. **On an existing account** — click the amber **EF** shield button on the account card

**Holding level** (migration 0022):
- Each individual holding row has its own **EF** shield button
- Useful when only part of an account (e.g., the liquid portion of a study fund) acts as emergency savings
- An amber "EF" badge appears next to the holding name when flagged

**Risk model integration:**
- The scoring engine queries holding-level flags first (`investment_holdings.is_emergency_fund`)
- Falls back to account-level flags for backward compatibility
- EF holding values use live portfolio prices (via portfolio service + FX conversion) when available
- Computed EF months = total EF value ÷ monthly expenses; the higher of computed vs manually entered is used
- The account and holding cards display an amber "Emergency Fund" badge when flagged

### Investment portfolio in Financial Profile

The Financial Profile page (`/financial`) now includes a live **Investment Portfolio** card that auto-pulls from your investment accounts. It shows:

- Each account name and type with its current value
- Total portfolio value and unrealized P&L
- A link to the Investments page for management

Investment account holding values are also automatically included in the **net worth** and **Financial Stability Score** calculation in the risk model — you no longer need to manually re-enter your portfolio as a financial asset.

### Performance tracking

Portfolio snapshots are captured daily at 21:00 UTC by the `snapshot_writer` worker. The Performance page shows an equity curve, Sharpe ratio, Sortino ratio, max drawdown, and S&P 500 benchmark comparison. New accounts will see data the following day after the first snapshot runs.

---

## 14. Maintenance checklist

When making changes to the platform:

- [ ] DB schema changed → create an Alembic migration, test `upgrade` + `downgrade`
- [ ] New API endpoint → document in `docs/architecture.md`
- [ ] New frontend page → add to sidebar + help page
- [ ] Add changes to `CHANGELOG.md` under `## [Unreleased]`
- [ ] When ready to release → promote `[Unreleased]` to a dated version block and commit to `main`
- [ ] For K8s release → `git tag vX.Y.Z && git push origin vX.Y.Z` → GitHub Actions builds tagged images

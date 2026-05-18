# TradeOps AI — Admin Guide

**Version:** 0.90.0  
**Last updated:** 2026-05-18

This guide covers installation, configuration, database management, Kubernetes deployment, and day-to-day operations for TradeOps AI.

---

## Table of contents

1. [Prerequisites](#1-prerequisites)
2. [Environment configuration](#2-environment-configuration)
3. [Starting with Docker Compose (local/dev)](#3-starting-with-docker-compose-localdev)
4. [Database management](#4-database-management)
5. [Authentication & user management](#5-authentication--user-management)
6. [Managing investor profiles](#6-managing-investor-profiles)
7. [Strategy templates](#7-strategy-templates)
8. [Monitoring and logs](#8-monitoring-and-logs)
9. [Stopping and resetting](#9-stopping-and-resetting)
10. [Kubernetes deployment (Helm)](#10-kubernetes-deployment-helm)
11. [ArgoCD — GitOps CI/CD](#11-argocd--gitops-cicd)
12. [GitHub Actions — Docker image pipeline](#12-github-actions--docker-image-pipeline)
13. [Troubleshooting](#13-troubleshooting)
14. [Feature reference](#14-feature-reference)
15. [Maintenance checklist](#15-maintenance-checklist)

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
ALLOWED_ORIGINS=http://localhost:3000
AI_MONTHLY_BUDGET_USD=0
REDIS_URL=redis://redis:6379/0
```

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string. In Docker Compose the host is `db`. |
| `ANTHROPIC_API_KEY` | Yes (for AI features) | AI Report, Market Research, Recommendations, and AI Agent all require this. The platform runs without it but those features return errors. |
| `SECRET_KEY` | Recommended | Change before any internet-facing deployment. |
| `ALLOWED_ORIGINS` | Production | Comma-separated list of allowed CORS origins. Default `http://localhost:3000`. Set to your production URL in deployment. |
| `AI_MONTHLY_BUDGET_USD` | No | Rolling 30-day AI spend cap per investor in USD. `0` = unlimited (default). Set e.g. `5.0` to cap at $5/investor/month. |
| `REDIS_URL` | No | Redis connection string for distributed rate limiting. Example: `redis://redis:6379/0`. Falls back to in-memory if unset (safe for single-instance dev). |

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

### Migration history (36 migrations as of v0.90.0)

| # | Description |
|---|-------------|
| 0001 | Initial schema (investor_profiles, financial_profiles, goals, risk_models, strategy_templates) |
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
| 0023 | Goal linked_account_id FK |
| 0024 | **users table + JWT auth** (email, password_hash, role) |
| 0025 | Account auto-sync fields |
| 0026 | Holding management fees |
| 0027 | Options holdings (strike, expiry, type, multiplier, position_type) |
| 0028 | Investor weekly digest opt-in |
| 0029 | Holding purchase_fx_rate |
| 0030 | market_signals table |
| 0031 | Holding makdam column (Israeli pension) |
| 0032 | ai_usage_logs table (AI cost tracking) |
| 0033 | Family multi-user invite fields; account owner_type; holding balance_updated_at |
| 0034 | CHECK constraints on enum VARCHAR columns |
| 0035 | live_trading_sessions table |
| 0036 | Index on audit_events.investor_profile_id; CHECK constraints on pct columns |

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

## 5. Authentication & user management

### How authentication works

TradeOps AI uses stateless JWT authentication:

1. User registers via `POST /api/v1/auth/register` (email + password).
2. User logs in via `POST /api/v1/auth/login` — a 7-day HS256 JWT is issued containing `user_id`, `exp`, and a unique `jti` (JWT ID). The token is stored in an HttpOnly `SameSite=Strict` cookie (`tradeops_token`).
3. All `/api/v1/investors/...` routes require a valid, non-blacklisted token.
4. `POST /api/v1/auth/logout` — writes the token's JTI to Redis with a TTL equal to the remaining token lifetime. The token is immediately invalid even if replayed.

Passwords are hashed with bcrypt. There is no plaintext password storage.

### User roles

| Role | Capabilities |
|------|-------------|
| `user` | Access their own investor profiles only |
| `admin` | Access admin panel, AI cost logs, user management, assign profiles |

Promote a user to admin via the admin panel UI, or directly:

```sql
UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
```

### Creating the first admin

The first user to register gets the `user` role by default. Promote them manually:

```bash
docker compose -f infra/docker-compose.yml exec db \
  psql -U tradeops -d tradeops \
  -c "UPDATE users SET role = 'admin' WHERE email = 'your@email.com';"
```

### Token blacklist (Redis)

The JWT JTI blacklist lives in Redis under keys `jwt_bl:{jti}`. Each key expires automatically when the token would have expired naturally — no manual cleanup needed.

If Redis is unavailable, the blacklist falls back to per-process in-memory storage. This means tokens revoked during a Redis outage may still pass validation in other worker processes. Redis availability is important for production deployments with multiple replicas.

### Login rate limiting

5 failed login attempts per IP address per 5-minute sliding window. Backed by Redis sorted sets. Falls back to in-memory if Redis is unavailable (per-process, not distributed in that mode).

---

## 6. Managing investor profiles

### Via the UI

Open http://localhost:3000. If no profiles exist, the creation form opens automatically.

### Via the API

All API calls require authentication. Obtain a session cookie first:

```bash
# 1. Login — sets HttpOnly tradeops_token cookie
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email": "admin@example.com", "password": "your-password"}'

# 2. Create investor profile (cookie forwarded automatically)
curl -X POST http://localhost:8000/api/v1/investors \
  -H "Content-Type: application/json" \
  -b cookies.txt \
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

## 7. Strategy templates

Templates are seeded by migration `0002_strategy_tables.py`.

```bash
curl http://localhost:8000/api/v1/strategies/templates
```

---

## 8. Monitoring and logs

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

## 9. Stopping and resetting

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

## 10. Kubernetes deployment (Helm)

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

## 11. ArgoCD — GitOps CI/CD

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

## 12. GitHub Actions — Docker image pipeline

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

## 13. Troubleshooting

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

## 14. Feature reference

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
| Realized P&L | `portfolio_analysis/service.py` + `PortfolioSummary` | WAVG cost basis from buy/sell transactions; `realized_pnl_total` and `realized_pnl_ytd` in base currency; 5th card on investments page |
| Money-Weighted Return (IRR) | `performance_analytics/engine.py` + `schemas.py` | Newton-Raphson IRR from buy transactions vs current portfolio value; `mwr_pct` shown alongside TWR on performance page |
| Actionable rebalancing | `rebalance_engine.py` + `rebalance_schemas.py` | `SuggestedTrade` per tier: specific ticker, unit count, and estimated value computed from live price; replaces generic monetary hint |
| Retirement Readiness Score | `retirement_readiness/` module | 0–100 score from pension projection + MC P50 + 4% SWR vs monthly expenses. `GET /investors/{id}/retirement-readiness`. Card on dashboard + section on stress-test page. |
| Goals linked to accounts | Migration 0023 + `goals_analysis/engine.py` | `linked_account_id` FK on `financial_goals`; linked goal's current_amount auto-synced from account total value via `_GoalProxy`. Account selector in goal form. |
| Broker Import | `broker_sync/` module | `POST /investors/{id}/accounts/{account_id}/broker-sync` — multipart upload (file + broker_type). Parsers: IBKR Flex Query XML, eToro CSV, Altshuler Shaham Trade CSV/XLSX, ALTrade CSV/XLSX. Upserts holdings (match by ISIN → ticker → name). "Broker Import" button on each account card. |
| Broker Auto-Sync | Migration 0025 + `workers/jobs/broker_auto_sync.py` | Per-account toggle (`auto_sync_enabled`). Daily at 09:00 UTC: refreshes market prices for all holdings in enabled accounts, updates `last_synced_at`. `PATCH /investors/{id}/accounts/{account_id}/auto-sync`. Blue "Auto/Sync" toggle on account card. |
| Mobile-First UI | `sidebar.tsx` + `layout.tsx` + all page containers | Hamburger drawer on `<lg` screens; fixed sidebar on `lg+`. Responsive `p-4 sm:p-6 lg:p-8` padding on all pages. Holdings tables: horizontal scroll on mobile. |
| Auth & Multi-user | Migration 0024 + `app/auth/` | JWT auth (HS256, 7-day tokens). `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me`. All routes require `Authorization: Bearer <token>`. Investor profiles scoped to authenticated user. `SECRET_KEY` env var required. |
| Admin Panel | `app/admin/` + `/admin` page | Multi-tenant management dashboard. Shows user/profile stats, user table (promote/demote/delete), profile assignment. Accessible only to `role=admin` users. First admin must be set via SQL: `UPDATE users SET role='admin' WHERE email='...'`. |
| Management Fees | Migration 0026 + `pension_projection.py` + `pension_simulation/engine.py` | `management_fee_balance_pct` (% p.a. deducted from return rate) and `management_fee_contribution_pct` (% deducted from each contribution) on pension/study fund holdings. Input fields in Create/Edit holding forms. Applied in both pension projection and standalone pension simulation. |
| PWA Support | `next.config.ts` + `public/sw.js` + `src/app/manifest.ts` | Installable Progressive Web App. Service worker: API routes always network-only, pages network-first with offline fallback, static assets cache-first. 192×192 and 512×512 icons via `ImageResponse`. Offline page at `/offline`. Add to home screen on mobile/desktop. |
| Options Tracking | Migration 0027 + `options_engine.py` + `GET /portfolio/options` | `call_option` / `put_option` asset types. Fields: strike_price, expiry_date, option_type, underlying_ticker, contract_multiplier, position_type (long/short). P&L vs cost basis (premium × qty × multiplier). Max loss = premium paid for long; unlimited for short (warning shown). Expiry countdown badges. Options P&L summary card on investments page. |
| AI Weekly Digest | Migration 0028 + `weekly_digest/` + worker job | Sends a styled HTML email every Friday at 18:00 UTC to investors with `weekly_digest_enabled=true`. Uses `claude-haiku-4-5-20251001` to generate a headline, performance summary, goal progress, and 1–3 actionable suggestions, all grounded in real portfolio data. Requires `ANTHROPIC_API_KEY` and SMTP config. Toggle in Settings → Email Notifications. |
| AI Portfolio Chat | `portfolio_chat/` + `POST /investors/{id}/chat` | Natural language Q&A grounded in real portfolio, risk model, and goals data. In-memory 5-turn conversation history per investor (resets on restart). Floating chat button on all dashboard pages. Replies never invent data. Requires `ANTHROPIC_API_KEY`. |
| Payday Calendar | `income_projection/distribution.py` + `GET /portfolio/income` | Monthly bar chart showing expected dividend income per calendar month. Distribution computed from ex-dividend date + payment frequency. "Next payday" banner with nearest upcoming ex-date and estimated payment. Holdings table with yield-on-value and annual income. Shown on investments page when portfolio has dividend-paying holdings. |
| SWAN Stress Test | `scenario_analysis/` + `GET /portfolio/stress-test` | Per-holding impact table added to each scenario drill-down (sorted by simulated loss, expand button for >8 holdings). Recovery timeline badge on scenario cards (e.g., "Recovered in ~6mo" for COVID, "~4.5yr" for 2008 GFC). Hypothetical scenarios marked accordingly. |
| Tax-Alpha Harvest Alerts | `tax_harvesting/` + `GET /portfolio/tax-opportunities` | Harvest candidates sorted by estimated tax saving (largest first). `holding_period_label` shows exact days + short/long-term classification. Conservative "Similar position" ETF suggestion per asset class (VTI for stocks, AGG for bonds, VNQ for REITs, VT for ETFs/funds) with brief rationale and wash-sale disclaimer. Crypto excluded (no tax-equivalent). |
| Complexity Premium | `performance_analytics/lazy_portfolio.py` + `GET /portfolio/complexity-premium` | Compares portfolio return vs a passive 60% VT / 40% AGG lazy portfolio over the same snapshot window. Reports Complexity Premium (portfolio return − lazy return), Risk-Adjusted Premium (Sharpe delta), and an honest verdict. Requires 30+ days of portfolio snapshots; returns `data_gate_passed=false` until then. Panel shown on /performance page. |
| Family Consolidated View | `family_portfolio/` + `GET /investors/{id}/family-portfolio` | Aggregates investment accounts by family_member_id across all members of the primary investor's household. Groups by generation (primary, partners, children, parents, grandparents). Education mode flagged for members with age < 18. Cross-member ticker overlap shown as concentration risk alert. Rendered as Household Portfolio card below family member list on /family page. No DB migration — uses existing family_members and investment_accounts tables. |
| Liquidity Runway Engine | `liquidity_runway/` + `GET /portfolio/liquidity-runway` | Tiers every holding: Tier 1 (stocks/ETFs/crypto — T+2), Tier 2 (bonds/funds — 1wk), Tier 3 (locked: pension, keren hishtalmut, real estate). Net-to-pocket = gross − estimated CGT (gains only) − market impact buffer (0.5% Tier 1, 0% Tier 2). Optional `target_amount` query param activates Emergency Lever: greedy selection of cheapest-to-liquidate holdings (lowest cost/gross ratio first). Shown as Liquidity Runway card on /investments page. No DB migration. |
| Resilience Stress-Test | `resilience/` + `POST /portfolio/resilience` | Life-event simulation (job loss, expense spike). Drains cash reserve (liquid_savings) → Tier 1 → Tier 2 in cost-efficiency order. Survival Score (0–100): 100 = Tier 3 never touched; <100 = Tier 3 breach required. Verdicts: Safe (≥80), At Risk (50–79), Critical (<50). Optional Claude Haiku AI recommendation (skipped if no API key). Depletion path shows month-by-month which assets are liquidated. Added to /stress-test page as ResilienceSimulatorCard. No DB migration. |
| Market Signal Monitor | `market_signals/` + migration 0030 + `GET /market-signals` + `POST /market-signals/{id}/dismiss` | Daily APScheduler job (20:15 UTC) fetches yfinance news for all held tickers, calls Claude Haiku for sentiment (−1.0 to +1.0), whale mention detection, and personalized rationale. Personal Signal Guard mutes signals with composite_score < 50 (stability) or ticker > 15% of portfolio (concentration). 7-day rolling trend (improving/deteriorating/stable). Connected insights: tax-loss harvest, rebalancing, accumulation. Idempotent via unique index on (investor_id, ticker, signal_date). MarketSignalCard on /investments page. DB migration: 0030. |
| Admin AI Cost Tracking | `ai_usage/logger.py` + `models/ai_usage_log.py` + migration 0032 + `GET /admin/ai-usage` | Logs every Claude API call (market signals + AI reports) to `ai_usage_logs` table with token counts and computed USD cost. Admin panel `/admin` shows: 4 summary cards (total cost, calls, input tokens, output tokens), per-feature table, per-user expandable rows. Period selector: 7/30/90 days. Cost rates: Haiku $0.80/$4.00 per MTok in/out; Sonnet $3.00/$15.00. |
| Daily Action Feed | `action_feed/` + `GET /investors/{id}/action-feed` | Aggregates 5 signal sources into a prioritised morning briefing (max 12 items). Priority 1 = triggered alerts / option expiry ≤7d. Priority 2 = drift ≥10% / negative signal on large position. Priority 3 = moderate drift / at-risk goal. DailyActionFeedCard on dashboard. No DB migration. |
| Pairs Trading | `pairs_trading/` + `GET /analyze` + `POST /signals` | OLS hedge ratio, ADF(0) cointegration (MacKinnon −2.87 threshold), Z-score signals (±2.0 entry, ±3.5 stop). Saves to market_signals (PAIRS_ZSCORE). `/pairs-trading` page with Z-score gauge and trade instructions. No new deps (pure numpy). |
| PDF Statement Import | `pdf_import/` + `POST /investors/{id}/pdf-import/parse|import` | pypdf text extraction + Claude Haiku parsing. Any broker PDF format. Smart truncation for large PDFs. `parse` = dry-run preview; `import` = write holdings. Dep: `pypdf>=4.0.0`. |
| Crypto Staking | `crypto_staking/` + `GET/POST/DELETE /investors/{id}/crypto-staking` | APY tracking via existing `fund_status` + `annual_return_rate` columns. No migration. Annual rewards = quantity × APY/100. Tax = income. `/crypto-staking` page. |
| IBKR REST Sync | `broker_sync/ibkr_rest.py` + `POST .../broker-sync/ibkr-rest` | Live sync from IBKR Client Portal Gateway. Asset mapping: STK/ETF/CRYPTO/BOND/OPT. `verify_ssl=false` default. Read-only. |
| K8s Hardening | `helm/tradeops/` | Non-root securityContext, NetworkPolicy (backend ← ingress+frontend; postgres ← backend only), PodDisruptionBudget, podAntiAffinity, JWT_SECRET_KEY + ALPHA_VANTAGE_API_KEY as Helm secrets. All flags default false. |
| SSE Price Streaming | `market_data/router.py` `GET /market/stream?tickers=...&interval=30` | text/event-stream. Max 20 tickers. Fresh SessionLocal per tick. nginx pass-through via X-Accel-Buffering. Frontend: pulsing LIVE dot + streaming price per holding row. |
| Live Trading (Gated) | `live_trading/` + migration 0035 | 5-gate readiness checker (paper ≥30d Sharpe>0.5, risk ack, admin toggle, order risk limits, IBKR connection). IBKR Client Portal Gateway REST client: `lookup_conid`, `submit_order`, `cancel_order`. Session lifecycle: `POST /acknowledge`, `POST /session`, `POST /halt` (kill switch). Order form with market/limit, buy/sell, qty, limit price. All actions audit-logged. Live trading is **disabled by default** — admin must set `risk_model.live_trading_allowed=True` per investor. |
| IDOR Protection | `auth/investor_access.py` + `api/v1/router.py` | `verify_investor_access` FastAPI dependency applied at `include_router` level for all 37 investor-scoped routers. Returns HTTP 404 if the requested `investor_id` does not belong to the authenticated user. Zero changes to individual endpoint handlers. |
| Login Rate Limiting | `auth/rate_limiter.py` + `auth/router.py` | Sliding-window limiter: 5 login attempts per client IP per 5-minute window. Returns HTTP 429 before credential verification. Uses Redis sorted sets when `REDIS_URL` is set (distributed, survives restarts, multi-instance safe). Falls back to in-memory when Redis is unavailable. |
| AI Monthly Budget | `ai_usage/logger.py` + `core/config.py` | `AI_MONTHLY_BUDGET_USD` env var (default 0 = unlimited). `require_ai_budget` FastAPI dependency applied to 6 expensive AI routers. Queries rolling 30-day aggregate from `ai_usage_logs`; raises HTTP 429 when cap is reached. Market signals background worker also checks per-investor budget before each Claude call. |
| Minor Account Block | `live_trading/service.py` | `submit_order()` explicitly checks `investor.is_minor` before any gate evaluation and rejects with HTTP 422. Enforces safety rule #4 at the service layer, independent of gate configuration. |
| Live Trading Gateway Validation | `live_trading/schemas.py` + `live_trading/router.py` | `gateway_url` validated on all write paths: must use `http`/`https` scheme and hostname must be `localhost` or `127.0.0.1`. Prevents SSRF via user-supplied gateway URLs. |
| Audit Event Index | Migration 0036 | `ix_audit_events_investor_profile_id` index on `audit_events` table. Required for efficient per-investor audit log queries at scale. |
| Pct Field Constraints | Migration 0036 | `CHECK` constraints: `investable_capital_pct` (0–100) on `financial_profiles`, `max_trade_size_pct` (0–100) on `risk_models`. |

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

## 15. Maintenance checklist

When making changes to the platform:

- [ ] DB schema changed → create an Alembic migration, test `upgrade` + `downgrade`
- [ ] New API endpoint → document in `docs/architecture.md`
- [ ] New frontend page → add to sidebar + help page
- [ ] Add changes to `CHANGELOG.md` under `## [Unreleased]`
- [ ] When ready to release → promote `[Unreleased]` to a dated version block and commit to `main`
- [ ] For K8s release → `git tag vX.Y.Z && git push origin vX.Y.Z` → GitHub Actions builds tagged images

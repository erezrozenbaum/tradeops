# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in TradeOps AI, please **do not open a public GitHub issue**.

Instead, email: **erez.rozenbaum@gmail.com**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested mitigations (optional)

You will receive acknowledgment within 48 hours. I aim to provide a fix or mitigation timeline within 7 days for confirmed vulnerabilities.

---

## Supported Versions

| Version | Status |
|---------|--------|
| 3.x (latest) | Actively maintained |
| 2.x | Security fixes only |
| < 2.x | Unsupported |

---

## Known CVEs — Current Status

### Next.js (frontend)

| CVE / Advisory | Severity | Description | Status |
|---|---|---|---|
| GHSA-9g9p-9gw9-jx7f | High | DoS via Image Optimizer remotePatterns misconfiguration | Mitigated — `remotePatterns` is not configured; the Image Optimizer is not exposed on a public endpoint |
| GHSA-h25m-26qc-wcjf | High | DoS via insecure React Server Components | Mitigated — RSC is not used in any route that handles untrusted external input |
| GHSA-ggv3-7p47-pfv8 | High | HTTP request smuggling in rewrites | Mitigated — no rewrites configured that accept untrusted external input |
| GHSA-3x4c-7xq6-9pq8 | Moderate | Unbounded next/image disk cache growth | Mitigated — `next/image` is not used with untrusted remote sources |
| GHSA-c4j6-fc7j-m34r | High | SSRF via WebSocket upgrades | Mitigated — WebSocket proxy is not enabled |
| GHSA-wfc6-r584-vfw7 | Moderate | Cache poisoning in RSC responses | Mitigated — no public CDN or shared cache in front of the frontend |

**Root fix**: requires Next.js 16.x upgrade (breaking change — React 19 + API changes). Planned for v4.x. This deployment is intended for local/private use; the mitigations above apply to the default single-user deployment model.

### Starlette (backend)

| CVE / Advisory | Severity | Description | Status |
|---|---|---|---|
| PYSEC-2026-161 | High | Starlette < 1.0.1 vulnerability | **Blocked by dependency conflict** — fix requires `starlette>=1.0.1` but `prometheus-fastapi-instrumentator 7.x` hard-requires `starlette<1.0.0`; no v8 exists as of 2026-05-27. Mitigation: app is intended for local/LAN deployment only, not exposed to the public internet. Tracked for resolution when upstream releases starlette 1.x support. |

### Docker base image tools (pip, wheel)

The `python:3.11-slim` base image ships `pip 24.0` and `wheel 0.45.1` which have known CVEs. These are build-time tool vulnerabilities in the Docker image layer — they are not exposed at runtime by our application. Refreshing the base image (`docker pull python:3.11-slim`) or rebuilding with `--no-cache` picks up the latest patched pip/wheel from the Python Docker Hub image.

---

## Threat Model

TradeOps AI is designed as a **self-hosted, single-user or small-team financial intelligence platform**. It is not designed as a multi-tenant SaaS product with anonymous external users.

This means:
- The primary threat is **local network exposure**, not internet-scale attacks
- The frontend and backend are not intended to be exposed on the public internet without an authenticated reverse proxy (nginx/Caddy with TLS) in front
- All investor data is scoped per user with JWT authentication + ownership enforcement
- The admin panel (`/admin`) provides an additional RBAC layer

For production internet-facing deployments, use Kubernetes (see `helm/tradeops/`) with:
- TLS termination at the ingress
- NetworkPolicy enforcing backend-only internal traffic
- Rate limiting at the ingress level

---

## Security Architecture

| Control | Implementation |
|---|---|
| Authentication | HS256 JWT, HttpOnly + SameSite=Strict cookies |
| Session revocation | Redis JTI blacklist on logout |
| Ownership enforcement | All 35+ investor routes check `investor_id == current_user.id` |
| Rate limiting | 5 login attempts / IP / 5-minute window (Redis-backed) |
| Audit logging | Every significant action in immutable `audit_events` table |
| AI cost guard | Per-investor monthly USD cap enforced before every AI call |
| Live trading gates | 5 deterministic checks; admin approval required; disabled by default |
| Input validation | Pydantic models on all API endpoints |
| SQL injection | SQLAlchemy ORM; no raw SQL string interpolation |
| Secrets | Never committed; `.env` excluded from git; generated via `deploy.ps1` / `deploy.sh` |

---

## Responsible Disclosure

This project follows a coordinated disclosure approach. Please allow reasonable time for fixes before public disclosure. Reporters who follow responsible disclosure will be credited (unless they prefer anonymity).

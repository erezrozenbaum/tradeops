# TradeOps AI — Product Roadmap

**Version:** 3.36.0  
**Last updated:** 2026-05-30

> Completed phases: v1–v3.30.0. See `CHANGELOG.md` and `execution_plan.md` for the full history.

---

## Completed (v3.x — Financial Execution Intelligence)

| Version | Feature |
|---------|---------|
| v3.13 | Staged Orders & Order Builder — pre-flight review, tax analysis, goal-linked execution |
| v3.14 | Outcome Tracking + Template Library |
| v3.15 | Morning Brief + Recurring Investment Plans (SIP) |
| v3.16 | Smart Allocation Assistant (AI + deterministic fallback) |
| v3.17 | Notification Engine + Broker Sync Dashboard + Price Alerts |
| v3.18 | SIP Recurring Plans + CSV Export + Price Alert URL fix |
| v3.19 | Goal Action Plan + Watchlist Sparklines + Stage Buy |
| v3.20 | Portfolio Comparison + Morning Brief + Goal Timeline + Bulk Orders |
| v3.21 | Paper Trading v2 — named portfolios, live P&L, promote to real order |
| v3.22 | Paper position price history chart |
| v3.23 | Next.js 16 security upgrade (9 CVEs fixed) |
| v3.24 | Trade Journal — rationale + reflection on every staged order |
| v3.25 | Decision Intelligence / DQS (0–100, four components) |
| v3.26 | Behavioral Alpha + Monthly Reflection Report |
| v3.27 | DI bug fixes — DQS consistency, price guard, executed_at filter |
| v3.28 | Active Broker Sync Warnings + Outcome Calibration Dashboard |
| v3.29 | Smart Assist v2 (DQS+patterns in prompt) + SIP Alert Triggers + Next.js SC cleanup |
| v3.30 | Behavioral Confidence Indicator (κ score in pre-flight, read-only advisory) |
| v3.31 | Portfolio Anti-Correlation Engine (Pearson r in pre-flight, sector clustering warnings) |
| v3.32 | Thesis Expiry Monitor (stop-loss / take-profit / horizon breach alerts in Morning Brief) |
| v3.33 | Redis caching for compute-heavy endpoints (DI, BA, Calibration, Reflection Report — 15/30-min TTL) |
| v3.34 | Pre-Flight Interceptor Panel — post-staging synthesis overlay combining Behavioral Shield + Correlation Shield + aggregate risk banner |
| v3.35 | Investor DNA + Capital Leakage Attribution — Edge / Risks / Recommendation profile synthesising all behavioral signals; dollar leakage per asset class |
| v3.36 | Live Ticker Correlation Preview — 300ms debounced inline indicator in the Order Builder showing HIGH_OVERLAP (amber) or HIGHLY_DIVERSIFIED (emerald) before submission; read-only, backed by local price_snapshots |

---

## Candidate Next Features

| Priority | Feature | Notes |
|----------|---------|-------|
| High | Live broker execution skeleton | IBKR Client Portal Gateway; disabled by default; requires explicit activation |
| High | Multi-currency goal progress normalization | Goals denominated in different currencies need FX-adjusted progress |
| High | Live broker execution skeleton | IBKR Client Portal Gateway; disabled by default; requires explicit activation |
| Medium | Behavioral Confidence history | Track κ scores over time per investor; trend chart on Decision Intelligence page |
| Medium | Family shared goals dashboard | Household-level goal aggregation view |
| Medium | Behavioral Confidence history | Track κ scores over time per investor; trend chart on Decision Intelligence page |
| Medium | Audit logging in Decision Intelligence / Behavioral Alpha routers | Currently missing from the three intelligence modules |
| Low | AI-generated monthly narrative email | Monthly reflection report delivered as email digest |
| Low | Test coverage for decision_intelligence, behavioral_alpha, reflection_report | Currently no unit tests for these three modules |

---

## Architectural Principles (enforced)

1. **No automated trade execution** — all orders require explicit user action
2. **Deterministic core, optional AI** — every AI feature degrades gracefully to rule-based fallback
3. **Read-only advisory** — behavioral signals inform, never auto-modify capital
4. **Safety-first UX** — pre-flight, risk engine, and behavioral indicator form three advisory layers; user retains final decision authority

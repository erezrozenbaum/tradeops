# TradeOps AI — Product Roadmap

**Version:** 3.44.2  
**Last updated:** 2026-06-05

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
| v3.37 | Investor Evolution Report — rolling 90-day vs previous 90-day behavioral tracker; DQS, documentation rate, risk overrides, behavioral alpha; strengths/concerns derivation; three gate states; no schema migration |
| v3.38 | Behavioral Confidence (κ) Trend Chart — per-order κ history extracted from pre_flight_review JSONB; threshold lines at κ=0.65 and κ=0.50; tier-colored dots; rendered on Decision Intelligence page |
| v3.39 | Override Drill-down + Behavioral Engine Test Coverage — clickable Risk Overrides card on Evolution page opens modal with override order list; 57 new unit tests for DI and Evolution pure helpers |
| v3.40 | Contextual Guidance sweep — inline ⓘ tooltips and section subtitles across Decision Intelligence, Investor Evolution, and Investor DNA pages; all technical metrics now self-explanatory |
| v3.41 | Behavioral Pattern Detection — 5 named anti-patterns auto-detected from order history (Blind Override Habit, Confidence Collapse, Override Acceleration, Documentation Decay, Thesis-Absent Execution); surfaces on Evolution + DNA pages; 27 unit tests |
| v3.42 | README Product Positioning — "Why TradeOps is different" comparison table (vs portfolio trackers, robo-advisors, trading journals, AI stock pickers); "The Demo" 8-step flow section with behavioral intelligence screenshot placeholders |
| v3.43 | Test Coverage: Behavioral Alpha + Investor DNA — 24 tests for BA service pure helpers (_alpha_dimension, _build_highlight, _detect_patterns); 39 tests for DNA service pure helpers (_build_leakage, _build_edge, _build_risks, _build_recommendation); 622 total tests |
| v3.44 | Docker NEXT_PUBLIC_API_URL fix — changed from internal `http://backend:8000` to browser-accessible `http://localhost:8000/api/v1`; added server-side `API_URL` for Next.js route handlers; fixes 7 pages that showed "Failed to fetch" |
| v3.44.1 | Catch-all API proxy route — `app/api/v1/[...path]/route.ts` forwards all unmatched Next.js requests to the backend; fixes login and all relative-URL fetches |
| v3.44.2 | NEXT_PUBLIC_API_URL routed through proxy — changed to `http://localhost:3000/api/v1` so all client-side fetches use port 3000; fixes auth cookie mismatch (Order Builder "Not authenticated", 401-triggered logouts) |

---

## Candidate Next Features

| Priority | Feature | Notes |
|----------|---------|-------|
| High | Live broker execution skeleton | IBKR Client Portal Gateway; disabled by default; requires explicit activation |
| High | Multi-currency goal progress normalization | Goals denominated in different currencies need FX-adjusted progress |
| Medium | Test coverage for decision_intelligence, behavioral_alpha, reflection_report | Currently no unit tests for the three inference modules; BA and DNA covered in v3.43 |
| Medium | Family shared goals dashboard | Household-level goal aggregation view |
| Medium | Audit logging in Decision Intelligence / Behavioral Alpha routers | Currently missing from the three intelligence modules |
| Low | AI-generated monthly narrative email | Monthly reflection report delivered as email digest |
| Low | Test coverage for decision_intelligence, behavioral_alpha, reflection_report | Currently no unit tests for these three modules |

---

## Architectural Principles (enforced)

1. **No automated trade execution** — all orders require explicit user action
2. **Deterministic core, optional AI** — every AI feature degrades gracefully to rule-based fallback
3. **Read-only advisory** — behavioral signals inform, never auto-modify capital
4. **Safety-first UX** — pre-flight, risk engine, and behavioral indicator form three advisory layers; user retains final decision authority

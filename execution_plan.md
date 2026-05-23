# TradeOps AI — Execution Plan

> Local file — not committed to git.
> Last updated: 2026-05-23

---

## Current State: v2.8.0

### Completed (v2.1 – v2.7.1)

| Version | Shipped |
|---|---|
| v2.1 | Investor Maturity Engine (4-stage, 8-dimension deterministic scoring) |
| v2.2 | Financial Twin + Health Radar (8+9 dimensions, daily snapshots, SVG radar) |
| v2.3 | Behavioral Risk Detection (7 pattern rules, APScheduler daily scan) |
| v2.4 | Extended Attribution (Behavioral Drag, FX Drag, Concentration Cost) |
| v2.5 | Simulation Engine (6 scenarios: 3 deterministic + 3 Monte Carlo) |
| v2.6 | Counterfactual Replay (3 backward-looking what-if engines) |
| v2.7 | Maturity-Aware AI Thought Partner (verbosity param, twin+behavioral context injection) |
| v2.7.1 | Security hardening: Helm KSV-0014/KSV-0118, Next.js 14.2.35, starlette/idna/urllib3 CVEs, defusedxml |

---

## In Progress: v2.8.0 — Financial Command Center

### Goal
Replace the current dashboard as the primary landing screen with a unified daily intelligence view that answers: "What should I focus on next, and why?"

### Backend tasks

- [x] `backend/app/command_center/schemas.py` — CommandCenterReport + all sub-schemas
- [x] `backend/app/command_center/action_engine.py` — ActionPrioritizer (top-3 ranked actions)
- [x] `backend/app/command_center/evolution.py` — EvolutionFeedGenerator (7-day deltas)
- [x] `backend/app/command_center/replay_selector.py` — CounterfactualSelector
- [x] `backend/app/command_center/orchestrator.py` — parallel fetch + AI summary
- [x] `backend/app/command_center/router.py` — 2 endpoints (summary + full)
- [x] Migration 0046 — command_center_checkpoints table
- [x] Register router in api/v1/router.py

### Frontend tasks

- [x] `useMaturityVariant` hook — stage-to-config mapping
- [x] `StatusHeader` — Twin score + stage + trend pills
- [x] `ActionsPanel` + `ActionCard` — maturity-adapted action cards
- [x] `EvolutionFeed` — 7-day financial delta feed
- [x] `HealthRadarCard` — recharts RadarChart, 8 axes
- [x] `TwinInsightsCard` — positive drivers + drag factors
- [x] `BehavioralRisksPanel` + `BehavioralRiskCard`
- [x] `FuturesPreviewCard` — simplified 3-path projection
- [x] `ReplayHighlightCard` — best counterfactual insight
- [x] `AIThoughtPartnerCard` — maturity-aware summary + verbosity toggle
- [x] `ProgressionCard` — stage track + unlocked features
- [x] `CommandCenterPage` — full page assembly
- [x] Sidebar updated — Command Center as primary item

---

## Roadmap: v2.9 and Beyond

### v2.9.0 — Goal-Aware Command Center
- Add goal progress section to Command Center (top 2 goals, % complete, months to target)
- Action engine incorporates goals data: "Goal X is 8 months behind schedule"
- `GoalProgressPanel` component

### v3.0.0 — Weekly Digest + Push Notifications
- Pre-computed nightly AI summary (APScheduler, cache in Redis)
- Weekly digest email (Monday 8am) using existing SMTP service
- Push notification for critical actions (emergency fund < 1 month, HIGH behavioral risk)
- `CommandCenterCheckpoint` weekly job writing delta anchors

### v3.1.0 — Longitudinal AI Memory
- AI Thought Partner gains memory of past summaries (rolling 3-month window)
- "Three months ago your emergency fund was 1.2 months; now it's 2.1 months"
- Stored in `ai_memory_entries` table, injected into context

### v3.2.0 — Partner/Household View
- Share Command Center read-only with co-owner (spouse/partner)
- Household aggregate metrics
- `household_id` on investor_profile (migration required — STRICT MODE)

### v3.3.0 — Mobile PWA Enhancements
- Bottom navigation bar for mobile (Home | Actions | Health | Report | Profile)
- Swipe-left on ActionCard to dismiss for 30 days
- Collapsible sections with user preference persistence (localStorage)

### v3.4.0 — Advisor Share
- Generate read-only link to Command Center snapshot for trusted advisor
- Token-scoped, expires in 7 days, no write access

---

## Architecture Constraints (Non-Negotiable)

- AI never overrides deterministic risk controls
- All trade execution requires 5-gate check
- Live trading disabled by default
- Every significant action audit-logged
- PostgreSQL is source of truth — Redis is cache only
- All simulations deterministic by seed
- Minors: education-only mode enforced at risk layer

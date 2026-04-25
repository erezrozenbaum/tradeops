# TradeOps AI — Execution Plan

**Version:** 0.8.0  
**Phase:** Decision Engine Hardening  
**Last updated:** 2026-04-25

---

## 1. Current State (Verified from Code)

### Backend — implemented

| Module | Status | Notes |
|--------|--------|-------|
| `investor_profiles` | ✅ DONE | CRUD; fields: full_name, date_of_birth, country, base_currency, local_currency, experience_level, is_minor |
| `financial_profiles` | ✅ DONE | Income, expenses, liquid_savings, emergency_fund_months, job_stability, income_trend, dependents_count, investable_capital_pct; assets/liabilities sub-resources |
| `family_profiles` | ✅ DONE | Family + family_members tables; CRUD |
| `goals` | ✅ DONE | Financial goals CRUD (target_amount, target_date, progress) |
| `financial_scoring` | ✅ DONE | Deterministic stability score (0–100), classification, risk_modifier, recommendations |
| `risk_modeling` | ✅ DONE | Percentage-based capital allocation; outputs: investable_capital, low_risk_pct, growth_pct, high_risk_pct, max_drawdown_pct, stability_score |
| `strategy_library` | ✅ DONE | 6 seeded templates; fields: name, strategy_type, risk_level, description, parameters |
| `strategy_selection` | ✅ DONE | AI-assisted ranking by suitability; stores strategy_recommendations |
| `backtesting` | ✅ DONE | Deterministic seeded simulation; 6 metrics; period snapshots |
| `paper_trading` | ✅ DONE | Monthly tick simulation; portfolio lifecycle |
| `ai_analysis` | ✅ DONE | Claude-powered 7-section report; stateless (not persisted) |
| `audit` | ✅ DONE | Audit events table; paginated query per investor |
| `dashboard` | ✅ DONE | Aggregated summary endpoint |
| `financial_decision` | ❌ MISSING | **Current phase target** |
| `currency_engine` | ❌ STUB | Empty `__init__.py` |
| `market_context` | ❌ STUB | Empty `__init__.py` |
| `execution` | ❌ STUB | Intentionally disabled (out of MVP scope) |
| `reporting` | ❌ STUB | Empty — AI report lives in `ai_analysis` |
| `workers` | ❌ STUB | No background jobs yet |

### Frontend — implemented

| Page | Status | Notes |
|------|--------|-------|
| `/login` | ✅ DONE | Investor selector + inline creation form; auto-opens on empty DB |
| `/dashboard` | ✅ DONE | Overview page exists |
| `/financial` | ✅ DONE | Full CRUD: create/edit financial profile, add/remove assets and liabilities |
| `/goals` | ✅ DONE | Goals page exists |
| `/family` | ✅ DONE | Family profile page exists |
| `/profile` | ✅ DONE | Investor profile detail page |
| `/risk` | ✅ DONE | Risk model view and generation |
| `/strategies` | ✅ DONE | Strategy recommendation cards |
| `/backtesting` | ✅ DONE | Run form + results panel + portfolio value chart |
| `/paper-trading` | ✅ DONE | Portfolio simulation with tick advance |
| `/reports` | ✅ DONE | AI financial report (7 sections) |
| `/audit` | ✅ DONE | Paginated audit log |
| `/settings` | ✅ DONE | Session + platform info |
| Investment Readiness card | ❌ MISSING | **Current phase target** |
| Investor profile wizard (multi-step) | ❌ MISSING | Current login has simple flat form |

### Infrastructure — implemented

- ✅ Docker Compose (PostgreSQL + backend + frontend)
- ✅ Alembic migrations (0001–0004)
- ✅ GitHub Actions CI/CD with auto-release
- ✅ `redirect_slashes=False` on FastAPI app (added v0.8.0+)

---

## 2. Gaps vs Spec

### 2.1 Investor Profile Schema — Missing Fields

The current `investor_profiles` table is missing fields required by spec §8:

| Spec Field | Status | Priority |
|-----------|--------|----------|
| `investment_goal` (enum) | ❌ Missing | High — decision engine input |
| `risk_tolerance` (enum: very_low…very_high) | ❌ Missing | High — decision engine input |
| `time_horizon` (short/medium/long_term) | ❌ Missing | High — decision engine input |
| `preferred_assets` (JSONB list) | ❌ Missing | Medium |
| `trading_frequency` (none/low/medium/high) | ❌ Missing | Medium |
| `capital_amount` | ❌ Missing | Medium — exists in financial_profile as derived value |
| `monthly_contribution` | ❌ Missing | Low |
| `guardian_required` | ❌ Missing | Medium — currently only `is_minor` flag |
| `investment_knowledge_score` | ❌ Missing | Low |
| `max_drawdown_comfort` | ❌ Missing | Low |

### 2.2 Risk Model Output — Missing Enforcement Fields

The current risk model outputs capital allocation percentages. The spec (§10) also requires:

| Spec Field | Status |
|-----------|--------|
| `allowed_strategy_families` | ❌ Missing |
| `blocked_strategy_families` | ❌ Missing |
| `live_trading_allowed` | ❌ Missing |
| `requires_paper_trading` | ❌ Missing |
| `minimum_paper_days` / `minimum_paper_trades` | ❌ Missing |
| `max_trade_size_percent` | ❌ Missing |
| `max_open_positions` | ❌ Missing |

### 2.3 Age-Based Safety Rules (Spec §9)

Only `is_minor` (bool) exists. No:
- Age tier classification (under 18, 18–25, 26–45, 46–60, 60+)
- `guardian_required` field
- Age-based strategy restriction logic in the risk model engine

### 2.4 Strategy Template Schema — Missing Fields

Current templates have: name, strategy_type, risk_level, description, parameters.  
Spec §13 also requires: `family`, `parameter_schema`, `min_experience_level`, `supported_assets`, `live_trading_supported`.

### 2.5 Backtest Validation Pass/Fail

The backtesting engine computes 6 metrics but does not enforce pass/fail rules against the investor's risk model (spec §18). No `backtest_passed`/`backtest_failed` lifecycle status.

### 2.6 Investor Profile Wizard

Current login form captures: full_name, date_of_birth, country, base_currency, local_currency, experience_level, is_minor. The multi-step wizard (spec §25) with goals, risk comfort, asset preferences is not implemented.

### 2.7 Financial Decision Engine

Entirely absent. The `/api/v1/investors/{id}/decision` endpoint does not exist.

---

## 3. Immediate Infrastructure Fix Required

**Blocker:** Routes registered as `@router.get("/")` are 404 with `redirect_slashes=False`.  
All collection endpoint decorators must use `""` instead of `"/"`.

This must be done before any other feature work.

---

## 4. Phase Tasks — Decision Engine Hardening

Tasks are ordered by dependency. Each task is independently deployable.

---

### TASK 0 — Fix routing (BLOCKER) ✅ DONE

**Type:** Bug fix  
**Risk:** 🟢 Safe  

Changed all `@router.get("/")`, `@router.post("/")` etc. to `@router.get("")`, `@router.post("")` across all router files. `redirect_slashes=False` is set on the app — fix is complete.

Files changed:
- `investor_profiles/router.py` ✅
- `goals/router.py` ✅
- `risk_modeling/router.py` ✅
- `strategy_library/router.py` ✅
- `strategy_selection/router.py` ✅
- `backtesting/router.py` ✅
- `paper_trading/router.py` ✅
- `ai_analysis/router.py` ✅
- `family_profiles/router.py` ✅

Not changed (no collection routes):
- `financial_profiles/router.py` — all routes use `/{investor_id}/...` path params
- `audit/router.py` — uses `/{investor_id}/audit-events`
- `dashboard/router.py` — uses `/{investor_id}/dashboard`

---

### TASK 1 — Add missing investor profile fields

**Type:** DB schema change  
**Risk:** 🔴 Risky — requires Alembic migration  

Add to `investor_profiles` table:

```python
investment_goal: Mapped[str | None]      # nullable for backward compat
risk_tolerance: Mapped[str | None]       # very_low | low | medium | high | very_high
time_horizon: Mapped[str | None]         # short_term | medium_term | long_term
preferred_assets: Mapped[list | None]    # JSONB
trading_frequency: Mapped[str | None]    # none | low | medium | high
guardian_required: Mapped[bool]          # default False
```

All new fields nullable or with defaults — existing rows must not break.

Migration: `0005_investor_profile_extended.py`

Update: `schemas/investor_profile.py`, `investor_profiles/router.py`

---

### TASK 2 — Add age-based safety rules to risk model engine

**Type:** Logic change  
**Risk:** 🟡 Moderate  

In `risk_modeling/service.py` (or a dedicated helper):

- Derive investor age from `date_of_birth`
- Apply age-tier rules:
  - Under 18: force `is_minor=True`, `guardian_required=True`, restrict to education strategies
  - 60+: bias toward capital preservation, reduce growth/high-risk allocation
- These rules must override user-stated risk_tolerance

No DB change required. Output is computed, not stored.

---

### TASK 3 — Enrich risk model with enforcement fields

**Type:** Schema change + logic  
**Risk:** 🟡 Moderate  

Add to `risk_models` table:

```python
allowed_strategy_families: Mapped[list]   # JSONB
blocked_strategy_families: Mapped[list]   # JSONB
live_trading_allowed: Mapped[bool]        # default False
requires_paper_trading: Mapped[bool]      # default True
max_trade_size_pct: Mapped[float]
max_open_positions: Mapped[int]
```

Migration: `0006_risk_model_enforcement_fields.py`

Update `risk_modeling/service.py` to populate these based on stability score, age tier, and experience level.

Update `schemas/risk_model.py` to expose these fields in API responses.

---

### TASK 4 — Build `financial_decision` module (core of this phase)

**Type:** New module  
**Risk:** 🟡 Moderate  

Create `backend/app/financial_decision/`:

```
financial_decision/
├── __init__.py
├── engine.py      # deterministic decision logic
├── service.py     # data aggregation
└── router.py      # GET /investors/{id}/decision
```

**engine.py** — pure function, no DB access:

```python
def evaluate(
    investor: InvestorProfile,
    financial_profile: FinancialProfile | None,
    stability: FinancialStabilityScore | None,
    risk_model: RiskModel | None,
    goals: list[FinancialGoal],
    family_context: FamilyProfile | None,
) -> InvestmentDecision
```

Decision output:

```json
{
  "can_invest": true,
  "readiness_classification": "ready_with_limits | not_ready | education_only | ready",
  "recommended_investment_pct": 35,
  "max_high_risk_pct": 5,
  "blocked_actions": ["live_trading", "high_risk_strategy"],
  "required_actions": ["maintain_emergency_fund"],
  "warnings": ["High debt ratio detected"],
  "explanation": "..."
}
```

Decision rules (deterministic):
- `can_invest = False` if: no financial profile, stability < 30, emergency_fund_months < 1
- `can_invest = True` but `readiness_classification = "ready_with_limits"` if: stability 30–60, debt-to-income > 40%, emergency_fund_months < 3
- `education_only` if: is_minor or investment_goal == "education"
- `blocked_actions` populated from risk model blocked_strategy_families + live_trading_allowed
- `required_actions` populated from scoring recommendations

**service.py** — assembles all data and calls engine.

**router.py** — stateless GET, returns computed decision (not persisted):

```
GET /api/v1/investors/{id}/decision
```

Register in `api/v1/router.py` as:

```python
api_router.include_router(decision_router, prefix="/investors/{investor_id}/decision", tags=["decision"])
```

Add audit event: `decision_evaluated`.

---

### TASK 5 — Investment Readiness card on dashboard

**Type:** Frontend  
**Risk:** 🟢 Safe  

In `frontend/src/app/(dashboard)/dashboard/page.tsx`:

Add a card fetching `GET /api/v1/investors/{id}/decision` that shows:

- Readiness badge: `Ready` (green) / `Ready with limits` (amber) / `Not ready` (red) / `Education only` (blue)
- Recommended investable capital %
- Required actions list (if any)
- Blocked actions list (if any)
- Warning messages

Empty state: if financial profile is missing, prompt to complete it.

---

### TASK 6 — Update investor profile creation/edit with new fields

**Type:** Frontend  
**Risk:** 🟢 Safe (depends on TASK 1)  

After TASK 1 lands:

Update the login creation form and `/profile` edit page to include:
- `investment_goal` (select)
- `risk_tolerance` (select)
- `time_horizon` (select)
- `preferred_assets` (multi-select or checkboxes)
- `trading_frequency` (select)

These fields are nullable — existing profiles work without them. The decision engine uses them if present, falls back to defaults if absent.

---

### TASK 7 — Add tests for financial_decision engine

**Type:** Tests  
**Risk:** 🟢 Safe  

Add `backend/tests/test_financial_decision.py`:

Required test cases:
1. Investor with no financial profile → `can_invest = False`
2. Investor with stability < 30 → `can_invest = False`, `required_actions` includes fund/debt action
3. Minor investor → `readiness_classification = "education_only"`
4. Stable investor with good metrics → `can_invest = True`, `readiness_classification = "ready"`
5. Moderate stability with high debt → `readiness_classification = "ready_with_limits"`
6. Investor with goal = education → `readiness_classification = "education_only"`

---

## 5. Task Order and Dependencies

```
TASK 0 (routing fix)   → unblocks all API testing
TASK 1 (schema)        → unblocks TASK 4 (partial) and TASK 6
TASK 2 (age rules)     → unblocks TASK 3
TASK 3 (risk fields)   → unblocks TASK 4 (full)
TASK 4 (decision engine) → unblocks TASK 5 and TASK 7
TASK 5 (dashboard card) → depends on TASK 4
TASK 6 (profile fields UI) → depends on TASK 1
TASK 7 (tests)         → depends on TASK 4
```

Recommended execution order: **~~0~~(done) → 1 → 2 → 3 → 4 → 7 → 5 → 6**

---

## 6. Out of Scope for This Phase

The following are documented but explicitly deferred:

- Live trading execution engine
- Exchange connectors / broker API
- Real market data / candle import
- Multi-currency normalization engine
- Strategy parameter schema enforcement
- Backtest pass/fail lifecycle status
- Investor profile multi-step wizard redesign
- Family financial aggregation across members
- Workers / background job processing
- Kubernetes / production deployment

These belong to a future phase after Decision Engine Hardening is complete and validated.

---

## 7. Maintenance Checklist (per task)

For each task:
- [ ] DB schema change → create Alembic migration and test `upgrade` + `downgrade`
- [ ] New API endpoint → update `docs/architecture.md` API table
- [ ] New frontend page or card → update frontend structure in `docs/architecture.md`
- [ ] Add entry to `CHANGELOG.md` under `## [Unreleased]`
- [ ] New logic module → add unit tests

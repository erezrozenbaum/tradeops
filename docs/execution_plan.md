# TradeOps AI — Execution Plan

**Version:** 0.12.0
**Last updated:** 2026-04-27

---

## Phase 1: Decision Engine Hardening — COMPLETE ✅

All tasks (TASK 0–7) are done. See git history for details.

Summary of what was built:
- Routing fix (`redirect_slashes=False` across all routers)
- Investor profile extended fields (migration 0005)
- Age-based safety rules in risk model
- Risk model enforcement fields (migration 0006)
- `financial_decision` module — investment readiness engine
- Investment Readiness card on dashboard
- Investor profile creation/edit with new preference fields
- 14 unit tests for financial decision engine (122 total passing)

---

## Phase 2: Portfolio & Market Intelligence

**Goal:** Bridge the gap between the financial decision engine and real investing intelligence.

**Version target:** 0.12.0 (TASK 8–10), 0.13.0+ (TASK 11–12)

**Framing:** This is NOT live trading. It is Portfolio & Market Intelligence — tracking existing investments, computing portfolio health, and scanning markets for context.

---

### TASK 8 — Holdings module (manual investment tracking) ✅ DONE

**Type:** New module + DB schema  
**Risk:** 🔴 Risky — Alembic migration (0007)

**New tables:**
- `investment_accounts` — provider, account type, currency, investor_id
- `investment_holdings` — ticker, ISIN, name, asset type, quantity, avg buy price, currency, fees, purchase date, current value (manual until market data)

**API endpoints:**
```
GET/POST   /api/v1/investors/{id}/accounts
GET/PUT/DELETE /api/v1/investors/{id}/accounts/{account_id}
GET/POST   /api/v1/investors/{id}/accounts/{account_id}/holdings
PUT/DELETE /api/v1/investors/{id}/accounts/{account_id}/holdings/{holding_id}
```

**Account types:** pension, keren_hishtalmut, brokerage, crypto, etf_fund, bank, other  
**Holding asset types:** stock, bond, etf, crypto, fund, real_estate, other

**Frontend:** `/investments` page — account cards, holdings tables, add/edit/delete forms

---

### TASK 9 — Currency engine (FX rates + conversion) ✅ DONE

**Type:** New module + DB schema  
**Risk:** 🔴 Risky — Alembic migration (0008)

**New table:** `currency_rates` — base, target, rate, fetched_at  
**Data source:** `open.er-api.com` (free, no API key, 1500 req/month)  
**Cache TTL:** 24 hours — fetches all rates for a base currency at once

**API:** Internal use only — no public endpoint. Called by portfolio_analysis service.

**Key function:** `convert(amount, from_currency, to_currency, db) → float`

---

### TASK 10 — Portfolio analysis (P&L, allocation, exposure) ✅ DONE

**Type:** New module  
**Risk:** 🟡 Moderate

**Endpoint:** `GET /api/v1/investors/{id}/portfolio`

**Engine inputs:** accounts + holdings + investor base_currency + FX rates  
**Engine outputs:**
```json
{
  "total_cost_basis": 120000,
  "total_current_value": 135000,
  "unrealized_pnl": 15000,
  "unrealized_pnl_pct": 12.5,
  "currency": "ILS",
  "asset_allocation": {"etf": 45.0, "stock": 30.0, "crypto": 25.0},
  "currency_exposure": {"ILS": 40.0, "USD": 50.0, "EUR": 10.0},
  "accounts": [...],
  "holdings": [...]
}
```

Current value logic: uses manually entered `current_value` if set; falls back to `quantity × avg_buy_price` (cost basis).

**Frontend:** Portfolio summary card on investments page + widget on dashboard.

---

### TASK 11 — Market data integration (DEFERRED — pending data source decision)

**Type:** New module  
**Risk:** 🔴 Risky  
**Status:** ❌ DEFERRED

**Planned data source:** Alpha Vantage / Polygon.io (free tier)  
**Scope:**
- On-demand price fetch per holding (not real-time streaming)
- Store in `price_snapshots` table with TTL
- Refresh portfolio current values automatically
- Display live price vs avg buy price delta

**Blocker:** TASE (Tel Aviv Stock Exchange) data availability on free tiers must be confirmed before implementation.

---

### TASK 12 — Market scanner (DEFERRED)

**Type:** New module  
**Risk:** 🟡 Moderate  
**Status:** ❌ DEFERRED

**Scope:**
- Scan ETFs, stocks, crypto filtered by: investor country, base currency, risk model, decision result, goals, time horizon, preferred assets, existing portfolio exposure
- Output: ranked suggestion list with rationale — not guaranteed returns
- Requires TASK 11 (market data) to be complete first

---

## 3. Phase 2 Build Order

```
TASK 8 (holdings)          → manual entry works without market data
TASK 9 (currency engine)   → required for accurate multi-currency math
TASK 10 (portfolio analysis) → depends on TASK 8 + 9
TASK 11 (market data)      → deferred; unblocks live price refresh
TASK 12 (market scanner)   → deferred; depends on TASK 11
```

---

## 4. DB Migration Map

| Migration | Description |
|-----------|-------------|
| 0001 | Initial schema |
| 0002 | Strategy templates + seed |
| 0003 | Paper trading tables |
| 0004 | Audit events table |
| 0005 | Investor profile extended fields |
| 0006 | Risk model enforcement fields |
| 0007 | investment_accounts + investment_holdings |
| 0008 | currency_rates |

---

## 5. Out of Scope (explicit deferral)

- Broker API integration (IBKR, eToro, Meitav) — much larger lift
- PDF / CSV statement import
- Real-time price streaming (daily-close polling sufficient for MVP)
- Tax engine
- Live trading execution
- Workers / background job processing
- Kubernetes / production deployment

---

## 6. Maintenance Checklist (per task)

For each task:
- [ ] DB schema change → create Alembic migration, test upgrade + downgrade
- [ ] New API endpoint → update `docs/architecture.md` API table
- [ ] New frontend page or card → update frontend structure in `docs/architecture.md`
- [ ] Add entry to `CHANGELOG.md` under `## [Unreleased]`
- [ ] New logic module → add unit tests

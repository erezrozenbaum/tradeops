# TradeOps AI — Database Schema Reference

**Version:** 0.66.0  
**Last updated:** 2026-05-15  
**Migration head:** 0029 (no new migrations in v0.66.0)

All tables use PostgreSQL. Primary keys are UUID v4. Foreign keys cascade-delete unless noted.

---

## Table of contents

1. [users](#1-users)
2. [investor_profiles](#2-investor_profiles)
3. [family_profiles](#3-family_profiles)
4. [family_members](#4-family_members)
5. [financial_profiles](#5-financial_profiles)
6. [financial_assets](#6-financial_assets)
7. [financial_liabilities](#7-financial_liabilities)
8. [financial_goals](#8-financial_goals)
9. [goal_progress_logs](#9-goal_progress_logs)
10. [risk_models](#10-risk_models)
11. [strategy_templates](#11-strategy_templates)
12. [strategy_recommendations](#12-strategy_recommendations)
13. [investment_accounts](#13-investment_accounts)
14. [investment_holdings](#14-investment_holdings)
15. [holding_transactions](#15-holding_transactions)
16. [currency_rates](#16-currency_rates)
17. [price_snapshots](#17-price_snapshots)
18. [portfolio_snapshots](#18-portfolio_snapshots)
19. [price_alerts](#19-price_alerts)
20. [watchlist_items](#20-watchlist_items)
21. [audit_events](#21-audit_events)
22. [backtest_runs](#22-backtest_runs)
23. [backtest_periods](#23-backtest_periods)
24. [paper_portfolios](#24-paper_portfolios)
25. [paper_ticks](#25-paper_ticks)
26. [Relationships diagram](#26-relationships-diagram)
27. [Migration history](#27-migration-history)

---

## 1. users

Auth table. Managed by the auth module. Investor profiles may optionally link to a user.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid4 | PK |
| email | VARCHAR(255) | NO | — | UNIQUE, indexed |
| password_hash | VARCHAR(255) | NO | — | bcrypt |
| role | VARCHAR(20) | NO | `'user'` | `'user'` \| `'admin'` |
| created_at | TIMESTAMPTZ | NO | `now()` | |

---

## 2. investor_profiles

Core entity. Every financial module links back here.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid4 | PK |
| user_id | UUID | YES | — | FK → users (SET NULL on delete) |
| full_name | VARCHAR(255) | NO | — | |
| date_of_birth | DATE | NO | — | Used to derive age, minor status |
| country | VARCHAR(3) | NO | — | ISO 3166-1 alpha-2/3 |
| nationality | VARCHAR(100) | YES | — | |
| tax_residency | VARCHAR(100) | YES | — | |
| base_currency | VARCHAR(3) | NO | — | ISO 4217; all portfolio values normalised here |
| local_currency | VARCHAR(3) | NO | — | Display currency |
| experience_level | ENUM | NO | `'beginner'` | `beginner` \| `intermediate` \| `advanced` |
| is_minor | BOOLEAN | NO | `false` | If true: education-only mode enforced |
| investment_goal | VARCHAR(50) | YES | — | Free-text or code |
| risk_tolerance | VARCHAR(20) | YES | — | `very_low` … `very_high` |
| time_horizon | VARCHAR(20) | YES | — | `short_term` \| `medium_term` \| `long_term` |
| preferred_assets | JSONB | YES | — | `string[]` |
| trading_frequency | VARCHAR(10) | YES | — | `none` \| `low` \| `medium` \| `high` |
| guardian_required | BOOLEAN | NO | `false` | |
| alert_email | VARCHAR(255) | YES | — | Destination for all alert emails |
| email_alerts_enabled | BOOLEAN | NO | `false` | Daily alert digest opt-in |
| weekly_digest_enabled | BOOLEAN | NO | `false` | Friday AI digest opt-in (migration 0028) |
| created_at | TIMESTAMPTZ | NO | `now()` | |
| updated_at | TIMESTAMPTZ | NO | `now()` | auto-updated |

---

## 3. family_profiles

Household grouping. A family has one primary investor and N members.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid4 | PK |
| name | VARCHAR(255) | NO | — | e.g. "The Rozenbaum Family" |
| primary_investor_id | UUID | NO | — | FK → investor_profiles |
| base_currency | VARCHAR(3) | NO | — | Household reporting currency |
| created_at | TIMESTAMPTZ | NO | `now()` | |
| updated_at | TIMESTAMPTZ | NO | `now()` | |

---

## 4. family_members

Bridge: links investors to a family profile. Non-investor members (children, etc.) have no investor_profile_id.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid4 | PK |
| family_profile_id | UUID | NO | — | FK → family_profiles (CASCADE) |
| investor_profile_id | UUID | YES | — | FK → investor_profiles (nullable) |
| name | VARCHAR(255) | NO | — | |
| relationship_type | VARCHAR(50) | NO | — | e.g. `spouse`, `child`, `parent` |
| age | INTEGER | YES | — | |
| is_primary | BOOLEAN | NO | `false` | |
| individual_risk_tolerance | ENUM | YES | — | `conservative` \| `moderate` \| `aggressive` |

---

## 5. financial_profiles

One-to-one with investor_profile. Income, expenses, savings, employment.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid4 | PK |
| investor_profile_id | UUID | NO | — | FK → investor_profiles (UNIQUE) |
| monthly_income | FLOAT | NO | `0.0` | |
| monthly_expenses | FLOAT | NO | `0.0` | |
| liquid_savings | FLOAT | NO | `0.0` | |
| emergency_fund_months | FLOAT | NO | `0.0` | |
| job_stability | ENUM | NO | `'stable'` | `stable` \| `freelance` \| `unstable` \| `unemployed` |
| income_trend | ENUM | NO | `'stable'` | `growing` \| `stable` \| `declining` |
| dependents_count | INTEGER | NO | `0` | |
| investable_capital_pct | FLOAT | NO | `20.0` | % of liquid savings available for investing |
| spouse_income | FLOAT | YES | — | |
| currency | VARCHAR(3) | NO | — | |
| created_at | TIMESTAMPTZ | NO | `now()` | |
| updated_at | TIMESTAMPTZ | NO | `now()` | |

---

## 6. financial_assets

Assets declared under a financial_profile (house, car, cash — not investment holdings).

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid4 | PK |
| financial_profile_id | UUID | NO | — | FK → financial_profiles (CASCADE) |
| name | VARCHAR(255) | NO | — | |
| asset_type | ENUM | NO | — | `cash` \| `stocks` \| `bonds` \| `etf` \| `real_estate` \| `crypto` \| `pension` \| `vehicle` \| `other` |
| current_value | FLOAT | NO | — | |
| currency | VARCHAR(3) | NO | — | |
| market | VARCHAR(50) | YES | — | |
| is_liquid | BOOLEAN | NO | `true` | |
| notes | TEXT | YES | — | |
| created_at | TIMESTAMPTZ | NO | `now()` | |
| updated_at | TIMESTAMPTZ | NO | `now()` | |

---

## 7. financial_liabilities

Debts declared under a financial_profile.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid4 | PK |
| financial_profile_id | UUID | NO | — | FK → financial_profiles (CASCADE) |
| name | VARCHAR(255) | NO | — | |
| liability_type | ENUM | NO | — | `mortgage` \| `car_loan` \| `personal_loan` \| `credit_card` \| `student_loan` \| `other` |
| outstanding_balance | FLOAT | NO | — | |
| monthly_payment | FLOAT | NO | `0.0` | |
| interest_rate_pct | FLOAT | YES | — | |
| currency | VARCHAR(3) | NO | — | |
| notes | TEXT | YES | — | |
| created_at | TIMESTAMPTZ | NO | `now()` | |
| updated_at | TIMESTAMPTZ | NO | `now()` | |

---

## 8. financial_goals

Investor financial targets with progress tracking.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid4 | PK |
| investor_profile_id | UUID | NO | — | FK → investor_profiles (CASCADE) |
| name | VARCHAR(255) | NO | — | |
| goal_type | ENUM | NO | — | `emergency_fund` \| `house_purchase` \| `retirement` \| `child_education` \| `debt_reduction` \| `wealth_growth` \| `passive_income` \| `custom` |
| target_amount | FLOAT | NO | — | |
| current_amount | FLOAT | NO | `0.0` | |
| target_date | DATE | YES | — | |
| priority | INTEGER | NO | `1` | Lower = higher priority |
| currency | VARCHAR(3) | NO | — | |
| risk_suitability | ENUM | NO | `'low'` | `low` \| `medium` \| `high` |
| tracking_mode | VARCHAR(50) | NO | `'target_by_date'` | `target_by_date` \| `passive_income` \| `linked_account` |
| mode_config | JSONB | YES | — | Mode-specific parameters |
| linked_account_id | UUID | YES | — | FK → investment_accounts (SET NULL) |
| created_at | TIMESTAMPTZ | NO | `now()` | |
| updated_at | TIMESTAMPTZ | NO | `now()` | |

**Computed:** `progress_pct = min(current_amount / target_amount × 100, 100)`

---

## 9. goal_progress_logs

Monthly progress snapshots per goal.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid4 | PK |
| goal_id | UUID | NO | — | FK → financial_goals (CASCADE) |
| period_year | INTEGER | NO | — | |
| period_month | INTEGER | NO | — | 1–12 |
| planned_amount | FLOAT | NO | `0.0` | |
| actual_amount | FLOAT | NO | `0.0` | |
| notes | TEXT | YES | — | |
| created_at | TIMESTAMPTZ | NO | `now()` | |

**Unique constraint:** `(goal_id, period_year, period_month)`

---

## 10. risk_models

Generated risk allocation model. Multiple per investor (latest is authoritative).

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid4 | PK |
| investor_profile_id | UUID | NO | — | FK → investor_profiles (CASCADE) |
| stability_score | INTEGER | NO | — | 0–100 |
| stability_classification | VARCHAR(20) | NO | — | `unstable` \| `fragile` \| `stable` \| `strong` |
| age_tier | VARCHAR(20) | NO | `'adult'` | `youth` \| `adult` \| `senior` |
| total_net_worth | FLOAT | NO | — | base currency |
| liquid_capital | FLOAT | NO | — | base currency |
| investable_capital | FLOAT | NO | — | base currency |
| low_risk_pct | FLOAT | NO | `0.0` | % of investable capital |
| growth_pct | FLOAT | NO | `0.0` | |
| high_risk_pct | FLOAT | NO | `0.0` | |
| max_drawdown_pct | FLOAT | NO | `10.0` | |
| currency | VARCHAR(3) | NO | — | |
| allowed_strategy_families | JSONB | NO | `[]` | |
| blocked_strategy_families | JSONB | NO | `[]` | |
| live_trading_allowed | BOOLEAN | NO | `false` | Always false in MVP |
| requires_paper_trading | BOOLEAN | NO | `true` | |
| max_trade_size_pct | FLOAT | NO | `2.0` | |
| max_open_positions | INTEGER | NO | `3` | |
| generated_at | TIMESTAMPTZ | NO | `now()` | |

---

## 11. strategy_templates

Seeded, admin-managed strategy definitions.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid4 | PK |
| name | VARCHAR(255) | NO | — | |
| description | TEXT | NO | — | |
| strategy_type | ENUM | NO | — | `foundation_building` \| `conservative` \| `balanced` \| `growth` \| `speculative` \| `education_only` |
| asset_classes | TEXT[] | NO | — | |
| markets | TEXT[] | NO | — | |
| min_stability_score | INTEGER | NO | `0` | |
| allowed_risk_modifiers | TEXT[] | NO | — | |
| min_experience_level | VARCHAR(20) | NO | `'beginner'` | |
| suitable_for_minors | BOOLEAN | NO | `false` | |
| min_investable_capital | FLOAT | NO | `0.0` | |
| time_horizon_min_months | INTEGER | NO | `0` | |
| is_active | BOOLEAN | NO | `true` | |
| created_at | TIMESTAMPTZ | NO | `now()` | |
| updated_at | TIMESTAMPTZ | NO | `now()` | |

---

## 12. strategy_recommendations

Generated per investor+risk_model pair.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid4 | PK |
| investor_profile_id | UUID | NO | — | FK → investor_profiles (CASCADE) |
| risk_model_id | UUID | NO | — | FK → risk_models |
| strategy_template_id | UUID | NO | — | FK → strategy_templates |
| fit_score | FLOAT | NO | — | 0.0–1.0 |
| notes | TEXT | NO | — | AI or rule-based explanation |
| generated_at | TIMESTAMPTZ | NO | `now()` | |

---

## 13. investment_accounts

Brokerage / pension / bank accounts belonging to an investor.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid4 | PK |
| investor_id | UUID | NO | — | FK → investor_profiles (CASCADE) |
| provider_name | VARCHAR(100) | NO | — | e.g. "IBKR", "eToro" |
| account_type | VARCHAR(50) | NO | — | `pension` \| `keren_hishtalmut` \| `brokerage` \| `crypto` \| `etf_fund` \| `bank` \| `other` |
| account_name | VARCHAR(200) | YES | — | Display label |
| currency | VARCHAR(3) | NO | — | Account native currency |
| notes | TEXT | YES | — | |
| is_emergency_fund | BOOLEAN | NO | `false` | |
| auto_sync_enabled | BOOLEAN | NO | `false` | Broker auto-sync (TASK 57) |
| last_synced_at | TIMESTAMPTZ | YES | — | Last successful sync |
| sync_broker_type | VARCHAR(50) | YES | — | `ibkr` \| `etoro` \| `altshuler` \| `altrade` |
| family_member_id | UUID | YES | — | FK → family_members (SET NULL) |
| created_at | TIMESTAMPTZ | NO | `now()` | |
| updated_at | TIMESTAMPTZ | NO | `now()` | |

---

## 14. investment_holdings

Individual positions within an investment account.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid4 | PK |
| account_id | UUID | NO | — | FK → investment_accounts (CASCADE) |
| ticker | VARCHAR(20) | YES | — | Exchange ticker, used for live price fetch |
| isin | VARCHAR(20) | YES | — | |
| name | VARCHAR(200) | NO | — | Display name |
| asset_type | VARCHAR(50) | NO | — | See enum below |
| quantity | FLOAT | NO | — | Units held |
| avg_buy_price | FLOAT | NO | — | Per unit, in `currency` |
| currency | VARCHAR(3) | NO | — | Asset's native currency |
| fees | FLOAT | NO | `0.0` | Total purchase fees |
| purchase_date | DATE | YES | — | |
| current_value | FLOAT | YES | — | Manual override; auto-computed from live price otherwise |
| notes | TEXT | YES | — | |
| **Savings fund fields** | | | | `pension_fund` and `study_fund` types |
| current_balance | FLOAT | YES | — | Current fund balance |
| total_deposits | FLOAT | YES | — | Cumulative deposits |
| monthly_contribution | FLOAT | YES | — | Monthly deposit |
| annual_return_rate | FLOAT | YES | — | % p.a. before fees |
| monthly_contribution_employee | FLOAT | YES | — | Study fund: employee portion |
| monthly_contribution_employer | FLOAT | YES | — | Study fund: employer portion |
| fund_status | VARCHAR(20) | YES | — | `active` \| `inactive` |
| is_emergency_fund | BOOLEAN | NO | `false` | |
| management_fee_balance_pct | FLOAT | YES | — | Fee on balance % p.a. (migration 0026) |
| management_fee_contribution_pct | FLOAT | YES | — | Fee on each contribution % (migration 0026) |
| **Options fields** | | | | `call_option` and `put_option` types (migration 0027) |
| strike_price | FLOAT | YES | — | |
| expiry_date | DATE | YES | — | |
| option_type | VARCHAR(10) | YES | — | `call` \| `put` |
| underlying_ticker | VARCHAR(20) | YES | — | |
| contract_multiplier | FLOAT | YES | — | Default 100 if null |
| position_type | VARCHAR(10) | YES | — | `long` \| `short` |
| purchase_fx_rate | FLOAT | YES | — | FX rate (base → holding.currency) at purchase time; auto-set on holding create (migration 0029) |
| created_at | TIMESTAMPTZ | NO | `now()` | |
| updated_at | TIMESTAMPTZ | NO | `now()` | |

**`asset_type` valid values:** `stock`, `bond`, `etf`, `crypto`, `fund`, `pension_fund`, `study_fund`, `real_estate`, `call_option`, `put_option`, `other`

---

## 15. holding_transactions

Immutable transaction log for holdings (buy/sell/dividend/fee/split/bonus).

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid4 | PK |
| investor_id | UUID | NO | — | FK → investor_profiles (CASCADE), indexed |
| account_id | UUID | NO | — | FK → investment_accounts (CASCADE), indexed |
| holding_id | UUID | YES | — | FK → investment_holdings (SET NULL) |
| transaction_type | VARCHAR(20) | NO | — | `buy` \| `sell` \| `dividend` \| `fee` \| `split` \| `bonus` |
| ticker | VARCHAR(20) | YES | — | indexed |
| asset_name | VARCHAR(200) | YES | — | |
| quantity | FLOAT | YES | — | Null for fee/dividend |
| price_per_unit | FLOAT | YES | — | Null for fee/dividend |
| total_amount | FLOAT | NO | — | In `currency` |
| fees | FLOAT | NO | `0.0` | |
| currency | VARCHAR(10) | NO | — | |
| transaction_date | DATE | NO | — | indexed |
| notes | TEXT | YES | — | |
| created_at | TIMESTAMPTZ | NO | `now()` | |

---

## 16. currency_rates

Live FX cache. One row per (base, target) pair, upserted on each fetch. **No historical rows.**

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid4 | PK |
| base_currency | VARCHAR(10) | NO | — | e.g. `ILS` |
| target_currency | VARCHAR(10) | NO | — | e.g. `USD` |
| rate | FLOAT | NO | — | base → target multiplier |
| fetched_at | TIMESTAMPTZ | NO | `now()` | Cache TTL: 4 hours |

**Source:** `open.er-api.com/v6/latest/{base}` (free tier, ~1500 req/month)

---

## 17. price_snapshots

Latest live market price per ticker. Used by portfolio value calculations.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid4 | PK |
| ticker | VARCHAR(20) | NO | — | indexed |
| price | FLOAT | NO | — | |
| currency | VARCHAR(10) | NO | — | |
| fetched_at | TIMESTAMPTZ | NO | `now()` | |

**Source:** Alpha Vantage (25 calls/day on free tier); fallback to Yahoo Finance via httpx.

---

## 18. portfolio_snapshots

End-of-day portfolio state. Drives the historical chart and performance analytics.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid4 | PK |
| investor_id | UUID | NO | — | FK → investor_profiles (CASCADE), indexed |
| total_value | FLOAT | NO | — | base currency |
| cost_basis | FLOAT | NO | — | base currency |
| unrealized_pnl | FLOAT | NO | — | |
| unrealized_pnl_pct | FLOAT | NO | — | |
| currency | VARCHAR(10) | NO | — | |
| asset_allocation | JSONB | NO | `{}` | `{asset_type: pct}` |
| snapshot_at | TIMESTAMPTZ | NO | `now()` | indexed |

**Written by:** `snapshot_writer` worker daily at 21:00 UTC, and on-demand after `/portfolio/refresh-prices`.

---

## 19. price_alerts

User-defined price triggers for tickers in their portfolio or watchlist.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid4 | PK |
| investor_id | UUID | NO | — | FK → investor_profiles (CASCADE), indexed |
| ticker | VARCHAR(20) | NO | — | indexed |
| asset_name | VARCHAR(200) | YES | — | |
| alert_type | VARCHAR(10) | NO | — | `above` \| `below` |
| target_price | FLOAT | NO | — | |
| currency | VARCHAR(10) | NO | `'USD'` | |
| is_active | BOOLEAN | NO | `true` | Set false once triggered |
| triggered_at | TIMESTAMPTZ | YES | — | |
| triggered_price | FLOAT | YES | — | |
| created_at | TIMESTAMPTZ | NO | `now()` | |

---

## 20. watchlist_items

Tickers the investor is watching but hasn't invested in yet.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid4 | PK |
| investor_id | UUID | NO | — | FK → investor_profiles (CASCADE) |
| ticker | VARCHAR(20) | NO | — | |
| name | VARCHAR(255) | NO | — | |
| asset_type | VARCHAR(20) | NO | — | |
| notes | TEXT | YES | — | |
| added_at | TIMESTAMPTZ | NO | `now()` | |

---

## 21. audit_events

Append-only audit log for all significant actions.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid4 | PK |
| investor_profile_id | UUID | YES | — | FK → investor_profiles (nullable — system events have no investor) |
| event_type | VARCHAR(100) | NO | — | e.g. `RISK_MODEL_GENERATED`, `HOLDING_CREATED` |
| description | TEXT | NO | — | |
| event_metadata | JSONB | YES | — | Arbitrary structured data |
| created_at | TIMESTAMPTZ | NO | `now()` | |

---

## 22. backtest_runs

One backtest run = one strategy simulated over a period.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid4 | PK |
| investor_profile_id | UUID | NO | — | FK → investor_profiles (CASCADE) |
| strategy_template_id | UUID | NO | — | FK → strategy_templates |
| risk_model_id | UUID | NO | — | FK → risk_models |
| initial_capital | FLOAT | NO | — | |
| final_capital | FLOAT | NO | — | |
| period_months | INTEGER | NO | — | |
| seed | INTEGER | YES | — | RNG seed for reproducibility |
| total_return_pct | FLOAT | NO | — | |
| annualized_return_pct | FLOAT | NO | — | |
| max_drawdown_pct | FLOAT | NO | — | |
| sharpe_ratio | FLOAT | NO | — | |
| win_rate_pct | FLOAT | NO | — | |
| currency | VARCHAR(3) | NO | — | |
| notes | TEXT | NO | `''` | |
| created_at | TIMESTAMPTZ | NO | `now()` | |

---

## 23. backtest_periods

Month-by-month breakdown of a backtest run.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid4 | PK |
| backtest_run_id | UUID | NO | — | FK → backtest_runs (CASCADE), ordered |
| month | INTEGER | NO | — | 1-indexed |
| portfolio_value | FLOAT | NO | — | |
| monthly_return_pct | FLOAT | NO | — | |

---

## 24. paper_portfolios

Simulated portfolio following a strategy template in real time.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid4 | PK |
| investor_profile_id | UUID | NO | — | FK → investor_profiles (CASCADE) |
| strategy_template_id | UUID | NO | — | FK → strategy_templates |
| risk_model_id | UUID | NO | — | FK → risk_models |
| backtest_run_id | UUID | YES | — | FK → backtest_runs (if seeded from a backtest) |
| initial_capital | FLOAT | NO | — | |
| current_value | FLOAT | NO | — | |
| total_return_pct | FLOAT | NO | `0.0` | |
| currency | VARCHAR(3) | NO | — | |
| status | ENUM | NO | `'active'` | `active` \| `paused` \| `completed` |
| started_at | TIMESTAMPTZ | NO | `now()` | |
| last_tick_at | TIMESTAMPTZ | YES | — | |

---

## 25. paper_ticks

Monthly simulation ticks for a paper portfolio.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid4 | PK |
| portfolio_id | UUID | NO | — | FK → paper_portfolios (CASCADE), ordered |
| tick_number | INTEGER | NO | — | 1-indexed |
| portfolio_value_before | FLOAT | NO | — | |
| portfolio_value_after | FLOAT | NO | — | |
| monthly_return_pct | FLOAT | NO | — | |
| simulated_at | TIMESTAMPTZ | NO | `now()` | |

---

## 26. Relationships diagram

```
users
  └── investor_profiles (user_id, optional)
        ├── financial_profile (1:1)
        │     ├── financial_assets (1:N)
        │     └── financial_liabilities (1:N)
        ├── financial_goals (1:N)
        │     └── goal_progress_logs (1:N)
        ├── risk_models (1:N)
        ├── strategy_recommendations (1:N) → strategy_templates
        ├── backtest_runs (1:N) → strategy_templates
        │     └── backtest_periods (1:N)
        ├── paper_portfolios (1:N) → strategy_templates
        │     └── paper_ticks (1:N)
        ├── investment_accounts (1:N)
        │     └── investment_holdings (1:N)
        ├── holding_transactions (1:N)
        ├── portfolio_snapshots (1:N)
        ├── price_alerts (1:N)
        ├── watchlist_items (1:N)
        ├── audit_events (1:N, nullable)
        └── family_memberships → family_profiles
                                    └── family_members (1:N)

currency_rates        — global cache, no FK
price_snapshots       — global cache, no FK
```

---

## 27. Migration history

| Migration | Description |
|-----------|-------------|
| 0001 | Initial schema (users, investor_profiles, financial_profiles, goals, risk_models, strategy_templates/recommendations) |
| 0002 | Backtest runs + periods |
| 0003 | Paper portfolios + ticks |
| 0004 | Audit events |
| 0005 | Extended investor profile fields (investment_goal, risk_tolerance, time_horizon, preferred_assets, trading_frequency, guardian_required) |
| 0006 | Risk model enforcement fields (allowed/blocked strategy families, live_trading_allowed, requires_paper_trading, max_trade_size_pct, max_open_positions) |
| 0007 | Investment accounts + holdings |
| 0008 | Currency rates |
| 0009 | Market data / price snapshots |
| 0010 | Portfolio snapshots |
| 0011 | Watchlist items |
| 0012 | Price alerts |
| 0013 | Holding transactions |
| 0014 | Goal progress logs |
| 0015 | Family profiles + family members |
| 0016 | Savings fund fields on investment_holdings (current_balance, total_deposits, monthly_contribution, annual_return_rate, fund_status, is_emergency_fund) |
| 0017 | Study fund sub-fields (monthly_contribution_employee, monthly_contribution_employer) |
| 0018 | Broker sync fields on investment_accounts (auto_sync_enabled, last_synced_at, sync_broker_type) |
| 0019 | Family member ID on investment_accounts (family_member_id) |
| 0020–0025 | Various feature additions (price alert triggers, goal tracking modes, linked accounts, account alert_email + email_alerts_enabled) |
| 0026 | Management fees on holdings (management_fee_balance_pct, management_fee_contribution_pct) |
| 0027 | Options fields on holdings (strike_price, expiry_date, option_type, underlying_ticker, contract_multiplier, position_type) |
| 0028 | Weekly digest opt-in on investor_profiles (weekly_digest_enabled) |
| 0029 | purchase_fx_rate on investment_holdings (FX impact analysis) |

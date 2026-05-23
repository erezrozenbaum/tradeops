# TradeOps AI — Database Schema Reference

**Version:** 2.3.0  
**Last updated:** 2026-05-23  
**Migration head:** 0044

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
16a. [fx_rate_history](#16a-fx_rate_history)
17. [price_snapshots](#17-price_snapshots)
18. [portfolio_snapshots](#18-portfolio_snapshots)
19. [price_alerts](#19-price_alerts)
20. [watchlist_items](#20-watchlist_items)
21. [audit_events](#21-audit_events)
22. [backtest_runs](#22-backtest_runs)
23. [backtest_periods](#23-backtest_periods)
24. [paper_portfolios](#24-paper_portfolios)
25. [paper_ticks](#25-paper_ticks)
25a. [paper_positions](#25a-paper_positions)
25b. [paper_orders](#25b-paper_orders)
25c. [market_research_reports](#25c-market_research_reports)
26. [net_worth_snapshots](#26-net_worth_snapshots)
27. [coach_insights](#27-coach_insights)
28. [market_signals](#28-market_signals)
29. [ai_usage_logs](#29-ai_usage_logs)
30. [Relationships diagram](#30-relationships-diagram)
31. [recommendation_decisions](#31-recommendation_decisions)
32. [investor_maturity_snapshots](#32-investor_maturity_snapshots)
33. [financial_twin_snapshots](#33-financial_twin_snapshots)
34. [financial_health_scores](#34-financial_health_scores)
35. [behavioral_risk_events](#35-behavioral_risk_events)
36. [Migration history](#36-migration-history)

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

Live FX cache. One row per (base, target) pair, upserted on each fetch. **No historical rows** — see fx_rate_history for time-series data.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid4 | PK |
| base_currency | VARCHAR(10) | NO | — | e.g. `ILS` |
| target_currency | VARCHAR(10) | NO | — | e.g. `USD` |
| rate | FLOAT | NO | — | base → target multiplier |
| fetched_at | TIMESTAMPTZ | NO | `now()` | Cache TTL: 4 hours |

**Source:** `open.er-api.com/v6/latest/{base}` (free tier, ~1500 req/month)

---

## 16a. fx_rate_history

Daily FX closing rates for historical P&L decomposition. Added in migration 0037 (v0.92.0).

One row per (from_currency, to_currency, date). Unique constraint enforces one rate per pair per day.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid4 | PK |
| from_currency | VARCHAR(10) | NO | — | e.g. `ILS` — indexed |
| to_currency | VARCHAR(10) | NO | — | e.g. `USD` — indexed |
| date | DATE | NO | — | Closing date — indexed |
| rate | FLOAT | NO | — | 1 from_currency = rate × to_currency |
| source | VARCHAR(50) | NO | `'yfinance'` | Data provider |

**Unique constraint:** `(from_currency, to_currency, date)`

**Used by:** `currency_engine/history.py:get_rate_at_date()` — provides historically-accurate `purchase_fx_rate` for new holdings when `purchase_date` is known. The `fx_impact` engine uses `purchase_fx_rate` to decompose total P&L into Asset P&L (price movement) and Currency P&L (FX movement).

**Populated by:** daily worker `fx_history_sync` (21:30 UTC); on-demand fetch on cache miss in `get_rate_at_date()`.

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

Virtual paper trading portfolio. Supports both free-form (buy/sell any ticker) and strategy-simulation (tick-based) modes.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid4 | PK |
| investor_profile_id | UUID | NO | — | FK → investor_profiles (CASCADE) |
| strategy_template_id | UUID | YES | — | FK → strategy_templates (optional — null for free-form portfolios) |
| risk_model_id | UUID | YES | — | FK → risk_models (optional — null for free-form portfolios) |
| backtest_run_id | UUID | YES | — | FK → backtest_runs (if seeded from a backtest) |
| initial_capital | FLOAT | NO | — | Starting cash set by user |
| cash_balance | FLOAT | NO | `0` | Current available virtual cash |
| current_value | FLOAT | NO | — | cash_balance + sum(positions at cost) |
| total_return_pct | FLOAT | NO | `0.0` | |
| currency | VARCHAR(3) | NO | — | |
| status | ENUM | NO | `'active'` | `active` \| `paused` \| `completed` |
| started_at | TIMESTAMPTZ | NO | `now()` | |
| last_tick_at | TIMESTAMPTZ | YES | — | Set when strategy simulation ticks are advanced |

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

---

## 25a. paper_positions

Open virtual positions held in a paper portfolio (one row per ticker per portfolio).

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid4 | PK |
| portfolio_id | UUID | NO | — | FK → paper_portfolios (CASCADE) |
| symbol | VARCHAR(20) | NO | — | Ticker symbol, e.g. `AAPL` |
| name | VARCHAR(255) | YES | — | Display name |
| quantity | FLOAT | NO | — | Current held quantity |
| avg_cost_per_share | FLOAT | NO | — | Weighted average cost (WACC) |
| currency | VARCHAR(10) | NO | `USD` | Asset-native currency |
| created_at | TIMESTAMPTZ | NO | `now()` | |
| updated_at | TIMESTAMPTZ | NO | `now()` | |

**Unique index:** `(portfolio_id, symbol)` — one position per ticker per portfolio.

---

## 25b. paper_orders

Executed paper buy/sell orders (trade history for a portfolio).

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid4 | PK |
| portfolio_id | UUID | NO | — | FK → paper_portfolios (CASCADE) |
| symbol | VARCHAR(20) | NO | — | |
| side | VARCHAR(4) | NO | — | `buy` \| `sell` |
| quantity | FLOAT | NO | — | |
| price_per_share | FLOAT | NO | — | Execution price (live-fetched or user-supplied) |
| total_value | FLOAT | NO | — | `quantity × price_per_share` |
| executed_at | TIMESTAMPTZ | NO | `now()` | |

---

## 25c. market_research_reports

Persisted market research report snapshots (JSONB). Allows history browsing without re-running analysis.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID | NO | uuid4 | PK |
| investor_id | UUID | NO | — | FK → investor_profiles (CASCADE) |
| generated_at | TIMESTAMPTZ | NO | — | When the AI report was generated |
| report | JSONB | NO | — | Full `MarketResearchReport` payload |
| picks_count | INTEGER | NO | `0` | Denormalized — total picks across all 3 tiers |
| universe_size | INTEGER | NO | `0` | Denormalized — instruments screened |
| created_at | TIMESTAMPTZ | NO | `now()` | |

---

## 26. net_worth_snapshots

Daily snapshot of an investor's complete net worth. Written by the `net_worth_snapshot` background job at 21:15 UTC.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | UUID | NO | PK |
| investor_id | UUID | NO | FK → investor_profiles (CASCADE) |
| portfolio_value | FLOAT | NO | Total portfolio value in base currency |
| financial_assets_value | FLOAT | NO | Sum of non-portfolio financial assets |
| total_liabilities | FLOAT | NO | Sum of financial liabilities |
| net_worth | FLOAT | NO | portfolio_value + financial_assets_value − total_liabilities |
| currency | VARCHAR(3) | NO | Investor base currency |
| snapshot_at | TIMESTAMPTZ | NO | UTC timestamp of snapshot |

**Indexes:** `ix_nws_investor_id`, `ix_nws_snapshot_at`

---

## 27. coach_insights

Persistent AI Coach insight records. Rules run daily at 07:45 UTC via `coach_refresh` job. Dismissed insights are suppressed for 7 days via `dedup_key`.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | UUID | NO | PK |
| investor_id | UUID | NO | FK → investor_profiles (CASCADE) |
| insight_type | VARCHAR(50) | NO | e.g. `emergency_fund`, `idle_cash`, `goal_behind`, `portfolio_drift`, `tax_loss_harvest`, `paper_trading_milestone`, `high_interest_debt` |
| dedup_key | VARCHAR(100) | NO | Unique key per insight category; prevents re-generating dismissed insights for 7 days |
| severity | VARCHAR(20) | NO | `danger` \| `warning` \| `info` |
| title | VARCHAR(255) | NO | Short headline |
| message | TEXT | NO | Full insight text |
| action_text | VARCHAR(255) | YES | Call-to-action label |
| link | VARCHAR(255) | YES | Target URL for action |
| is_dismissed | BOOLEAN | NO | Default false |
| dismissed_at | TIMESTAMPTZ | YES | When user dismissed |
| generated_at | TIMESTAMPTZ | NO | When insight was created |

**Indexes:** `ix_ci_investor_id`, `ix_ci_dedup_key`

---

## 30. Relationships diagram

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
        ├── paper_portfolios (1:N) → strategy_templates (optional)
        │     ├── paper_ticks (1:N)
        │     ├── paper_positions (1:N)
        │     └── paper_orders (1:N)
        ├── market_research_reports (1:N)
        ├── net_worth_snapshots (1:N)
        ├── coach_insights (1:N)
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
market_signals (1:N per investor_profile, unique per ticker+date)
ai_usage_logs         — global log, investor_id nullable FK
```

---

## 28. market_signals

Generated by the daily market signal job. Stores sentiment, whale mention, and pairs trading signals per ticker per day.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | UUID | NO | PK |
| investor_id | UUID | NO | FK → investor_profiles (CASCADE) |
| ticker | VARCHAR(10) | NO | |
| signal_type | VARCHAR(20) | NO | `NEWS_SENTIMENT` \| `WHALE_MENTION` \| `PAIRS_ZSCORE` |
| signal_date | DATE | NO | |
| sentiment_score | FLOAT | YES | −1.0 to +1.0 |
| composite_score | INTEGER | YES | 0–100 |
| rationale | TEXT | YES | |
| guard_status | VARCHAR(20) | YES | `allowed` \| `muted_stability` \| `muted_concentration` |
| is_dismissed | BOOLEAN | NO | default false |
| created_at | TIMESTAMPTZ | NO | `now()` |

**Unique index:** `(investor_id, ticker, signal_date)` — one signal per ticker per day per investor.

---

## 29. ai_usage_logs

Tracks every Claude API call for cost attribution and admin reporting.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | UUID | NO | PK |
| user_id | UUID | YES | FK → users (nullable) |
| investor_id | UUID | YES | FK → investor_profiles (nullable) |
| feature_name | VARCHAR(100) | NO | e.g. `market_signals`, `ai_report` |
| model | VARCHAR(100) | NO | e.g. `claude-haiku-4-5-20251001` |
| input_tokens | INTEGER | NO | |
| output_tokens | INTEGER | NO | |
| cost_usd | FLOAT | NO | Computed from token counts + published rates |
| called_at | TIMESTAMPTZ | NO | `now()` |

---

## 31. recommendation_decisions

Decision provenance store. Every AI recommendation, coach insight, and rebalance event writes one row with the full frozen decision context. Append-only — never updated after insert.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | UUID | NO | PK |
| investor_id | UUID | NO | FK → investor_profiles (CASCADE), indexed |
| decision_type | VARCHAR(50) | NO | `ai_recommendation` \| `ai_recommendation_replay` \| `coach_insight` \| `rebalance`, indexed |
| triggered_at | TIMESTAMPTZ | NO | `now()`, indexed |
| portfolio_snapshot_id | UUID | YES | FK → portfolio_snapshots (SET NULL) — the snapshot active at decision time |
| risk_model_snapshot | JSONB | YES | Full frozen risk model fields at decision time |
| holdings_summary | JSONB | YES | Frozen portfolio allocation summary |
| fx_rate_snapshot | JSONB | YES | Relevant FX rates at decision time |
| price_snapshot | JSONB | YES | Relevant live prices at decision time |
| market_signals_snapshot | JSONB | YES | Up to 10 market signals at decision time |
| rule_results | JSONB | YES | Deterministic rule outputs (coach insight keys and types) |
| model_used | VARCHAR(100) | YES | e.g. `claude-sonnet-4-6` |
| prompt_version | VARCHAR(50) | YES | e.g. `v1` — tracks prompt engineering iterations |
| ai_input_summary | TEXT | YES | First 1000 chars of AI prompt context (truncated) |
| ai_output_summary | TEXT | YES | First 1000 chars of AI output (truncated) |
| input_tokens | INTEGER | YES | Claude API input token count |
| output_tokens | INTEGER | YES | Claude API output token count |
| output_summary | JSONB | YES | Structured output (e.g. `{tickers, guidance, portfolio_actions}`) |
| recommendation_count | INTEGER | YES | Number of recommendations produced |
| decision_hash | VARCHAR(64) | YES | SHA-256 of `{investor_id, decision_type, risk_model_id, minute}` truncated to 16 chars — dedup identifier |
| created_at | TIMESTAMPTZ | NO | `now()` |

**Written by:** `provenance/recorder.py:record_decision()` — fire-and-forget wrapper; never raises; logs warning on failure.

**Read by:** `provenance/router.py` — list, detail, and replay endpoints. Also read by `decision_timeline/service.py` to merge into the unified timeline.

**Replay:** `POST /investors/{id}/decisions/{id}/replay` re-runs the AI using frozen inputs from `risk_model_snapshot`, `holdings_summary`, `market_signals_snapshot`. The replay result is recorded as a new row with `decision_type = ai_recommendation_replay`.

---

## 32. investor_maturity_snapshots

Weekly computed investor maturity score. Each row is a point-in-time snapshot — never updated; new rows are appended each Saturday by `compute_maturity_weekly`.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | UUID | NO | PK |
| investor_id | UUID | NO | FK → investor_profiles (CASCADE), indexed |
| computed_at | TIMESTAMPTZ | NO | `now()`, indexed |
| composite_score | FLOAT | NO | Weighted composite 0–100 across 8 components |
| stage | VARCHAR(30) | NO | `foundation` \| `discipline` \| `optimization` \| `advanced_cognition`, indexed |
| component_scores | JSONB | NO | `{financial_stability, debt_discipline, savings_consistency, emotional_discipline, strategy_consistency, contribution_regularity, data_maturity, portfolio_complexity}` each 0–100 |
| features_unlocked | JSONB | NO | List of feature keys accessible at this stage |
| notes | JSONB | NO | Up to 5 actionable improvement suggestions |

**Written by:** `investor_maturity/service.py:compute_maturity()` — called on demand (`GET /maturity` on first access, `POST /maturity/refresh`) and by the `maturity_weekly` background job.

**Stage thresholds:** Foundation < 25, Discipline 25–49, Optimization 50–74, Advanced Cognition ≥ 75.

---

## 33. financial_twin_snapshots

Daily behavioral/financial twin snapshot per investor. Co-computed with `financial_health_scores`.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | UUID | NO | PK |
| investor_id | UUID | NO | FK → investor_profiles CASCADE |
| computed_at | TIMESTAMPTZ | NO | Snapshot timestamp |
| financial_stability | FLOAT | NO | Income surplus + emergency fund coverage |
| behavioral_discipline | FLOAT | NO | Trade quality score from 12-month history |
| emotional_risk | FLOAT | NO | Short-term reactive trading tendency (lower = calmer) |
| portfolio_consistency | FLOAT | NO | Actual vs target risk model alignment |
| financial_resilience | FLOAT | NO | Emergency fund buffer + net worth shock absorption |
| risk_alignment | FLOAT | NO | Portfolio risk level vs stated risk profile |
| long_term_discipline | FLOAT | NO | Average holding duration score |
| contribution_momentum | FLOAT | NO | Frequency of recent investment contributions |
| overall_score | FLOAT | NO | Weighted average of all 8 dimensions |

Indexes: `investor_id`, `computed_at` (DESC).

---

## 34. financial_health_scores

Daily 9-dimensional financial health snapshot per investor.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | UUID | NO | PK |
| investor_id | UUID | NO | FK → investor_profiles CASCADE |
| computed_at | TIMESTAMPTZ | NO | Snapshot timestamp |
| stability | FLOAT | NO | Income surplus, expense coverage, financial score |
| liquidity | FLOAT | NO | Emergency fund months coverage |
| discipline | FLOAT | NO | Trading behaviour quality |
| diversification | FLOAT | NO | Unique assets held across portfolio |
| emotional_control | FLOAT | NO | Absence of short-term reactive / panic trading |
| contribution_consistency | FLOAT | NO | Regularity of investment contributions |
| tax_efficiency | FLOAT | NO | Long-term vs short-term holding ratio |
| risk_alignment | FLOAT | NO | Portfolio allocation vs target risk model |
| financial_resilience | FLOAT | NO | Emergency fund buffer + net worth strength |
| overall_score | FLOAT | NO | Weighted average of all 9 dimensions |

Indexes: `investor_id`, `computed_at` (DESC).

---

## 35. behavioral_risk_events

Stores detected behavioral risk events per investor. One active record per event_type at most.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | UUID | NO | PK |
| investor_id | UUID | NO | FK → investor_profiles CASCADE |
| event_type | VARCHAR(50) | NO | panic_selling \| performance_chasing \| revenge_trading \| overtrading_spike \| concentration_addiction \| risk_creep \| strategy_abandonment |
| severity | VARCHAR(20) | NO | low \| medium \| high \| critical |
| status | VARCHAR(20) | NO | active \| resolved \| acknowledged; default: active |
| detected_at | TIMESTAMPTZ | NO | When the rule fired |
| resolved_at | TIMESTAMPTZ | YES | Set when user resolves |
| description | TEXT | NO | Human-readable explanation |
| evidence | JSONB | NO | Supporting data (counts, ratios, tickers) |
| recommendation | TEXT | NO | Suggested corrective action |
| decision_id | UUID | YES | FK → recommendation_decisions SET NULL (causal link) |

Indexes: `investor_id`, `detected_at`, `(investor_id, status)`.

---

## 36. Migration history

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
| 0030 | market_signals table (NEWS_SENTIMENT, WHALE_MENTION, PAIRS_ZSCORE; composite_score 0–100; guard_status; unique index on investor_id+ticker+signal_date) |
| 0031 | makdam column on investment_holdings (Israeli pension coefficient, nullable float) |
| 0032 | ai_usage_logs table (feature_name, model, input_tokens, output_tokens, cost_usd, called_at) |
| 0033 | Family multi-user: invite_email/invite_token/invite_status on family_members; owner_type on investment_accounts (personal/joint); balance_updated_at on investment_holdings |
| 0034 | CHECK constraints on enum VARCHAR columns (owner_type, invite_status, asset_type, transaction_type, signal_type, etc.) |
| 0035 | live_trading_sessions table (gateway_url, session_token, session_status, acknowledged_at, order log JSONB) |
| 0036 | Index on audit_events.investor_profile_id; CHECK constraints on financial_profiles.investable_capital_pct and risk_models.max_trade_size_pct (0–100 range) |
| 0037 | fx_rate_history table (from_currency, to_currency, date, rate, source) — daily FX closing rate store with unique constraint per pair+date |
| 0038 | paper_trading_v2: cash_balance on paper_portfolios; strategy_template_id and risk_model_id made nullable; new paper_positions table (WACC positions) and paper_orders table (trade history) |
| 0039 | market_research_reports table — JSONB persistence of deep market research reports for history browsing |
| 0040 | net_worth_snapshots table (daily net worth history: portfolio_value, financial_assets_value, total_liabilities, net_worth, currency, snapshot_at) + coach_insights table (AI Coach persistent insights: insight_type, dedup_key, severity, title, message, action_text, link, is_dismissed, generated_at) |
| 0041 | recommendation_decisions table — full decision provenance: frozen inputs (risk_model_snapshot, holdings_summary, fx_rate_snapshot, price_snapshot, market_signals_snapshot, rule_results as JSONB), AI layer (model_used, prompt_version, ai_input_summary, ai_output_summary, input/output_tokens), output (output_summary JSONB, recommendation_count, decision_hash VARCHAR(64)); 3 indexes on investor_id, triggered_at, decision_type |
| 0042 | investor_maturity_snapshots table — composite_score FLOAT, stage VARCHAR(30), component_scores JSONB (8 components), features_unlocked JSONB, notes JSONB; 3 indexes on investor_id, computed_at, stage |
| 0043 | financial_twin_snapshots (8 FLOAT dimension columns + overall_score) and financial_health_scores (9 FLOAT dimension columns + overall_score); 2 indexes each on investor_id and computed_at |
| 0044 | behavioral_risk_events table — event_type VARCHAR(50), severity VARCHAR(20), status VARCHAR(20) default active, detected_at TIMESTAMPTZ, resolved_at nullable, description TEXT, evidence JSONB, recommendation TEXT, decision_id nullable FK → recommendation_decisions SET NULL; 3 indexes |

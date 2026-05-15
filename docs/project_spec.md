# TradeOps AI — Current Project Specification

## Personal Financial Intelligence Platform — Current Implementation + Next Build Phase

---

## 0. Current Implementation Status — READ FIRST

This document must be interpreted according to the **current repository state**, not the original early-stage plan.

As of version **0.63.0**, TradeOps AI has a full working platform (not just an MVP). See `CHANGELOG.md` for the complete version history.

**Current platform capabilities (v0.63.0):**

* FastAPI backend + PostgreSQL + SQLAlchemy + Alembic (migration head: 0028)
* Next.js 14 App Router + Tailwind CSS + Recharts + PWA (service worker, installable)
* Docker Compose dev stack; GitHub Actions CI/CD
* Investor profiles, family profiles, financial profiles, goals
* Financial stability scoring + percentage-based risk modeling
* Strategy templates + recommendation engine
* Full portfolio tracking: multi-account, multi-currency, FX normalisation
* Live market prices (Alpha Vantage + Yahoo Finance fallback)
* Performance analytics: Sharpe, Sortino, MWR/IRR, drawdown, rolling returns, SPY/TA-35 benchmark
* Portfolio attribution, stress testing, tax-loss harvesting, income projection
* Rebalancing engine (drift detection vs risk model targets)
* Options tracking (call/put, long/short, expiry countdown, P&L)
* Pension/study fund management with management fee modelling
* AI analysis (Claude Sonnet) — full financial report
* AI portfolio chat (natural language Q&A, 5-turn history)
* AI weekly digest email (Friday 18:00 UTC, opt-in)
* Broker auto-sync (IBKR, eToro, Altshuler Shaham, ALTrade)
* Notification center + price alerts + daily alert email digest
* Backtesting + paper trading simulation
* Market scanner, investment recommendations, market research
* Economic calendar, holdings news, debt planner

See `docs/schema.md` for the full database schema reference and `docs/architecture.md` for the system overview.

---

*Legacy spec content below (written at v0.8.0 — some sections are outdated but preserved for context):*

---

As of version **0.8.0**, TradeOps AI already had a working MVP foundation:

* FastAPI backend with PostgreSQL, SQLAlchemy, Pydantic, and Alembic
* Next.js 14 frontend with App Router, Tailwind CSS, Recharts, and dashboard pages
* Docker Compose for local/self-hosted execution
* GitHub Actions CI/CD with backend tests, frontend checks, Docker image builds, and release automation
* Investor profiles
* Financial profiles
* Family profiles
* Financial goals
* Financial stability scoring
* Percentage-based risk modeling
* Strategy template library
* Strategy recommendation flow
* Backtesting simulation engine
* Paper trading simulation engine
* Claude-powered AI report generation
* Audit log

Live trading is intentionally disabled in the MVP.

### Current Product Flow

```text
Investor Profile
→ Financial Profile
→ Family / Goals Context
→ Financial Stability Score
→ Risk Allocation Model
→ Strategy Recommendations
→ Backtesting
→ Paper Trading
→ AI Financial Report
→ Audit Trail
```

### Current Phase Override

The project is now in:

```text
Decision Engine Hardening + Product Maturity Phase
```

Before adding more large features, the next priority is to strengthen the platform’s decision quality.

Claude / Copilot must **not blindly continue the old build order**.

The next implementation priority is:

```text
Financial Decision Engine
→ Investment readiness evaluation
→ Capital allocation enforcement
→ Dashboard decision summary
```

Do not start with live trading, broker integration, advanced market data, or additional AI features before this phase is complete.

---

## 0.1 Current Repository Structure

The current repo structure is approximately:

```text
tradeops/
├── backend/
│   ├── app/
│   │   ├── api/v1/router.py
│   │   ├── core/
│   │   ├── db/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── investor_profiles/
│   │   ├── financial_profiles/
│   │   ├── family_profiles/
│   │   ├── goals/
│   │   ├── financial_scoring/
│   │   ├── risk_modeling/
│   │   ├── strategy_library/
│   │   ├── strategy_selection/
│   │   ├── backtesting/
│   │   ├── paper_trading/
│   │   ├── ai_analysis/
│   │   ├── audit/
│   │   ├── dashboard/
│   │   └── workers/
│   ├── alembic/
│   └── tests/
├── frontend/
│   └── src/app/
│       ├── (auth)/login/
│       └── (dashboard)/
│           ├── page.tsx
│           ├── risk/
│           ├── strategies/
│           ├── backtesting/
│           ├── paper-trading/
│           ├── reports/
│           ├── audit/
│           └── settings/
├── infra/docker-compose.yml
└── docs/
    ├── architecture.md
    ├── admin-guide.md
    └── project_spec.md
```

Claude / Copilot must inspect the actual repo before modifying anything.

---

## 0.2 Current API Pattern

The current API uses `/api/v1/` routing.

Known current route families:

```text
/api/v1/investors
/api/v1/investors/{id}/financial-profile
/api/v1/investors/{id}/goals
/api/v1/investors/{id}/risk-model
/api/v1/investors/{id}/strategies
/api/v1/investors/{id}/backtests
/api/v1/investors/{id}/paper-portfolios
/api/v1/investors/{id}/ai-report
/api/v1/investors/{id}/audit-events
/api/v1/family-profiles
/api/v1/strategies/templates
```

Do not introduce a conflicting API style such as `/api/investor-profiles` unless explicitly refactoring the API with approval.

---

## 0.3 Existing Modules That Must Be Preserved

The following modules already exist and should be enhanced, not duplicated:

```text
financial_scoring/
risk_modeling/
strategy_library/
strategy_selection/
backtesting/
paper_trading/
ai_analysis/
audit/
dashboard/
```

Do not create parallel duplicate modules with different naming unless required and approved.

---

## 0.4 Next Required Module: financial_decision

Add a new module:

```text
backend/app/financial_decision/
```

Purpose:

The Financial Decision Engine determines whether the investor is ready to invest, how much capital should be considered investable, what risk level is allowed, and which actions should be blocked or required.

It must consume existing data from:

* investor profile
* financial profile
* financial stability score
* latest risk model
* goals
* family context when available

Output example:

```json
{
  "can_invest": true,
  "readiness_classification": "ready_with_limits",
  "recommended_investment_pct": 35,
  "max_high_risk_pct": 5,
  "blocked_actions": ["live_trading", "high_risk_strategy"],
  "required_actions": ["maintain_emergency_fund"],
  "warnings": ["Crypto exposure should remain limited"],
  "explanation": "The investor appears financially stable, but high-risk allocation should remain limited."
}
```

Add API endpoint:

```http
GET /api/v1/investors/{id}/decision
```

Add dashboard summary card:

```text
Investment Readiness
Can invest / Should wait / Education only
Recommended investable capital %
Blocked actions
Required next actions
```

---

## 1. Project Vision

TradeOps AI is not a simple trading bot.

It is an AI-assisted trading intelligence platform that helps different types of investors build, test, validate, and optionally execute trading or investment strategies under strict risk controls.

The platform must support very different investor profiles, for example:

* A 13-year-old beginner making first financial steps
* A young adult learning investing
* A 35-year-old growth-focused investor
* A 50-year-old investor focused on capital preservation
* An advanced trader who understands market risk

The system should not promise profit. It should help users understand risk, choose suitable strategies, test them, and only allow live execution after validation.

---

## 2. Core Product Positioning

### Correct Positioning

TradeOps AI is:

> An AI-assisted strategy research, education, backtesting, paper trading, and risk-controlled execution platform.

### Incorrect Positioning

TradeOps AI is not:

> A magic AI trading bot that guarantees profit.

The platform should always communicate that investing and trading involve risk.

---

## 3. Core Principles

These principles are mandatory across the entire project.

1. AI must not directly execute trades.
2. Every trade must pass through a deterministic Risk Engine.
3. No strategy can trade live money before backtesting and paper trading validation.
4. All user-facing recommendations must include risk explanation.
5. All trade decisions, signals, rejected trades, and AI recommendations must be logged.
6. The system must support beginner-safe modes.
7. The system must clearly distinguish education, simulation, paper trading, and live trading.
8. The platform must avoid guaranteed-return language.
9. Strategy generation must use controlled templates, not random AI-created trading logic.
10. Users must manually approve live trading activation.

---

## 4. High-Level Architecture

```text
[ Investor Profile Wizard ]
          ↓
[ Profile Classification Engine ]
          ↓
[ Risk Model Engine ]
          ↓
[ Strategy Recommendation Engine ]
          ↓
[ Strategy Parameter Tuning ]
          ↓
[ Backtesting Engine ]
          ↓
[ AI Analysis & Explanation Layer ]
          ↓
[ Paper Trading Engine ]
          ↓
[ Risk-Controlled Live Execution ]
          ↓
[ Monitoring, Audit Logs, Reports ]
```

---

## 5. Recommended Technology Stack

### Backend

* Python 3.11+
* FastAPI
* SQLAlchemy
* Pydantic
* Alembic for migrations

### Database

* PostgreSQL

### Frontend

* React
* TypeScript
* TailwindCSS
* shadcn/ui optional
* Recharts or Plotly for charts

### AI Layer

* OpenAI or Claude
* AI is used for explanation, analysis, strategy comparison, and report generation
* AI is not used as the final execution authority

### Workers

Phase 1:

* FastAPI background tasks
* Simple scheduler

Phase 2:

* Celery + Redis
* Separate worker containers

### Deployment

Phase 1:

* Docker Compose

Future:

* Kubernetes
* Helm chart
* CI/CD pipeline

---

## 6. Main Application Modules

```text
backend/app/
├── api/
├── core/
├── db/
├── models/
├── schemas/
├── services/
├── investor_profiles/
├── risk_modeling/
├── strategy_library/
├── strategy_selection/
├── strategy_tuning/
├── backtesting/
├── paper_trading/
├── execution/
├── market_data/
├── ai_analysis/
├── reporting/
├── audit/
└── workers/
```

---

## 7. Investor Profile Module

The investor profile is the foundation of the system.

The system must collect structured profile data instead of relying only on free text.

### Main Goals

* Understand the investor’s age, experience, risk tolerance, goals, and time horizon
* Classify the user into a risk model
* Recommend suitable strategy families
* Prevent unsafe strategy recommendations for unsuitable users

---

## 8. Investor Profile Data Model

### Table: investor_profiles

```sql
CREATE TABLE investor_profiles (
    id UUID PRIMARY KEY,
    user_id UUID NULL,
    display_name TEXT NOT NULL,
    age INTEGER NOT NULL,
    experience_level TEXT NOT NULL,
    investment_goal TEXT NOT NULL,
    risk_tolerance TEXT NOT NULL,
    time_horizon TEXT NOT NULL,
    capital_amount NUMERIC(18,2) NOT NULL,
    monthly_contribution NUMERIC(18,2) DEFAULT 0,
    preferred_assets JSONB DEFAULT '[]',
    trading_frequency TEXT NOT NULL,
    income_stability TEXT NULL,
    investment_knowledge_score INTEGER DEFAULT 0,
    max_drawdown_comfort NUMERIC(5,2) NULL,
    wants_education_mode BOOLEAN DEFAULT TRUE,
    allow_live_trading BOOLEAN DEFAULT FALSE,
    guardian_required BOOLEAN DEFAULT FALSE,
    notes TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Allowed Values

#### experience_level

```text
beginner
intermediate
advanced
professional
```

#### investment_goal

```text
education
capital_preservation
long_term_growth
income
balanced_growth
active_trading
speculation
```

#### risk_tolerance

```text
very_low
low
medium
high
very_high
```

#### time_horizon

```text
short_term       -- less than 1 year
medium_term      -- 1 to 5 years
long_term        -- 5+ years
```

#### trading_frequency

```text
none
low
medium
high
```

#### preferred_assets

```text
cash
bonds
index_funds
stocks
crypto
commodities
mixed
```

---

## 9. Age-Based Safety Rules

The system must treat age as a safety factor.

### Under 18

If age is under 18:

* Enable education mode by default
* Disable live trading by default
* Mark guardian_required = true
* Prefer simulation, financial education, DCA examples, and low-risk long-term learning
* Do not recommend leverage, shorting, margin, or aggressive trading
* Do not allow live execution without explicit system-level override

### 18–25

* Prefer education + low-to-medium risk
* Require clear risk warnings
* Avoid aggressive recommendations unless experience is advanced and risk tolerance is high

### 26–45

* Allow broader strategy selection based on risk profile
* Growth strategies can be appropriate if horizon and tolerance match

### 46–60

* Bias toward capital preservation and balanced growth
* Reduce aggressive allocation unless explicitly advanced/high risk

### 60+

* Strong capital preservation bias
* Low trading frequency
* Avoid highly volatile strategies by default

---

## 10. Risk Model Engine

The Risk Model Engine converts an investor profile into enforceable risk limits.

This must be deterministic. AI may explain the output, but the rules must be implemented in code.

### Risk Model Output

```json
{
  "risk_level": "conservative",
  "max_trade_size_percent": 2,
  "max_daily_loss_percent": 1,
  "max_total_drawdown_percent": 8,
  "max_open_positions": 3,
  "max_asset_exposure_percent": 25,
  "allowed_strategy_families": ["dca", "low_volatility", "trend_following"],
  "blocked_strategy_families": ["leverage", "shorting", "high_frequency", "speculative_breakout"],
  "allowed_assets": ["index_funds", "stocks", "btc", "eth"],
  "requires_paper_trading": true,
  "minimum_paper_days": 30,
  "minimum_paper_trades": 20,
  "live_trading_allowed": false
}
```

---

## 11. Risk Profiles

### 11.1 Education-Only Profile

Used for minors, complete beginners, or users who only want to learn.

Rules:

```text
live_trading_allowed = false
paper_trading_allowed = true
max_trade_size_percent = 0
strategy_families = [education, dca_simulation, portfolio_simulation]
```

### 11.2 Conservative Profile

For low-risk users, older investors, capital preservation, or beginners.

Rules:

```text
max_trade_size_percent = 1–2%
max_daily_loss_percent = 0.5–1%
max_total_drawdown_percent = 5–8%
max_open_positions = 3
trading_frequency = low
allowed_strategy_families = [dca, low_volatility, trend_following]
```

### 11.3 Balanced Profile

For medium-risk users with some experience.

Rules:

```text
max_trade_size_percent = 2–5%
max_daily_loss_percent = 1–2%
max_total_drawdown_percent = 10–15%
max_open_positions = 5
allowed_strategy_families = [dca, trend_following, momentum, balanced_rebalance]
```

### 11.4 Growth Profile

For younger or middle-aged investors with long horizon and medium/high tolerance.

Rules:

```text
max_trade_size_percent = 3–7%
max_daily_loss_percent = 2%
max_total_drawdown_percent = 15–20%
max_open_positions = 7
allowed_strategy_families = [trend_following, momentum, breakout, dca]
```

### 11.5 Aggressive Profile

For advanced users only.

Rules:

```text
max_trade_size_percent = 5–10%
max_daily_loss_percent = 3–5%
max_total_drawdown_percent = 20–30%
max_open_positions = 10
allowed_strategy_families = [momentum, breakout, mean_reversion, volatility]
requires_advanced_confirmation = true
```

---

## 12. Strategy Library

The system should use a controlled strategy library.

AI can select and tune from these strategies, but should not randomly invent trading code.

### Strategy Families

```text
dca
low_volatility
trend_following
momentum
mean_reversion
breakout
balanced_rebalance
portfolio_allocation
```

### Blocked or Restricted Strategy Families

```text
leverage
margin
shorting
high_frequency
options
futures
illiquid_microcaps
unvalidated_ai_generated_strategy
```

These can be added later only with explicit advanced mode and additional safeguards.

---

## 13. Strategy Template Model

### Table: strategy_templates

```sql
CREATE TABLE strategy_templates (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    family TEXT NOT NULL,
    description TEXT NOT NULL,
    min_experience_level TEXT NOT NULL,
    supported_assets JSONB DEFAULT '[]',
    default_parameters JSONB NOT NULL,
    parameter_schema JSONB NOT NULL,
    risk_level TEXT NOT NULL,
    live_trading_supported BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 14. Generated Strategy Configurations

### Table: generated_strategies

```sql
CREATE TABLE generated_strategies (
    id UUID PRIMARY KEY,
    investor_profile_id UUID REFERENCES investor_profiles(id),
    strategy_template_id UUID REFERENCES strategy_templates(id),
    name TEXT NOT NULL,
    parameters JSONB NOT NULL,
    risk_model JSONB NOT NULL,
    ai_explanation TEXT NULL,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Status Values

```text
draft
backtesting
backtest_passed
backtest_failed
paper_trading
paper_passed
paper_failed
approved_for_live
live
paused
archived
```

---

## 15. Strategy Recommendation Flow

```text
1. User completes Investor Profile Wizard
2. System classifies profile
3. Risk Model Engine generates hard limits
4. Strategy Selection Engine chooses allowed strategy templates
5. AI explains why these strategies fit the user
6. System creates generated strategy configs
7. Backtesting runs automatically
8. AI summarizes backtest results
9. User can start paper trading
10. After paper validation, live trading may be requested
11. Risk Engine decides whether live trading is allowed
```

---

## 16. Example Investor Profiles

### Example 1: 13-Year-Old Beginner

Input:

```json
{
  "age": 13,
  "experience_level": "beginner",
  "investment_goal": "education",
  "risk_tolerance": "low",
  "time_horizon": "long_term",
  "capital_amount": 500,
  "monthly_contribution": 50,
  "preferred_assets": ["stocks", "index_funds", "crypto"],
  "trading_frequency": "none"
}
```

Output:

```json
{
  "risk_level": "education_only",
  "live_trading_allowed": false,
  "guardian_required": true,
  "allowed_strategy_families": ["dca_simulation", "portfolio_allocation_simulation"],
  "blocked_strategy_families": ["leverage", "shorting", "margin", "high_frequency", "active_trading"],
  "recommendation": "Use simulation and education mode. Focus on long-term learning, basic diversification, and understanding volatility."
}
```

### Example 2: 50-Year-Old Conservative Investor

Input:

```json
{
  "age": 50,
  "experience_level": "beginner",
  "investment_goal": "capital_preservation",
  "risk_tolerance": "low",
  "time_horizon": "medium_term",
  "capital_amount": 50000,
  "monthly_contribution": 1000,
  "preferred_assets": ["stocks", "index_funds"],
  "trading_frequency": "low"
}
```

Output:

```json
{
  "risk_level": "conservative",
  "max_trade_size_percent": 2,
  "max_daily_loss_percent": 1,
  "max_total_drawdown_percent": 8,
  "max_open_positions": 3,
  "allowed_strategy_families": ["dca", "low_volatility", "balanced_rebalance"],
  "blocked_strategy_families": ["leverage", "shorting", "high_frequency", "speculative_breakout"]
}
```

### Example 3: 35-Year-Old Growth Investor

Input:

```json
{
  "age": 35,
  "experience_level": "intermediate",
  "investment_goal": "long_term_growth",
  "risk_tolerance": "medium",
  "time_horizon": "long_term",
  "capital_amount": 20000,
  "monthly_contribution": 1500,
  "preferred_assets": ["stocks", "crypto"],
  "trading_frequency": "medium"
}
```

Output:

```json
{
  "risk_level": "balanced_growth",
  "max_trade_size_percent": 4,
  "max_daily_loss_percent": 2,
  "max_total_drawdown_percent": 15,
  "max_open_positions": 5,
  "allowed_strategy_families": ["dca", "trend_following", "momentum", "balanced_rebalance"]
}
```

---

## 17. Risk Engine Logic

The Risk Engine must validate every generated strategy and every trade.

### Trade Request

```json
{
  "strategy_id": "uuid",
  "profile_id": "uuid",
  "asset": "BTC/USDT",
  "side": "BUY",
  "quantity": 0.05,
  "estimated_value": 3000,
  "portfolio_value": 50000,
  "current_daily_loss": 250,
  "current_drawdown_percent": 4.5,
  "open_positions": 2
}
```

### Risk Validation Checks

```text
1. Is live trading allowed for this profile?
2. Is the strategy approved for live trading?
3. Is the asset allowed?
4. Is the strategy family allowed?
5. Is trade size below max_trade_size_percent?
6. Is current daily loss below max_daily_loss_percent?
7. Is current drawdown below max_total_drawdown_percent?
8. Is max open position limit respected?
9. Is kill switch disabled?
10. Has the strategy passed backtesting?
11. Has the strategy passed paper trading?
```

### Risk Engine Output

```json
{
  "approved": false,
  "reason": "Trade blocked: strategy has not completed paper trading validation.",
  "risk_rule": "requires_paper_trading"
}
```

---

## 18. Backtesting Requirements

Backtesting must support:

* Historical candles
* Initial capital
* Fees
* Slippage
* Position sizing
* Stop loss
* Take profit
* Trade-by-trade records
* Equity curve
* Max drawdown
* Win rate
* Profit factor
* Sharpe ratio

### Backtest Pass Rules

A strategy should not automatically pass backtesting unless it meets configurable rules.

Example rules:

```text
minimum_trade_count >= 20
max_drawdown <= profile.max_total_drawdown_percent
profit_factor >= 1.1
ending_balance > initial_balance
no critical risk violation
```

---

## 19. Paper Trading Requirements

Paper trading uses live market data but simulated money.

### Required Fields

```text
paper_trading_start_date
paper_trading_end_date
paper_trade_count
paper_pnl
paper_max_drawdown
paper_risk_violations
paper_status
```

### Paper Trading Pass Rules

```text
minimum_days >= profile.minimum_paper_days
minimum_trades >= profile.minimum_paper_trades
max_drawdown <= allowed drawdown
risk_violations = 0
system uptime acceptable
```

---

## 20. AI Analysis Module

AI should produce human-readable explanation, not execution authority.

### AI Inputs

* Investor profile
* Risk model
* Strategy template
* Strategy parameters
* Backtest metrics
* Paper trading metrics
* Trade logs

### AI Outputs

* Strategy explanation
* Suitability explanation
* Risk explanation
* Backtest summary
* Weaknesses
* Suggested parameter changes
* Educational guidance

### AI Must Not

* Guarantee returns
* Tell a minor to trade live
* Override risk rules
* Place trades
* Recommend leverage to beginners
* Hide risk

---

## 21. AI Prompt Template — Strategy Recommendation

```text
You are an AI strategy analysis assistant inside TradeOps AI.

Your role is to explain strategy suitability based on a structured investor profile and a deterministic risk model.

You must not provide guaranteed returns.
You must not recommend live trading for minors.
You must not override the platform risk model.
You must not recommend leverage, margin, shorting, options, or futures unless the profile is explicitly advanced and the risk model allows it.

Investor Profile:
{{ investor_profile_json }}

Risk Model:
{{ risk_model_json }}

Available Strategy Templates:
{{ strategy_templates_json }}

Task:
1. Select the most suitable strategy templates from the allowed list.
2. Explain why each strategy fits the profile.
3. Explain the main risks.
4. Recommend safe starting parameters.
5. Recommend whether this should remain education-only, paper trading, or can later progress toward live trading.

Return strict JSON:
{
  "recommended_strategies": [
    {
      "template_name": "",
      "family": "",
      "reason": "",
      "risk_notes": "",
      "recommended_parameters": {},
      "mode": "education | backtest | paper_trading | live_candidate"
    }
  ],
  "overall_explanation": "",
  "warnings": []
}
```

---

## 22. AI Prompt Template — Backtest Analysis

```text
You are an AI backtest analyst inside TradeOps AI.

You analyze historical backtest results and explain them in clear language.

You must not claim future performance is guaranteed.
You must not recommend live trading if the deterministic validation rules failed.
You must clearly explain risk, drawdown, and uncertainty.

Investor Profile:
{{ investor_profile_json }}

Risk Model:
{{ risk_model_json }}

Strategy:
{{ strategy_json }}

Backtest Results:
{{ backtest_results_json }}

Validation Result:
{{ validation_result_json }}

Task:
1. Summarize the backtest.
2. Explain whether the result fits the investor profile.
3. Identify weaknesses.
4. Suggest safe improvements.
5. State whether the system validation passed or failed.

Return strict JSON:
{
  "summary": "",
  "suitability": "",
  "main_risks": [],
  "weaknesses": [],
  "suggested_improvements": [],
  "validation_explanation": "",
  "next_step": "reject | retune | paper_trade | education_only"
}
```

---

## 23. API Endpoints

### Investor Profiles

```http
POST /api/investor-profiles
GET /api/investor-profiles
GET /api/investor-profiles/{profile_id}
PUT /api/investor-profiles/{profile_id}
DELETE /api/investor-profiles/{profile_id}
```

### Risk Models

```http
POST /api/risk-models/generate/{profile_id}
GET /api/risk-models/{profile_id}
POST /api/risk-models/validate-trade
```

### Strategy Recommendations

```http
POST /api/strategies/recommend/{profile_id}
GET /api/strategies/generated/{profile_id}
POST /api/strategies/{strategy_id}/approve-for-backtest
```

### Backtesting

```http
POST /api/backtests/run
GET /api/backtests/{backtest_id}
GET /api/backtests/{backtest_id}/trades
GET /api/backtests/{backtest_id}/equity-curve
POST /api/backtests/{backtest_id}/ai-analysis
```

### Paper Trading

```http
POST /api/paper-trading/start/{strategy_id}
POST /api/paper-trading/stop/{strategy_id}
GET /api/paper-trading/{strategy_id}/status
GET /api/paper-trading/{strategy_id}/trades
```

### Live Trading

```http
POST /api/live-trading/request-activation/{strategy_id}
POST /api/live-trading/start/{strategy_id}
POST /api/live-trading/stop/{strategy_id}
POST /api/live-trading/kill-switch
```

### Audit Logs

```http
GET /api/audit/events
GET /api/audit/events/{event_id}
```

---

## 24. Frontend Pages

```text
Dashboard
Investor Profile Wizard
Investor Profile Details
Risk Model View
Strategy Recommendations
Strategy Details
Backtest Runner
Backtest Results
Paper Trading Dashboard
Live Trading Dashboard
Risk Settings
AI Reports
Audit Logs
Education Center
```

---

## 25. Investor Profile Wizard UX

### Step 1: Basic Details

* Name
* Age
* Country optional
* Currency optional

### Step 2: Experience

* Beginner
* Intermediate
* Advanced
* Professional

### Step 3: Goals

* Learn investing
* Preserve capital
* Long-term growth
* Generate income
* Active trading

### Step 4: Risk Comfort

Questions:

* How would you react if your portfolio dropped 10%?
* How long can you keep money invested?
* Do you understand that losses are possible?

### Step 5: Capital and Contributions

* Starting amount
* Monthly contribution

### Step 6: Asset Preference

* Stocks
* ETFs/index funds
* Crypto
* Mixed

### Step 7: Summary

Show:

* Risk level
* Allowed strategies
* Blocked strategies
* Recommended next step

---

## 26. Safety and Compliance Messaging

The app must show clear messages:

```text
This platform provides educational, analytical, and automation tools. It does not guarantee profit. All investing and trading involve risk, including loss of capital.
```

For minors:

```text
This profile is education-only. Live trading is disabled. A parent or legal guardian may be required for any real financial activity.
```

For live trading:

```text
Live trading can result in real financial losses. Only enable live trading after you understand the strategy, risk limits, and validation results.
```

---

## 27. MVP Scope

### MVP Must Include

* Investor Profile Wizard
* Risk Model Engine
* Strategy Library with 3–5 strategy templates
* AI strategy explanation
* Backtesting engine
* Backtest results dashboard
* Paper trading simulation
* Audit logs

### MVP Should Not Include Yet

* Live trading with real money
* Leverage
* Margin
* Options
* Futures
* Complex derivatives
* High-frequency trading

---

## 28. MVP Strategy Templates

### 1. DCA Strategy

Best for:

* Beginners
* Long-term investors
* Education mode
* Conservative profiles

Parameters:

```json
{
  "buy_interval": "weekly",
  "amount_per_interval": 50,
  "assets": ["BTC", "ETH"],
  "allocation_percentages": {"BTC": 60, "ETH": 40}
}
```

### 2. Moving Average Trend Following

Best for:

* Conservative to balanced users
* Medium/long horizon

Parameters:

```json
{
  "short_window": 20,
  "long_window": 50,
  "timeframe": "1d",
  "stop_loss_percent": 5
}
```

### 3. Low Volatility Allocation

Best for:

* Conservative users
* Older investors
* Capital preservation

Parameters:

```json
{
  "rebalance_interval": "monthly",
  "max_asset_weight": 30,
  "volatility_filter": true
}
```

### 4. Momentum Strategy

Best for:

* Intermediate users
* Growth profiles

Parameters:

```json
{
  "lookback_period": 30,
  "momentum_threshold": 5,
  "stop_loss_percent": 7
}
```

### 5. Balanced Rebalance Strategy

Best for:

* Most long-term users
* Balanced investors

Parameters:

```json
{
  "target_allocations": {},
  "rebalance_threshold_percent": 5,
  "rebalance_interval": "monthly"
}
```

---

## 29. Suggested Build Order

### Phase 1 — Foundation

1. Create repository structure
2. Add Docker Compose
3. Add FastAPI app
4. Add PostgreSQL
5. Add SQLAlchemy models
6. Add Alembic migrations

### Phase 2 — Investor Profile and Risk Model

1. Build investor profile CRUD
2. Build investor profile wizard UI
3. Implement deterministic risk model engine
4. Add risk model API
5. Add risk model UI

### Phase 3 — Strategy Recommendation

1. Create strategy template table
2. Seed initial strategy templates
3. Implement strategy selection logic
4. Add AI explanation layer
5. Add generated strategy records

### Phase 4 — Backtesting

1. Add market data importer
2. Add candle storage
3. Implement backtest engine
4. Store backtest trades
5. Calculate metrics
6. Build results dashboard

### Phase 5 — Paper Trading

1. Simulate live price feed
2. Run strategies in paper mode
3. Log fake trades
4. Validate paper trading results

### Phase 6 — Live Trading Preparation

1. Add execution engine skeleton
2. Add exchange connector interface
3. Add kill switch
4. Add live activation workflow
5. Keep real trading disabled by default

---

## 30. Claude / OpenAI / Copilot Master Prompt

```text
You are an expert senior full-stack engineer, fintech architect, and trading platform safety reviewer.

We are building TradeOps AI, an AI-assisted investor profile, strategy recommendation, backtesting, paper trading, and risk-controlled execution platform.

Important product rules:
1. This is not a magic trading bot.
2. Do not implement any guaranteed-profit language.
3. AI must not directly execute trades.
4. Every trade must go through the deterministic Risk Engine.
5. Live trading must be disabled by default.
6. Minors must be education-only by default.
7. Strategies must come from a controlled strategy library.
8. No leverage, margin, futures, options, or shorting in the MVP.
9. All major actions must be logged to audit logs.
10. Build in phases. Do not skip straight to live trading.

Technology stack:
- Backend: Python 3.11+, FastAPI, SQLAlchemy, Pydantic, Alembic
- Database: PostgreSQL
- Frontend: React, TypeScript, TailwindCSS
- Deployment: Docker Compose first
- AI: OpenAI or Claude only for explanation and analysis, not execution authority

Your first task:
Build the foundation of the backend.

Create:
- Clean FastAPI project structure
- PostgreSQL connection
- SQLAlchemy base
- Alembic support
- Models for investor_profiles, risk_models, strategy_templates, generated_strategies, backtest_runs, backtest_trades, paper_trades, audit_events
- Pydantic schemas
- Basic CRUD endpoints for investor profiles
- Audit logging helper

Do not implement live trading yet.
Do not implement real exchange API keys yet.
Keep the code modular, readable, and production-oriented.
After creating files, explain what was created and what the next safe implementation step should be.
```

---

## 31. Implementation Prompt — Risk Model Engine

```text
Implement the deterministic Risk Model Engine for TradeOps AI.

The engine receives an investor profile and returns a risk model.

Rules:
- If age < 18: education_only, guardian_required=true, live_trading_allowed=false
- Beginners must not receive aggressive strategies
- Capital preservation goal should bias conservative
- Long-term growth with medium risk can map to balanced/growth
- High or very_high risk tolerance can only map to aggressive if experience is advanced or professional
- Live trading should be false by default
- Paper trading should be required for every non-education strategy

Return:
- risk_level
- max_trade_size_percent
- max_daily_loss_percent
- max_total_drawdown_percent
- max_open_positions
- max_asset_exposure_percent
- allowed_strategy_families
- blocked_strategy_families
- requires_paper_trading
- minimum_paper_days
- minimum_paper_trades
- live_trading_allowed
- explanation

Also add unit tests for:
1. 13-year-old beginner
2. 50-year-old conservative beginner
3. 35-year-old intermediate growth investor
4. Advanced high-risk trader
5. Beginner with very_high risk tolerance should still be restricted
```

---

## 32. Implementation Prompt — Strategy Recommendation Engine

```text
Implement the Strategy Recommendation Engine for TradeOps AI.

Input:
- investor_profile
- generated risk_model
- available strategy_templates

Rules:
- Only recommend strategies whose family is in allowed_strategy_families
- Never recommend blocked strategy families
- Match min_experience_level
- Match supported assets
- Create generated_strategies with safe default parameters
- Add AI explanation only after deterministic filtering

Do not allow AI to create executable trading code.
AI may only explain and suggest parameter tuning within allowed parameter_schema.

Create endpoints:
POST /api/strategies/recommend/{profile_id}
GET /api/strategies/generated/{profile_id}
```

---

## 33. Implementation Prompt — Backtesting Engine

```text
Implement the first version of the Backtesting Engine for TradeOps AI.

Scope:
- Support candle data from market_prices table
- Support initial capital
- Support fees
- Support slippage
- Support BUY/SELL/HOLD strategy signals
- Store each simulated trade
- Calculate total PnL, win rate, max drawdown, trade count, profit factor, and equity curve

Validation:
- Strategy must not pass if max drawdown exceeds the profile risk model
- Strategy must not pass if trade count is too low
- Strategy must not pass if profit factor is below configured threshold

Do not implement live trading.
Add audit logs for every backtest run.
```

---

## 34. Implementation Prompt — Frontend Profile Wizard

```text
Build the React + TypeScript Investor Profile Wizard for TradeOps AI.

Requirements:
- Multi-step wizard
- Clean professional UI
- Strong beginner-friendly explanations
- RTL-ready layout structure if needed later
- Steps:
  1. Basic details
  2. Experience
  3. Goals
  4. Risk comfort
  5. Capital and monthly contribution
  6. Asset preferences
  7. Summary and generate risk model

After submission:
- Call backend to create investor profile
- Call backend to generate risk model
- Show risk level, allowed strategies, blocked strategies, and warnings

Do not show any guaranteed return language.
Do not enable live trading from this screen.
```

---

## 35. Definition of Done for MVP

MVP is complete only when:

* User can create investor profile
* System generates risk model
* System recommends strategies from controlled library
* User can run backtest
* Backtest stores trades and metrics
* AI explains the result
* User can run paper trading simulation
* Risk Engine blocks invalid actions
* Audit logs capture all important decisions
* Live trading remains disabled by default

---

## 36. Final Product Direction

TradeOps AI evolves into a **Personal Financial Intelligence & Strategy Platform**.

Core value:

```text
Full Financial Context (Person + Family + Geography + Currency)
→ Risk Understanding
→ Strategy Guidance
→ Validation (Backtest + Paper)
→ Controlled Execution
→ Continuous Monitoring
```

---

## 37. NEW: Financial Context & Family Layer (CRITICAL ENHANCEMENT)

The system must understand not just the investor — but their **entire financial reality**.

### 37.1 Financial Profile (Extended)

Add table:

```sql
CREATE TABLE financial_profiles (
    id UUID PRIMARY KEY,
    investor_profile_id UUID REFERENCES investor_profiles(id),
    monthly_income NUMERIC(18,2),
    monthly_expenses NUMERIC(18,2),
    savings_amount NUMERIC(18,2),
    total_assets NUMERIC(18,2),
    total_liabilities NUMERIC(18,2),
    debt_amount NUMERIC(18,2),
    emergency_fund_months NUMERIC(5,2),
    job_stability TEXT,
    income_trend TEXT,
    dependents_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### 37.2 Family Financial Model

```sql
CREATE TABLE family_profiles (
    id UUID PRIMARY KEY,
    name TEXT,
    base_currency TEXT,
    total_family_income NUMERIC(18,2),
    total_family_expenses NUMERIC(18,2),
    total_family_assets NUMERIC(18,2),
    total_family_liabilities NUMERIC(18,2),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE family_members (
    id UUID PRIMARY KEY,
    family_id UUID REFERENCES family_profiles(id),
    investor_profile_id UUID REFERENCES investor_profiles(id),
    role TEXT
);
```

### Purpose

* Combine household financial reality
* Understand shared risk
* Allocate investments per family strategy

---

## 38. Financial Stability Scoring Engine

System must calculate:

```text
Financial Stability Score (0–100)
```

### Inputs

* income vs expenses ratio
* savings buffer
* debt ratio
* emergency fund
* job stability

### Output Example

```json
{
  "stability_score": 72,
  "classification": "stable",
  "risk_modifier": "moderate",
  "recommendation": "Balanced strategies allowed"
}
```

### Mandatory Behavior

* If stability is LOW → restrict strategies
* If HIGH debt → block aggressive trading
* If no emergency fund → recommend saving before investing

---

## 39. Currency & Geography Engine

### New Fields

```sql
country
base_currency
allowed_markets
```

### Logic

* Normalize all values to base currency
* Track exposure per currency
* Support:

  * Local markets
  * Global markets
  * Crypto

### Example

```json
{
  "base_currency": "ILS",
  "exposure": {
    "USD": 60,
    "ILS": 30,
    "BTC": 10
  }
}
```

---

## 40. Risk Allocation by Investment Percentage

User must define:

```text
How much of total capital is allocated to investing
```

Example:

```text
Total capital: 100,000
Allocated to investing: 30%
Active trading allocation: 10%
```

### System must enforce:

* Max % per strategy
* Max % per asset
* Max % per risk level

### Example Output

```json
{
  "investment_allocation": 30,
  "safe_bucket": 20,
  "growth_bucket": 8,
  "high_risk_bucket": 2
}
```

---

## 41. Dashboard — Current Status + Goals + Targets

### MUST HAVE UI DASHBOARD

```text
Portfolio Overview
Financial Health Score
Risk Exposure
Strategy Performance
Goals Tracking
Family Financial View
```

### Sections

#### 1. Financial Health

* Stability score
* Income vs expenses
* Emergency fund status

#### 2. Investment Overview

* Total invested
* Allocation by asset
* Allocation by strategy
* Currency exposure

#### 3. Risk Overview

* Current drawdown
* Risk utilization
* Violations

#### 4. Strategy Performance

* Backtest results
* Paper trading results
* Live performance (future)

#### 5. Goals & Targets

```text
Target: Buy house
Target: Retirement
Target: Education fund
```

Each goal:

```text
Target amount
Current progress
Time horizon
Required monthly investment
```

---

## 42. AI Recommendation Layer (Advanced)

AI should now answer:

* Is the user financially ready to invest?
* How much should they invest?
* What % should go to risk?
* What strategy mix fits their life situation?

AI must be able to say:

```text
You should reduce debt before increasing investment risk
You should build an emergency fund first
You should lower exposure
```

---

## 43. UI/UX DESIGN REQUIREMENTS (CRITICAL)

This is one of the most important parts.

### Design Goals

* Must NOT look AI-generated
* Must feel like high-end fintech product
* Clean, modern, minimal
* Highly readable
* Emotionally safe for beginners

---

### Design Style

```text
Theme: Dark + Light mode
Style: High-tech + premium fintech
Spacing: Generous
Typography: Clean, professional
```

### Visual Principles

* No clutter
* Clear hierarchy
* Soft gradients (not flashy)
* Subtle animations
* Smooth transitions
* Consistent spacing

---

### Color Guidelines

```text
Primary: Deep blue / dark slate
Accent: Cyan / purple subtle glow
Success: Green (soft)
Warning: Amber
Error: Red (not aggressive)
```

---

### UX Principles

* Step-by-step flows (wizard style)
* Explain every decision
* Always show risk clearly
* Avoid technical jargon for beginners
* Advanced mode toggle for power users

---

### Components

* Cards with soft shadows
* Data visualization (charts, not tables first)
* Toggle views (simple / advanced)
* Tooltips for explanations

---

### Dashboard Feel

Think:

```text
Stripe Dashboard + Apple + Bloomberg (simplified)
```

NOT:

```text
Generic admin panel
```

---

## 44. Copilot / Claude MASTER UI PROMPT

```text
Design a modern fintech UI for TradeOps AI.

Requirements:
- Must NOT look AI-generated
- Clean, minimal, premium feel
- High-tech but simple
- Beginner-friendly
- Dark and light mode
- Smooth animations
- Strong typography hierarchy
- Dashboard must feel like Stripe + Apple design quality

Pages:
- Dashboard (financial health + investments + risk)
- Investor profile wizard
- Strategy recommendations
- Backtesting results
- Paper trading

Avoid:
- crowded layouts
- harsh colors
- generic admin UI look

Focus on:
clarity, trust, simplicity, premium feel
```

---

## 45. FINAL SYSTEM DEFINITION

TradeOps AI is now:

```text
Personal Financial Intelligence Platform
+ Investor Profiling
+ Family Financial Modeling
+ Currency Awareness
+ Financial Stability Analysis
+ Risk Allocation Engine
+ Strategy Recommendation Engine
+ Backtesting + Paper Trading
+ AI Explanation Layer
+ Goal Tracking Dashboard
```

---

## 46. FINAL INSIGHT

This system is no longer a trading bot.

It is:

```text
A decision system for financial life
```

That is what makes it powerful.

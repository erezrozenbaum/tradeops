# CLAUDE.local.md

## Project: TradeOps AI / Personal Financial Intelligence Platform

This file is project-specific and overrides or extends the global `CLAUDE.md` rules for this repository.

The global rules still apply:
- Do not guess
- Read before writing
- Do not break existing logic
- Think in systems
- Classify risk before implementation
- Preserve security, auditability, and maintainability

---

# 1. Product Definition

TradeOps AI is **not** a simple trading bot.

It is a **Personal Financial Intelligence Platform** that combines:

- Investor profiling
- Family financial modeling
- Financial health and stability analysis
- Local and global market awareness
- Multi-currency awareness
- Risk allocation by percentage of capital
- Strategy recommendation
- Backtesting
- Paper trading
- AI explanation and reporting
- Future risk-controlled live execution

The platform must help users understand their financial position, define goals, understand risk, and choose suitable strategies based on their real-life situation.

---

# 2. Core Product Principle

The system must prioritize:

```text
Financial safety → clarity → education → validation → automation
```

Do not design this as:

```text
AI trading bot → automatic buy/sell → profit promise
```

The correct flow is:

```text
Person / Family Profile
        ↓
Financial Status
        ↓
Currency + Country + Market Access
        ↓
Financial Stability Score
        ↓
Risk Allocation Model
        ↓
Strategy Recommendation
        ↓
Backtesting
        ↓
Paper Trading
        ↓
Risk-Controlled Execution
```

---

# 3. Non-Negotiable Safety Rules

Claude must enforce these rules in all designs and code:

1. AI must never directly execute trades.
2. Live trading must be disabled by default.
3. Every trade must pass through a deterministic Risk Engine.
4. Minors must be education-only by default.
5. The system must never guarantee profit.
6. The system must be able to recommend **not investing yet**.
7. The system must be able to recommend debt reduction or emergency fund creation before investing.
8. Strategy recommendations must come from controlled templates, not random AI-generated trading logic.
9. Backtesting and paper trading are required before any future live execution.
10. All important actions must be logged in audit events.

---

# 4. Financial Context Requirements

The platform must understand the user's full financial reality.

## 4.1 Personal Financial Data

The system should support:

- Age
- Country / nationality / tax residency where relevant
- Base currency
- Local currency
- Secondary currencies
- Monthly income
- Monthly expenses
- Savings
- Debts
- Assets
- Liabilities
- Emergency fund months
- Job stability
- Income trend
- Dependents
- Investment goals
- Investment horizon
- Risk tolerance
- Preferred markets
- Current investments

## 4.2 Family Financial Model

The system should support a family or household view:

- Family profile
- Family members
- Shared income
- Shared expenses
- Shared assets
- Shared liabilities
- Family goals
- Individual member goals
- Household risk level
- Household investment allocation

The family model must not assume that every family member has the same risk tolerance.

---

# 5. Currency and Market Awareness

The platform must support:

- Base currency normalization
- Local currency display
- Currency exposure
- Local market options
- Global market options
- Crypto market options
- Mixed portfolio strategies

Examples:

```text
Israeli user:
- Base currency: ILS
- Local market: Tel Aviv Stock Exchange
- Global market: US / EU ETFs or equities if enabled
- Crypto: optional, based on risk model
```

The system must clearly separate:

```text
portfolio value in base currency
asset currency exposure
investment market exposure
```

---

# 6. Financial Stability Score

Implement a deterministic scoring engine.

The Financial Stability Score should use factors such as:

- Income / expense ratio
- Emergency fund months
- Debt-to-income ratio
- Total liabilities vs total assets
- Job stability
- Income trend
- Dependents count
- Savings rate

The score should produce:

```json
{
  "score": 0,
  "classification": "unstable | fragile | stable | strong",
  "risk_modifier": "reduce | neutral | allow_growth",
  "recommendations": []
}
```

Mandatory logic:

- Low stability should restrict investment risk.
- High debt should restrict aggressive strategies.
- No emergency fund should trigger a recommendation to build savings first.
- Unstable income should lower the allowed risk allocation.

---

# 7. Risk Allocation Model

The system must allow the user to define risk as a percentage of investable capital.

Example:

```text
Total liquid capital: 100,000 ILS
Investable capital: 40%
Low-risk allocation: 25%
Growth allocation: 10%
High-risk allocation: 5%
```

Risk must be calculated against:

- Total net worth
- Liquid assets
- Investable capital
- Strategy allocation
- Asset allocation
- Currency exposure

Claude must not build a system that only asks “low / medium / high risk”.

The model must support actual percentage-based allocation.

---

# 8. Goals and Targets

The platform must support financial goals.

Examples:

- Emergency fund
- House purchase
- Retirement
- Child education
- Debt reduction
- Wealth growth
- Monthly passive income
- Specific investment target

Each goal should include:

- Target amount
- Current amount
- Target date
- Priority
- Required monthly contribution
- Risk suitability
- Progress percentage

The dashboard must show current progress toward goals.

---

# 9. Strategy Recommendation Rules

Strategy recommendations must consider:

- Investor age
- Experience level
- Financial stability score
- Family obligations
- Emergency fund
- Debt level
- Base currency
- Market access
- Goals
- Time horizon
- Risk allocation percentage
- Existing assets
- Current exposure

Claude must not recommend aggressive trading just because the user selected high risk.

High risk tolerance is only one factor.

Financial stability and suitability must override preference.

---

# 10. AI Role

AI is allowed to:

- Explain financial status
- Explain risk
- Compare strategies
- Analyze backtests
- Suggest safe parameter adjustments
- Generate user-friendly reports
- Explain why a strategy is unsuitable
- Explain why the user may need to save first

AI is not allowed to:

- Guarantee returns
- Execute trades
- Override the Risk Engine
- Recommend live trading to minors
- Recommend leverage, margin, shorting, options, or futures in the MVP
- Invent unvalidated strategies

---

# 11. MVP Scope

The MVP should focus on:

1. Investor profile
2. Family profile
3. Financial profile
4. Financial stability scoring
5. Currency and market context
6. Risk allocation model
7. Goals and targets
8. Dashboard
9. Strategy recommendation from controlled templates
10. Backtesting
11. Paper trading
12. AI explanations

The MVP should not include:

- Real live trading
- Leverage
- Margin
- Options
- Futures
- Shorting
- High-frequency trading
- Complex tax engine
- Bank account integrations unless explicitly requested later

---

# 12. Backend Architecture Guidance

Preferred backend stack:

- Python 3.11+
- FastAPI
- PostgreSQL
- SQLAlchemy
- Alembic
- Pydantic

Suggested modules:

```text
backend/app/
├── api/
├── core/
├── db/
├── models/
├── schemas/
├── investor_profiles/
├── family_profiles/
├── financial_profiles/
├── financial_scoring/
├── currency_engine/
├── market_context/
├── risk_modeling/
├── goals/
├── strategy_library/
├── strategy_selection/
├── backtesting/
├── paper_trading/
├── ai_analysis/
├── reporting/
├── audit/
└── workers/
```

Do not introduce a different backend framework unless explicitly requested.

---

# 13. Database Design Principles

Use PostgreSQL.

Important tables should include:

- investor_profiles
- family_profiles
- family_members
- financial_profiles
- financial_assets
- financial_liabilities
- financial_goals
- currency_rates
- market_preferences
- risk_models
- strategy_templates
- generated_strategies
- backtest_runs
- backtest_trades
- paper_trades
- audit_events

Schema changes are **RISKY**.

When changing schema:

1. Explain the change.
2. Provide migration.
3. Explain rollback.
4. Do not silently break existing data.

---

# 14. Dashboard Requirements

The dashboard is central to the product.

It must show:

## Current Status

- Net worth
- Liquid capital
- Investable capital
- Monthly income
- Monthly expenses
- Savings rate
- Emergency fund months
- Debt level
- Financial stability score

## Investments

- Current portfolio value
- Allocation by asset
- Allocation by currency
- Allocation by market
- Allocation by strategy
- Risk exposure

## Goals

- Goal cards
- Progress percentage
- Target date
- Required monthly contribution
- Gap analysis

## Risk

- Current risk usage
- Max allowed risk
- Drawdown
- Concentration risk
- Currency risk
- Strategy risk

## Family View

- Household assets
- Household liabilities
- Shared goals
- Member-level profiles
- Household financial health

---

# 15. UI / UX Requirements — Extremely Important

The UI must not look AI-generated.

Design target:

```text
Premium fintech dashboard
High-tech edge
Very user-friendly
Trustworthy
Clean
Human
```

Visual inspiration:

```text
Stripe Dashboard
Apple-level spacing
Linear-style clarity
Bloomberg-like data seriousness, but simplified
```

Avoid:

- Generic admin panels
- Random gradients
- Too many colors
- Crowded dashboards
- Tiny unreadable tables
- Overly “AI startup” visual clichés
- Excessive glassmorphism
- Harsh neon colors

Use:

- Strong spacing system
- Professional typography
- Clear hierarchy
- Soft shadows
- Subtle gradients only
- Well-designed cards
- Clear charts
- Simple / advanced mode toggle
- Helpful empty states
- Calm risk warnings
- Consistent dark and light modes

UX principle:

```text
A beginner should feel safe.
An advanced user should feel in control.
```

---

# 16. Frontend Pages

Required pages:

- Main dashboard
- Investor profile wizard
- Family profile setup
- Financial profile setup
- Assets and liabilities
- Goals and targets
- Risk allocation
- Strategy recommendations
- Backtesting results
- Paper trading dashboard
- AI financial report
- Audit log
- Settings

---

# 17. UX Flow

Recommended onboarding flow:

```text
1. Create personal profile
2. Create family / household profile optional
3. Add income and expenses
4. Add assets and liabilities
5. Choose base currency and markets
6. Define goals
7. Define investable capital percentage
8. Generate financial stability score
9. Generate risk model
10. Generate strategy suggestions
11. Run backtest
12. Start paper trading
```

Do not force the user into trading before understanding financial readiness.

---

# 18. Development Rules for Claude

Before implementing any feature, Claude must answer internally:

1. Does this affect financial safety?
2. Does this affect schema?
3. Does this affect risk logic?
4. Does this affect user trust?
5. Does this create implied financial advice?
6. Does this need audit logging?
7. Does this need tests?

If yes, treat the change as MODERATE or RISKY.

---

# 19. Testing Requirements

Important logic must have tests:

- Financial stability scoring
- Risk model generation
- Minor / education-only logic
- Family financial aggregation
- Currency normalization
- Goal calculation
- Strategy filtering
- Risk allocation limits
- Backtest validation

Do not implement scoring or risk logic without tests.

---

# 20. Security and Privacy

This project handles sensitive financial data.

Claude must:

- Avoid storing secrets in code
- Avoid logging sensitive data unnecessarily
- Use environment variables for secrets
- Design for data privacy
- Avoid exposing financial profile data through unsafe APIs
- Prepare for role-based access later
- Keep auditability without leaking sensitive details

---

# 21. Communication Style for This Project

When responding in this repo, Claude should be:

- Direct
- Product-aware
- Safety-aware
- Design-aware
- Concise but complete

Always call out:

- What changed
- Why it matters
- Risk level
- Tests needed
- Next safe step

---

# 22. First Implementation Priority

Do not start with live trading.

Build in this order:

1. Data model foundation
2. Investor profile
3. Financial profile
4. Family profile
5. Goals
6. Financial stability score
7. Risk allocation model
8. Dashboard
9. Strategy recommendation
10. Backtesting
11. Paper trading
12. AI analysis
13. Live trading skeleton only, disabled by default

---

# 23. Final Product Reminder

TradeOps AI is not trying to be a toy bot.

It is trying to become:

```text
A serious personal and family financial decision platform
with AI-assisted strategy guidance and strict risk controls.
```

Every design and code decision must support that direction.

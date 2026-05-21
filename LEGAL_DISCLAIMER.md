# Legal Disclaimer — TradeOps AI

**Last updated: 2026-05-21**

> This document contains important legal notices about the nature, limitations, and intended use of TradeOps AI. Read it in full before using this software.

---

## 1. Not Financial Advice

TradeOps AI is **educational and analytical software only**.

It is not:
- A registered investment advisor
- A licensed financial planner or broker-dealer
- A portfolio manager
- A financial institution of any kind

Nothing in this software — including AI-generated outputs, reports, suggestions, strategy recommendations, simulations, or any other feature — constitutes financial, investment, tax, or legal advice of any kind.

All outputs are **analytical decision-support tools** provided for informational and educational purposes only. They are not personalised advice, and they should never be the sole or primary basis for any investment or financial decision.

**All investment decisions remain solely the responsibility of the user.**

---

## 2. Educational and Analytical Purpose Only

TradeOps AI is designed to help users:
- Understand their financial position
- Model risk scenarios
- Simulate investment strategies before committing capital
- Organise and visualise financial data
- Learn about investment concepts and risk

It does not replace the judgement, expertise, or accountability of a licensed financial professional. Before acting on any information produced by this software, you should independently verify it and consult a qualified financial advisor, tax professional, or legal counsel appropriate to your specific situation.

---

## 3. Risk Disclosure

**Investing involves risk. You may lose some or all of the money you invest.**

Key risks include but are not limited to:

- **Market risk** — the value of investments can decline due to economic, political, or company-specific events
- **Liquidity risk** — assets may not be convertible to cash quickly or at the expected price
- **Currency risk** — changes in exchange rates can reduce the value of investments denominated in foreign currencies
- **Concentration risk** — holding too much of a single asset or sector amplifies loss potential
- **Leverage risk** — borrowing to invest can multiply losses as well as gains
- **Counterparty risk** — brokers or financial institutions may fail
- **Technology and model risk** — algorithmic or simulation outputs may contain errors, assumptions, or model limitations

Past simulated or backtested performance does not guarantee, imply, or suggest future results. Backtests are constructed using historical data and involve assumptions that may not hold in the future.

---

## 4. No Guarantee of Accuracy or Completeness

TradeOps AI retrieves data from third-party providers (including but not limited to Alpha Vantage, Yahoo Finance, and broker APIs). This data may be:
- Delayed, incomplete, or inaccurate
- Subject to provider outages or errors
- Not adjusted for corporate actions in all cases

The software makes no warranty — express or implied — regarding the accuracy, timeliness, completeness, or fitness for purpose of any price, portfolio, valuation, or financial data displayed.

All financial figures, projections, stability scores, and valuations shown in the application are **estimates** and should not be relied upon for precise accounting, regulatory reporting, or legal purposes.

---

## 5. AI-Generated Output Limitations

Several features in TradeOps AI use large language models (LLMs) provided by Anthropic (Claude API) to generate text, analysis, research, and suggestions.

Important limitations of AI-generated content:

- AI outputs may be **factually incorrect, incomplete, or outdated**
- AI models have **knowledge cutoff dates** and may not reflect recent market conditions or regulatory changes
- AI-generated research and recommendations are **not independently verified**
- AI cannot predict the future performance of any asset or market
- AI may hallucinate data, company details, or financial figures
- Tone and framing of AI outputs should not be interpreted as confidence or certainty

**The deterministic Risk Engine always runs before any AI suggestion is displayed. AI outputs cannot override the system's safety controls.**

AI features are clearly labeled throughout the interface. Treat all AI-generated content as a starting point for your own research — not as a conclusion.

---

## 6. Third-Party Data and Services

TradeOps AI integrates with third-party data providers and brokerage platforms. Use of these integrations is subject to the terms and conditions of those providers.

TradeOps AI:
- Does not control the availability, accuracy, or reliability of third-party data
- Is not responsible for losses or decisions arising from third-party data errors
- Does not store brokerage credentials in plaintext — API tokens are handled via secure environment configuration
- Does not guarantee that broker integrations will remain compatible as provider APIs change

Users are responsible for maintaining their own brokerage relationships and ensuring that their use of connected accounts complies with their broker's terms of service.

---

## 7. Tax Disclaimer

TradeOps AI includes a Tax Year Summary feature that estimates realized gains, losses, and a flat illustrative tax rate (25%).

This feature is an **approximation only**:
- It uses a weighted average cost basis method, which may differ from your jurisdiction's required accounting method
- It does not account for jurisdiction-specific tax rules, brackets, loss carryforward, wash-sale rules, or exemptions
- The 25% flat rate is illustrative and will not reflect your actual tax liability in most situations
- Dividend and income tax treatment varies by country and personal circumstances

**Do not use TradeOps AI as a substitute for professional tax advice or tax preparation software.** Consult a qualified tax professional in your jurisdiction before making any decisions based on estimated tax figures.

---

## 8. Live Trading Risk

Live trading functionality in TradeOps AI is **disabled by default** and requires:
- A documented paper trading track record
- Explicit multi-point risk acknowledgment by the user
- Administrative approval
- A connected IBKR Client Portal Gateway

Even when live trading is enabled:
- The system only supports market and limit orders via IBKR
- All orders pass through a deterministic risk engine with position size, concentration, and open order limits
- No autonomous or algorithmic trading is performed — all orders are user-initiated
- The kill switch halts the session and cancels all open orders immediately upon activation

Live trading introduces additional risks beyond simulation, including execution slippage, partial fills, network latency, and broker-side errors. **You may lose money.** Only enable live trading if you fully understand these risks and accept complete personal responsibility for all outcomes.

---

## 9. Jurisdiction Disclaimer

TradeOps AI is provided "as is" for personal, educational, and analytical use.

It is the user's responsibility to determine whether using this software, connecting to brokerage accounts, or executing investment decisions is lawful in their jurisdiction. TradeOps AI:
- Is not registered or licensed in any jurisdiction as a financial service provider
- Does not accept liability for regulatory non-compliance arising from user actions
- May not be suitable for use in jurisdictions where software of this nature requires regulatory licensing or approval

If you are unsure whether using this software is lawful in your location, consult a qualified legal advisor before proceeding.

---

## 10. Open-Source "As Is" Warranty

TradeOps AI is open-source software distributed under the MIT License.

```
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

The developers and contributors of TradeOps AI accept no liability for:
- Financial losses resulting from use of this software
- Errors or omissions in data, calculations, or AI-generated content
- Downtime, data loss, or service interruption
- Actions taken based on information displayed in the application

---

## Summary

| What TradeOps AI is | What TradeOps AI is not |
|---|---|
| Educational financial platform | A licensed financial advisor |
| Portfolio analytics and simulation tool | A broker or investment manager |
| Risk modeling and scenario analysis | A guarantee of any financial outcome |
| AI-assisted research and decision support | A source of verified financial advice |
| Paper and live trading simulator (gated) | An autonomous trading bot |

**If in doubt: consult a licensed financial professional before making any investment decision.**

"""Dividend & income projection — fetches forward dividend data via yfinance."""
import logging
import time
import uuid
from datetime import datetime, date, timezone, timedelta

import yfinance as yf

from app.portfolio_analysis.schemas import PortfolioSummary
from app.currency_engine.rates import convert as fx_convert
from app.income_projection.schemas import DividendHolding, IncomeResult
from app.income_projection.distribution import monthly_distribution

log = logging.getLogger(__name__)

# In-memory cache per ticker: (annual_div, next_ex_date, frequency, fetched_at)
_div_cache: dict[str, tuple[float, date | None, str, float]] = {}
_DIV_TTL = 86_400  # 24h


def _pay_frequency(ticker_info: dict) -> str:
    freq = ticker_info.get("dividendRate", 0)
    trailing = ticker_info.get("trailingAnnualDividendRate", 0) or 0
    if freq and trailing:
        # yfinance dividendRate is the full-year figure; trailingAnnualDividendRate ≈ same
        # Frequency is implied by payouts: check lastDividendDate cadence is unavailable via info
        # Use explicit field if present
        pass
    freq_hint = ticker_info.get("dividendFrequency", None)
    if freq_hint == 4 or freq_hint == "quarterly":
        return "quarterly"
    if freq_hint == 12 or freq_hint == "monthly":
        return "monthly"
    if freq_hint == 1 or freq_hint == "annual":
        return "annual"
    # Fallback: most US equities are quarterly
    return "quarterly"


def _fetch_dividend(ticker: str) -> tuple[float, date | None, str]:
    """Return (annual_dividend_per_share, next_ex_date, frequency)."""
    cached = _div_cache.get(ticker)
    if cached and time.time() - cached[3] < _DIV_TTL:
        return cached[0], cached[1], cached[2]

    annual_div = 0.0
    next_ex: date | None = None
    frequency = "unknown"

    try:
        t = yf.Ticker(ticker)
        info = t.info or {}

        # Forward annual dividend rate (preferred) or trailing
        annual_div = float(info.get("dividendRate") or info.get("trailingAnnualDividendRate") or 0.0)
        frequency = _pay_frequency(info)

        # Next ex-dividend date
        ex_ts = info.get("exDividendDate")
        if ex_ts:
            try:
                next_ex = date.fromtimestamp(int(ex_ts))
            except Exception:
                pass

        # If ex_date is in the past, try calendar
        if next_ex and next_ex < date.today():
            try:
                cal = t.calendar
                if cal is not None and "Ex-Dividend Date" in cal:
                    raw = cal["Ex-Dividend Date"]
                    if hasattr(raw, "date"):
                        next_ex = raw.date()
                    elif isinstance(raw, date):
                        next_ex = raw
            except Exception:
                pass

    except Exception as exc:
        log.debug("[income] Dividend fetch failed for %s: %s", ticker, exc)

    _div_cache[ticker] = (annual_div, next_ex, frequency, time.time())
    return annual_div, next_ex, frequency


def compute_income(
    portfolio: PortfolioSummary | None,
    investor_id: uuid.UUID,
    currency: str,
    db,
) -> IncomeResult:
    now = datetime.now(timezone.utc)

    if portfolio is None:
        return IncomeResult(
            investor_id=investor_id,
            currency=currency,
            total_annual_income=0.0,
            portfolio_yield_on_value=0.0,
            portfolio_yield_on_cost=0.0,
            holdings=[],
            upcoming_ex_dates=[],
            monthly_income={m: 0.0 for m in range(1, 13)},
            computed_at=now,
        )

    holdings: list[DividendHolding] = []
    total_income = 0.0
    upcoming: list[dict] = []
    ninety_days = date.today() + timedelta(days=90)

    for acc in portfolio.accounts:
        for h in acc.holdings:
            if not h.ticker:
                continue
            annual_div, next_ex, frequency = _fetch_dividend(h.ticker)
            if annual_div <= 0:
                continue

            # Convert div to base currency (div is quoted in holding currency)
            try:
                annual_income_base = fx_convert(db, annual_div * h.quantity, h.currency, currency)
            except Exception:
                annual_income_base = annual_div * h.quantity  # fallback: assume same currency

            yoc = (annual_div / h.avg_buy_price * 100) if h.avg_buy_price > 0 else 0.0
            yov = 0.0
            if h.live_price and h.live_price > 0:
                yov = annual_div / h.live_price * 100
            elif h.avg_buy_price > 0:
                yov = yoc

            total_income += annual_income_base

            holdings.append(DividendHolding(
                holding_id=h.id,
                name=h.name,
                ticker=h.ticker,
                quantity=h.quantity,
                annual_dividend_per_share=round(annual_div, 4),
                annual_income=round(annual_income_base, 2),
                yield_on_cost=round(yoc, 2),
                yield_on_value=round(yov, 2),
                next_ex_date=next_ex,
                pay_frequency=frequency,
            ))

            if next_ex and date.today() <= next_ex <= ninety_days:
                est_payment = round(annual_income_base / (4 if frequency == "quarterly" else 12 if frequency == "monthly" else 1), 2)
                upcoming.append({
                    "ticker": h.ticker,
                    "name": h.name,
                    "ex_date": next_ex.isoformat(),
                    "estimated_payment": est_payment,
                    "currency": currency,
                })

    holdings.sort(key=lambda h: h.annual_income, reverse=True)
    upcoming.sort(key=lambda u: u["ex_date"])

    total_value = portfolio.total_current_value
    total_cost = portfolio.total_cost_basis

    return IncomeResult(
        investor_id=investor_id,
        currency=currency,
        total_annual_income=round(total_income, 2),
        portfolio_yield_on_value=round(total_income / total_value * 100, 2) if total_value > 0 else 0.0,
        portfolio_yield_on_cost=round(total_income / total_cost * 100, 2) if total_cost > 0 else 0.0,
        holdings=holdings,
        upcoming_ex_dates=upcoming,
        monthly_income=monthly_distribution(holdings),
        computed_at=now,
    )

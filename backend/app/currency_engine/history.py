"""Historical FX rate lookup and daily sync.

Rates are stored as: 1 from_currency = X to_currency.
Example: from=USD, to=ILS, rate=3.70 means 1 USD = 3.70 ILS.

Source: yfinance FX tickers — "{FROM}{TO}=X" (e.g. "USDILS=X").
Fallback: inverse ticker "{TO}{FROM}=X" with rate inversion.
"""
import logging
from datetime import date, timedelta

from sqlalchemy.orm import Session

log = logging.getLogger(__name__)

_WEEKEND_LOOKBACK_DAYS = 7


def get_rate_at_date(db: Session, from_ccy: str, to_ccy: str, target_date: date) -> float | None:
    """Return the closing FX rate on or before target_date (within 7-day window for weekends/holidays).

    On cache miss, fetches the last 90 days from yfinance and retries.
    """
    from app.models.fx_rate_history import FxRateHistory

    if from_ccy == to_ccy:
        return 1.0

    window_start = target_date - timedelta(days=_WEEKEND_LOOKBACK_DAYS)

    def _query(from_c: str, to_c: str) -> FxRateHistory | None:
        return (
            db.query(FxRateHistory)
            .filter(
                FxRateHistory.from_currency == from_c,
                FxRateHistory.to_currency == to_c,
                FxRateHistory.date <= target_date,
                FxRateHistory.date >= window_start,
            )
            .order_by(FxRateHistory.date.desc())
            .first()
        )

    record = _query(from_ccy, to_ccy)
    if record:
        return record.rate

    # Try stored inverse
    record_inv = _query(to_ccy, from_ccy)
    if record_inv and record_inv.rate > 0:
        return round(1.0 / record_inv.rate, 6)

    # Not cached — fetch from yfinance and retry once
    fetched = _fetch_and_store_pair(db, from_ccy, to_ccy, days=90)
    if fetched > 0:
        record = _query(from_ccy, to_ccy)
        if record:
            return record.rate
        record_inv = _query(to_ccy, from_ccy)
        if record_inv and record_inv.rate > 0:
            return round(1.0 / record_inv.rate, 6)

    return None


def _fetch_and_store_pair(db: Session, from_ccy: str, to_ccy: str, days: int = 730) -> int:
    """Fetch daily closing rates from yfinance and upsert into fx_rate_history.

    Returns number of rows stored/updated.
    """
    from app.models.fx_rate_history import FxRateHistory
    import yfinance as yf

    def _upsert_df(df, rate_transform=None) -> int:
        if df is None or df.empty:
            return 0
        # Flatten MultiIndex columns (yfinance ≥0.2.x sometimes wraps in MultiIndex)
        if hasattr(df.columns, "levels"):
            df.columns = df.columns.get_level_values(0)
        if "Close" not in df.columns:
            return 0
        count = 0
        for idx, row in df.iterrows():
            raw = row["Close"]
            if raw is None or (hasattr(raw, "__float__") and raw != raw):  # NaN check
                continue
            rate_val = float(raw)
            if rate_val <= 0:
                continue
            if rate_transform:
                rate_val = rate_transform(rate_val)
            d = idx.date() if hasattr(idx, "date") else idx
            existing = (
                db.query(FxRateHistory)
                .filter(
                    FxRateHistory.from_currency == from_ccy,
                    FxRateHistory.to_currency == to_ccy,
                    FxRateHistory.date == d,
                )
                .first()
            )
            if existing:
                existing.rate = round(rate_val, 6)
            else:
                db.add(FxRateHistory(
                    from_currency=from_ccy,
                    to_currency=to_ccy,
                    date=d,
                    rate=round(rate_val, 6),
                    source="yfinance",
                ))
            count += 1
        try:
            db.commit()
        except Exception:
            db.rollback()
            return 0
        return count

    period = f"{min(days, 730)}d"
    try:
        ticker = yf.Ticker(f"{from_ccy}{to_ccy}=X")
        df = ticker.history(period=period, interval="1d")
        if not df.empty:
            stored = _upsert_df(df)
            if stored > 0:
                log.info("[fx_history] %s/%s: stored %d rows", from_ccy, to_ccy, stored)
                return stored
    except Exception as exc:
        log.warning("[fx_history] %s%s=X fetch failed: %s", from_ccy, to_ccy, exc)

    # Try inverse ticker
    try:
        ticker_inv = yf.Ticker(f"{to_ccy}{from_ccy}=X")
        df_inv = ticker_inv.history(period=period, interval="1d")
        if not df_inv.empty:
            stored = _upsert_df(df_inv, rate_transform=lambda r: 1.0 / r)
            if stored > 0:
                log.info("[fx_history] %s/%s via inverse: stored %d rows", from_ccy, to_ccy, stored)
                return stored
    except Exception as exc:
        log.warning("[fx_history] %s%s=X (inverse) fetch failed: %s", to_ccy, from_ccy, exc)

    return 0


def sync_yesterday(db: Session) -> dict[str, int]:
    """Fetch yesterday's closing rate for all currency pairs active in holdings.

    Called by the daily fx_history_sync worker. Returns {pair: rows_stored}.
    """
    from app.models.investment_account import InvestmentAccount, InvestmentHolding
    from app.models.investor_profile import InvestorProfile

    # Collect all (base_currency, holding_currency) pairs across all investors
    pairs: set[tuple[str, str]] = set()
    investors = db.query(InvestorProfile).all()
    for inv in investors:
        base = inv.base_currency
        holdings = (
            db.query(InvestmentHolding)
            .join(InvestmentAccount, InvestmentAccount.id == InvestmentHolding.account_id)
            .filter(InvestmentAccount.investor_id == inv.id)
            .all()
        )
        for h in holdings:
            if h.currency and h.currency != base:
                pairs.add((base, h.currency))

    results: dict[str, int] = {}
    for from_ccy, to_ccy in sorted(pairs):
        key = f"{from_ccy}/{to_ccy}"
        stored = _fetch_and_store_pair(db, from_ccy, to_ccy, days=5)
        results[key] = stored
    return results


def backfill_all_pairs(db: Session, days: int = 730) -> dict[str, int]:
    """Fetch full history (default 2 years) for all active currency pairs.

    Intended to be called once manually or via admin endpoint after initial deploy.
    """
    from app.models.investment_account import InvestmentAccount, InvestmentHolding
    from app.models.investor_profile import InvestorProfile

    pairs: set[tuple[str, str]] = set()
    investors = db.query(InvestorProfile).all()
    for inv in investors:
        base = inv.base_currency
        holdings = (
            db.query(InvestmentHolding)
            .join(InvestmentAccount, InvestmentAccount.id == InvestmentHolding.account_id)
            .filter(InvestmentAccount.investor_id == inv.id)
            .all()
        )
        for h in holdings:
            if h.currency and h.currency != base:
                pairs.add((base, h.currency))

    results: dict[str, int] = {}
    for from_ccy, to_ccy in sorted(pairs):
        key = f"{from_ccy}/{to_ccy}"
        log.info("[fx_history] backfill %s...", key)
        results[key] = _fetch_and_store_pair(db, from_ccy, to_ccy, days=days)
    return results

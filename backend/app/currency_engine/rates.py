"""
FX rate fetching and caching.

Source: open.er-api.com (free tier, no API key, ~1500 req/month).
Cache TTL: 24 hours per base currency — all target rates fetched at once.
"""
import uuid
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy.orm import Session

from app.models.currency_rate import CurrencyRate

_CACHE_TTL_HOURS = 24
_API_BASE = "https://open.er-api.com/v6/latest"


def _fetch_and_store(db: Session, base: str) -> dict[str, float]:
    """Fetch all rates for `base` from the API and upsert into DB."""
    try:
        resp = httpx.get(f"{_API_BASE}/{base}", timeout=10.0)
        resp.raise_for_status()
        data = resp.json()
        rates: dict[str, float] = data.get("rates", {})
    except Exception:
        return {}

    now = datetime.now(timezone.utc)
    for target, rate in rates.items():
        existing = (
            db.query(CurrencyRate)
            .filter(CurrencyRate.base_currency == base, CurrencyRate.target_currency == target)
            .first()
        )
        if existing:
            existing.rate = rate
            existing.fetched_at = now
        else:
            db.add(CurrencyRate(
                id=uuid.uuid4(),
                base_currency=base,
                target_currency=target,
                rate=rate,
                fetched_at=now,
            ))
    db.commit()
    return rates


def get_rate(db: Session, base: str, target: str) -> float | None:
    """Return the exchange rate base→target, fetching if the cache is stale."""
    if base == target:
        return 1.0

    cutoff = datetime.now(timezone.utc) - timedelta(hours=_CACHE_TTL_HOURS)
    cached = (
        db.query(CurrencyRate)
        .filter(
            CurrencyRate.base_currency == base,
            CurrencyRate.target_currency == target,
            CurrencyRate.fetched_at >= cutoff,
        )
        .first()
    )
    if cached:
        return cached.rate

    rates = _fetch_and_store(db, base)
    return rates.get(target)


def convert(db: Session, amount: float, from_currency: str, to_currency: str) -> float:
    """Convert `amount` from `from_currency` to `to_currency`.

    Falls back to cost basis (1:1) if rates are unavailable.
    """
    if from_currency == to_currency or amount == 0:
        return amount
    rate = get_rate(db, from_currency, to_currency)
    if rate is None:
        # Try the inverse
        inverse = get_rate(db, to_currency, from_currency)
        if inverse and inverse != 0:
            rate = 1.0 / inverse
    return amount * (rate or 1.0)

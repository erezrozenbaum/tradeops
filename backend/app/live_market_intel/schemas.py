from pydantic import BaseModel


class LiveSignal(BaseModel):
    ticker: str
    name: str
    asset_type: str          # stock | etf | crypto
    current_price: float
    currency: str
    change_24h_pct: float | None = None
    change_7d_pct: float | None = None
    pct_from_52w_low: float | None = None  # 0 = at 52w low, 100 = at 52w high
    signal_type: str         # "dip" | "momentum" | "recovery" | "near_low" | "stable"
    signal_note: str         # human-readable 1-sentence description
    risk_level: str          # low | moderate | high | very_high
    is_held: bool = False    # true if investor already holds this ticker

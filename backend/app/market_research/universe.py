"""Curated universe of stocks and ETFs screened for fundamental analysis."""

# Sector ETFs used for performance tracking (not scored, just context)
SECTOR_ETFS: dict[str, str] = {
    "Technology": "XLK",
    "Financials": "XLF",
    "Healthcare": "XLV",
    "Energy": "XLE",
    "Consumer Discretionary": "XLY",
    "Industrials": "XLI",
    "Communication Services": "XLC",
    "Utilities": "XLU",
}

# Stocks + ETFs scored by the fundamental screener
STOCK_UNIVERSE: list[dict] = [
    # ── Technology ──────────────────────────────────────────────────
    {"ticker": "AAPL",    "name": "Apple Inc.",               "sector": "Technology",              "market": "NASDAQ", "asset_type": "stock"},
    {"ticker": "MSFT",    "name": "Microsoft Corp.",          "sector": "Technology",              "market": "NASDAQ", "asset_type": "stock"},
    {"ticker": "GOOGL",   "name": "Alphabet Inc.",            "sector": "Technology",              "market": "NASDAQ", "asset_type": "stock"},
    {"ticker": "META",    "name": "Meta Platforms",           "sector": "Technology",              "market": "NASDAQ", "asset_type": "stock"},
    {"ticker": "NVDA",    "name": "NVIDIA Corp.",             "sector": "Technology",              "market": "NASDAQ", "asset_type": "stock"},
    {"ticker": "AMD",     "name": "Advanced Micro Devices",   "sector": "Technology",              "market": "NASDAQ", "asset_type": "stock"},
    {"ticker": "CSCO",    "name": "Cisco Systems",            "sector": "Technology",              "market": "NASDAQ", "asset_type": "stock"},
    {"ticker": "INTC",    "name": "Intel Corp.",              "sector": "Technology",              "market": "NASDAQ", "asset_type": "stock"},
    {"ticker": "ORCL",    "name": "Oracle Corp.",             "sector": "Technology",              "market": "NYSE",   "asset_type": "stock"},
    {"ticker": "IBM",     "name": "IBM Corp.",                "sector": "Technology",              "market": "NYSE",   "asset_type": "stock"},
    {"ticker": "QCOM",    "name": "Qualcomm Inc.",            "sector": "Technology",              "market": "NASDAQ", "asset_type": "stock"},
    {"ticker": "NICE.TA", "name": "NICE Systems",             "sector": "Technology",              "market": "TASE",   "asset_type": "stock"},

    # ── Financials ───────────────────────────────────────────────────
    {"ticker": "JPM",     "name": "JPMorgan Chase",           "sector": "Financials",              "market": "NYSE",   "asset_type": "stock"},
    {"ticker": "BAC",     "name": "Bank of America",          "sector": "Financials",              "market": "NYSE",   "asset_type": "stock"},
    {"ticker": "GS",      "name": "Goldman Sachs",            "sector": "Financials",              "market": "NYSE",   "asset_type": "stock"},
    {"ticker": "MS",      "name": "Morgan Stanley",           "sector": "Financials",              "market": "NYSE",   "asset_type": "stock"},
    {"ticker": "V",       "name": "Visa Inc.",                "sector": "Financials",              "market": "NYSE",   "asset_type": "stock"},
    {"ticker": "MA",      "name": "Mastercard Inc.",          "sector": "Financials",              "market": "NYSE",   "asset_type": "stock"},
    {"ticker": "BRK-B",   "name": "Berkshire Hathaway",       "sector": "Financials",              "market": "NYSE",   "asset_type": "stock"},
    {"ticker": "LUMI.TA", "name": "Bank Leumi",               "sector": "Financials",              "market": "TASE",   "asset_type": "stock"},
    {"ticker": "POLI.TA", "name": "Bank Hapoalim",            "sector": "Financials",              "market": "TASE",   "asset_type": "stock"},

    # ── Healthcare ───────────────────────────────────────────────────
    {"ticker": "JNJ",     "name": "Johnson & Johnson",        "sector": "Healthcare",              "market": "NYSE",   "asset_type": "stock"},
    {"ticker": "PFE",     "name": "Pfizer Inc.",              "sector": "Healthcare",              "market": "NYSE",   "asset_type": "stock"},
    {"ticker": "UNH",     "name": "UnitedHealth Group",       "sector": "Healthcare",              "market": "NYSE",   "asset_type": "stock"},
    {"ticker": "ABT",     "name": "Abbott Laboratories",      "sector": "Healthcare",              "market": "NYSE",   "asset_type": "stock"},
    {"ticker": "MRK",     "name": "Merck & Co.",              "sector": "Healthcare",              "market": "NYSE",   "asset_type": "stock"},
    {"ticker": "AMGN",    "name": "Amgen Inc.",               "sector": "Healthcare",              "market": "NASDAQ", "asset_type": "stock"},
    {"ticker": "GILD",    "name": "Gilead Sciences",          "sector": "Healthcare",              "market": "NASDAQ", "asset_type": "stock"},
    {"ticker": "TEVA.TA", "name": "Teva Pharmaceutical",      "sector": "Healthcare",              "market": "TASE",   "asset_type": "stock"},

    # ── Energy ───────────────────────────────────────────────────────
    {"ticker": "XOM",     "name": "ExxonMobil Corp.",         "sector": "Energy",                  "market": "NYSE",   "asset_type": "stock"},
    {"ticker": "CVX",     "name": "Chevron Corp.",            "sector": "Energy",                  "market": "NYSE",   "asset_type": "stock"},
    {"ticker": "COP",     "name": "ConocoPhillips",           "sector": "Energy",                  "market": "NYSE",   "asset_type": "stock"},
    {"ticker": "DLEKG.TA","name": "Delek Group",              "sector": "Energy",                  "market": "TASE",   "asset_type": "stock"},

    # ── Materials ────────────────────────────────────────────────────
    {"ticker": "ICL.TA",  "name": "ICL Group",                "sector": "Materials",               "market": "TASE",   "asset_type": "stock"},
    {"ticker": "FCX",     "name": "Freeport-McMoRan",         "sector": "Materials",               "market": "NYSE",   "asset_type": "stock"},
    {"ticker": "NEM",     "name": "Newmont Corp.",            "sector": "Materials",               "market": "NYSE",   "asset_type": "stock"},

    # ── Consumer Discretionary ───────────────────────────────────────
    {"ticker": "AMZN",    "name": "Amazon.com",               "sector": "Consumer Discretionary",  "market": "NASDAQ", "asset_type": "stock"},
    {"ticker": "TSLA",    "name": "Tesla Inc.",               "sector": "Consumer Discretionary",  "market": "NASDAQ", "asset_type": "stock"},
    {"ticker": "MCD",     "name": "McDonald's Corp.",         "sector": "Consumer Discretionary",  "market": "NYSE",   "asset_type": "stock"},
    {"ticker": "NKE",     "name": "Nike Inc.",                "sector": "Consumer Discretionary",  "market": "NYSE",   "asset_type": "stock"},
    {"ticker": "SBUX",    "name": "Starbucks Corp.",          "sector": "Consumer Discretionary",  "market": "NASDAQ", "asset_type": "stock"},
    {"ticker": "DIS",     "name": "Walt Disney Co.",          "sector": "Consumer Discretionary",  "market": "NYSE",   "asset_type": "stock"},

    # ── Consumer Staples ─────────────────────────────────────────────
    {"ticker": "WMT",     "name": "Walmart Inc.",             "sector": "Consumer Staples",        "market": "NYSE",   "asset_type": "stock"},
    {"ticker": "COST",    "name": "Costco Wholesale",         "sector": "Consumer Staples",        "market": "NASDAQ", "asset_type": "stock"},
    {"ticker": "KO",      "name": "Coca-Cola Co.",            "sector": "Consumer Staples",        "market": "NYSE",   "asset_type": "stock"},
    {"ticker": "PG",      "name": "Procter & Gamble",         "sector": "Consumer Staples",        "market": "NYSE",   "asset_type": "stock"},

    # ── Industrials ──────────────────────────────────────────────────
    {"ticker": "CAT",     "name": "Caterpillar Inc.",         "sector": "Industrials",             "market": "NYSE",   "asset_type": "stock"},
    {"ticker": "GE",      "name": "GE Aerospace",             "sector": "Industrials",             "market": "NYSE",   "asset_type": "stock"},
    {"ticker": "HON",     "name": "Honeywell Intl.",          "sector": "Industrials",             "market": "NASDAQ", "asset_type": "stock"},
    {"ticker": "BA",      "name": "Boeing Co.",               "sector": "Industrials",             "market": "NYSE",   "asset_type": "stock"},
    {"ticker": "LMT",     "name": "Lockheed Martin",          "sector": "Industrials",             "market": "NYSE",   "asset_type": "stock"},
    {"ticker": "ESLT.TA", "name": "Elbit Systems",            "sector": "Industrials",             "market": "TASE",   "asset_type": "stock"},

    # ── Communication Services ───────────────────────────────────────
    {"ticker": "NFLX",    "name": "Netflix Inc.",             "sector": "Communication Services",  "market": "NASDAQ", "asset_type": "stock"},
    {"ticker": "T",       "name": "AT&T Inc.",                "sector": "Communication Services",  "market": "NYSE",   "asset_type": "stock"},
    {"ticker": "VZ",      "name": "Verizon Comm.",            "sector": "Communication Services",  "market": "NYSE",   "asset_type": "stock"},
    {"ticker": "BEZQ.TA", "name": "Bezeq",                    "sector": "Communication Services",  "market": "TASE",   "asset_type": "stock"},

    # ── Broad ETFs (stable/moderate tier candidates) ─────────────────
    {"ticker": "SPY",     "name": "SPDR S&P 500 ETF",         "sector": "Broad Market",            "market": "NYSE",   "asset_type": "etf"},
    {"ticker": "QQQ",     "name": "Invesco QQQ (NASDAQ-100)", "sector": "Technology",              "market": "NASDAQ", "asset_type": "etf"},
    {"ticker": "VTI",     "name": "Vanguard Total Market ETF","sector": "Broad Market",            "market": "NYSE",   "asset_type": "etf"},
    {"ticker": "VYM",     "name": "Vanguard High Dividend ETF","sector": "Broad Market",           "market": "NYSE",   "asset_type": "etf"},
    {"ticker": "AGG",     "name": "iShares Core Bond ETF",    "sector": "Fixed Income",            "market": "NYSE",   "asset_type": "etf"},
    {"ticker": "GLD",     "name": "SPDR Gold Shares",         "sector": "Commodities",             "market": "NYSE",   "asset_type": "etf"},
    {"ticker": "SCHD",    "name": "Schwab US Dividend ETF",   "sector": "Broad Market",            "market": "NYSE",   "asset_type": "etf"},
]

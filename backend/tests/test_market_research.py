"""Tests for market research screener scoring logic (pure logic — no network calls)."""
from app.market_research.screener import _score


class TestScoringLogic:
    def _info(self, **kwargs):
        """Build a minimal yfinance info dict."""
        base = {
            "currentPrice": 50.0,
            "targetMeanPrice": None,
            "recommendationMean": None,
            "forwardPE": None,
            "pegRatio": None,
            "revenueGrowth": None,
            "profitMargins": None,
            "returnOnEquity": None,
            "fiftyTwoWeekHigh": None,
            "fiftyTwoWeekLow": None,
        }
        base.update(kwargs)
        return base

    # ── Analyst conviction ────────────────────────────────────────────────────

    def test_high_upside_scores_max_analyst_pts(self):
        info = self._info(currentPrice=50.0, targetMeanPrice=75.0)  # 50% upside
        score = _score(info)
        assert score >= 25  # analyst conviction portion maxes at 25

    def test_no_target_no_analyst_pts(self):
        info = self._info(currentPrice=50.0, targetMeanPrice=None)
        assert _score(info) == 0.0

    def test_strong_buy_rating_adds_pts(self):
        base = self._info(currentPrice=50.0, targetMeanPrice=60.0)
        base["recommendationMean"] = 1.2  # strong buy
        strong_buy_score = _score(base)

        base2 = self._info(currentPrice=50.0, targetMeanPrice=60.0)
        base2["recommendationMean"] = 4.5  # near sell
        sell_score = _score(base2)

        assert strong_buy_score > sell_score

    def test_negative_upside_contributes_zero(self):
        info = self._info(currentPrice=80.0, targetMeanPrice=50.0)  # target below price
        assert _score(info) == 0.0

    # ── Valuation ─────────────────────────────────────────────────────────────

    def test_low_pe_scores_high(self):
        info = self._info(forwardPE=8.0)
        assert _score(info) >= 25  # max valuation pts

    def test_high_pe_scores_zero_valuation(self):
        info_low_pe = self._info(forwardPE=8.0)
        info_high_pe = self._info(forwardPE=60.0)
        assert _score(info_low_pe) > _score(info_high_pe)

    def test_negative_pe_ignored(self):
        info = self._info(forwardPE=-5.0)
        assert _score(info) == 0.0

    def test_peg_below_one_adds_pts(self):
        without_peg = self._info(forwardPE=15.0)
        with_peg = self._info(forwardPE=15.0, pegRatio=0.5)
        assert _score(with_peg) > _score(without_peg)

    # ── Growth ────────────────────────────────────────────────────────────────

    def test_high_revenue_growth_scores_max(self):
        info = self._info(revenueGrowth=0.30)  # 30% growth
        score = _score(info)
        assert score >= 25  # growth maxes at 25

    def test_negative_revenue_growth_scores_zero(self):
        info = self._info(revenueGrowth=-0.05)
        assert _score(info) == 0.0

    def test_growth_adds_to_total(self):
        without_growth = self._info()
        with_growth = self._info(revenueGrowth=0.15)
        assert _score(with_growth) > _score(without_growth)

    # ── Quality ───────────────────────────────────────────────────────────────

    def test_high_margin_scores_quality_pts(self):
        info = self._info(profitMargins=0.30)  # 30% net margin
        assert _score(info) >= 12

    def test_roe_adds_quality_pts(self):
        without_roe = self._info(profitMargins=0.15)
        with_roe = self._info(profitMargins=0.15, returnOnEquity=0.35)
        assert _score(with_roe) > _score(without_roe)

    def test_negative_margin_ignored(self):
        info = self._info(profitMargins=-0.10)
        assert _score(info) == 0.0

    # ── Entry point ───────────────────────────────────────────────────────────

    def test_near_52w_low_scores_entry_pts(self):
        # Price at 52w low → full entry score
        info = self._info(currentPrice=100.0, fiftyTwoWeekLow=99.0, fiftyTwoWeekHigh=150.0)
        near_low_score = _score(info)

        # Price at 52w high → zero entry score
        info2 = self._info(currentPrice=149.0, fiftyTwoWeekLow=99.0, fiftyTwoWeekHigh=150.0)
        near_high_score = _score(info2)

        assert near_low_score > near_high_score

    def test_score_capped_at_100(self):
        info = self._info(
            currentPrice=50.0,
            targetMeanPrice=100.0,
            recommendationMean=1.0,
            forwardPE=5.0,
            pegRatio=0.3,
            revenueGrowth=0.50,
            profitMargins=0.40,
            returnOnEquity=0.50,
            fiftyTwoWeekLow=49.0,
            fiftyTwoWeekHigh=100.0,
        )
        assert _score(info) == 100.0

    def test_empty_info_returns_zero(self):
        assert _score({}) == 0.0

    # ── Composite scenario ────────────────────────────────────────────────────

    def test_undervalued_quality_stock_ranks_high(self):
        """A cheap, growing, profitable stock near its 52w low should score >70."""
        info = self._info(
            currentPrice=48.0,
            targetMeanPrice=65.0,   # 35% upside
            recommendationMean=1.8,
            forwardPE=11.0,
            pegRatio=0.78,
            revenueGrowth=0.14,
            profitMargins=0.22,
            returnOnEquity=0.35,
            fiftyTwoWeekLow=44.0,
            fiftyTwoWeekHigh=70.0,
        )
        assert _score(info) >= 70

    def test_expensive_low_growth_ranks_low(self):
        """An expensive stock with minimal growth near its 52w high should score <30."""
        info = self._info(
            currentPrice=490.0,
            targetMeanPrice=500.0,  # 2% upside
            recommendationMean=3.5,  # hold/underperform
            forwardPE=55.0,
            revenueGrowth=0.02,
            profitMargins=0.08,
            fiftyTwoWeekLow=200.0,
            fiftyTwoWeekHigh=495.0,
        )
        assert _score(info) < 30

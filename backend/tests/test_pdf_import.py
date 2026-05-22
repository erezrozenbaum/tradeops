"""Tests for PDF import module — pure logic, no AI/HTTP calls."""
import json
from unittest.mock import MagicMock, patch


from app.pdf_import.extractor import _truncate_text, parse_pdf_statement
from app.pdf_import.schemas import ParsedHolding, PDFImportResult


class TestTruncateText:
    def test_short_text_unchanged(self):
        text = "hello world"
        assert _truncate_text(text, max_chars=100) == text

    def test_exact_length_unchanged(self):
        text = "x" * 100
        assert _truncate_text(text, max_chars=100) == text

    def test_long_text_truncated(self):
        text = "A" * 7000 + "B" * 5000
        result = _truncate_text(text, max_chars=12000)
        # Already ≤12000, no truncation needed (7000+5000=12000 exactly)
        assert result == text

    def test_over_limit_keeps_head_and_tail(self):
        text = "A" * 8000 + "MIDDLE" + "B" * 5000
        result = _truncate_text(text, max_chars=1000)
        assert result.startswith("A")
        assert result.endswith("B")
        assert "truncated" in result
        assert len(result) <= 1000 + 200   # allow for the truncation marker


class TestParsedHoldingSchema:
    def test_minimal_holding(self):
        h = ParsedHolding(name="Apple Inc", currency="USD")
        assert h.ticker is None
        assert h.quantity == 0.0
        assert h.asset_type == "stock"

    def test_full_holding(self):
        h = ParsedHolding(
            name="SPDR S&P 500 ETF",
            ticker="SPY",
            isin="US78462F1030",
            asset_type="etf",
            quantity=10.5,
            avg_buy_price=450.0,
            current_value=4800.0,
            currency="USD",
            notes="Core ETF position",
        )
        assert h.ticker == "SPY"
        assert h.quantity == 10.5
        assert h.current_value == 4800.0


class TestPDFImportResult:
    def test_empty_result(self):
        r = PDFImportResult(holdings=[], raw_text_length=0, pages_parsed=0)
        assert r.broker_name is None
        assert r.holdings == []

    def test_result_with_holdings(self):
        r = PDFImportResult(
            broker_name="Interactive Brokers",
            statement_date="2025-12-31",
            currency="USD",
            holdings=[
                ParsedHolding(name="Apple", ticker="AAPL", currency="USD", quantity=50),
                ParsedHolding(name="Microsoft", ticker="MSFT", currency="USD", quantity=25),
            ],
            raw_text_length=5000,
            pages_parsed=3,
        )
        assert len(r.holdings) == 2
        assert r.broker_name == "Interactive Brokers"


class TestParsePdfStatementMocked:
    """Test the full parse flow with mocked Claude and pypdf."""

    def _make_claude_response(self, holdings: list[dict]) -> MagicMock:
        payload = {
            "broker_name": "Test Broker",
            "statement_date": "2025-12-31",
            "currency": "USD",
            "holdings": holdings,
            "parse_notes": None,
        }
        msg = MagicMock()
        msg.content = [MagicMock(text=json.dumps(payload))]
        return msg

    @patch("app.pdf_import.extractor._extract_text_from_pdf")
    @patch("anthropic.Anthropic")
    def test_successful_parse(self, mock_anthropic_cls, mock_extract):
        mock_extract.return_value = ("Statement text here with holdings", 2)
        client = MagicMock()
        mock_anthropic_cls.return_value = client
        client.messages.create.return_value = self._make_claude_response([
            {"name": "Apple Inc", "ticker": "AAPL", "isin": None, "asset_type": "stock",
             "quantity": 10, "avg_buy_price": 150.0, "current_value": 1800.0, "currency": "USD", "notes": None},
        ])

        result = parse_pdf_statement(b"fake-pdf")
        assert result.broker_name == "Test Broker"
        assert len(result.holdings) == 1
        assert result.holdings[0].ticker == "AAPL"
        assert result.holdings[0].quantity == 10.0

    @patch("app.pdf_import.extractor._extract_text_from_pdf")
    def test_empty_pdf_no_ai_call(self, mock_extract):
        mock_extract.return_value = ("   ", 1)
        result = parse_pdf_statement(b"fake-pdf")
        assert result.holdings == []
        assert "No extractable text" in (result.parse_notes or "")

    @patch("app.pdf_import.extractor._extract_text_from_pdf")
    @patch("anthropic.Anthropic")
    def test_malformed_ai_response_returns_empty(self, mock_anthropic_cls, mock_extract):
        mock_extract.return_value = ("Some text", 1)
        client = MagicMock()
        mock_anthropic_cls.return_value = client
        msg = MagicMock()
        msg.content = [MagicMock(text="not valid json at all")]
        client.messages.create.return_value = msg

        result = parse_pdf_statement(b"fake-pdf")
        assert result.holdings == []
        assert "AI parsing failed" in (result.parse_notes or "")

    @patch("app.pdf_import.extractor._extract_text_from_pdf")
    @patch("anthropic.Anthropic")
    def test_skips_malformed_holdings(self, mock_anthropic_cls, mock_extract):
        mock_extract.return_value = ("text", 1)
        client = MagicMock()
        mock_anthropic_cls.return_value = client
        client.messages.create.return_value = self._make_claude_response([
            {"name": "Valid", "ticker": "V", "asset_type": "stock",
             "quantity": 5, "avg_buy_price": 100.0, "current_value": 550.0, "currency": "USD"},
            {"name": None, "ticker": "BAD", "quantity": "not-a-number", "currency": "USD"},  # malformed
        ])
        result = parse_pdf_statement(b"fake")
        # Valid holding should be included, malformed should be skipped
        assert len(result.holdings) >= 1
        assert result.holdings[0].ticker == "V"

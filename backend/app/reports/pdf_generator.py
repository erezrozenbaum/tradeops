"""Professional client report PDF generator using reportlab."""
from __future__ import annotations

import io
from datetime import datetime, timezone
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak,
)
from reportlab.lib.enums import TA_CENTER, TA_RIGHT

# ── Palette ────────────────────────────────────────────────────────────────

_NAVY   = colors.HexColor("#0f172a")
_BLUE   = colors.HexColor("#3b82f6")
_GREEN  = colors.HexColor("#22c55e")
_RED    = colors.HexColor("#ef4444")
_AMBER  = colors.HexColor("#f59e0b")
_MUTED  = colors.HexColor("#64748b")
_LIGHT  = colors.HexColor("#f8fafc")
_BORDER = colors.HexColor("#e2e8f0")
_ALT    = colors.HexColor("#f1f5f9")
_WHITE  = colors.white

# ── Styles ─────────────────────────────────────────────────────────────────

def _styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "title", parent=base["Title"],
            fontSize=28, textColor=_WHITE, alignment=TA_CENTER, spaceAfter=4,
        ),
        "subtitle": ParagraphStyle(
            "subtitle", parent=base["Normal"],
            fontSize=12, textColor=colors.HexColor("#94a3b8"), alignment=TA_CENTER, spaceAfter=2,
        ),
        "section": ParagraphStyle(
            "section", parent=base["Heading2"],
            fontSize=13, textColor=_NAVY, fontName="Helvetica-Bold",
            spaceBefore=14, spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "body", parent=base["Normal"],
            fontSize=9, textColor=_NAVY, leading=14,
        ),
        "small": ParagraphStyle(
            "small", parent=base["Normal"],
            fontSize=7.5, textColor=_MUTED, leading=12,
        ),
        "disclaimer": ParagraphStyle(
            "disclaimer", parent=base["Normal"],
            fontSize=7, textColor=_MUTED, leading=11, spaceBefore=8,
        ),
        "right": ParagraphStyle(
            "right", parent=base["Normal"],
            fontSize=9, textColor=_NAVY, alignment=TA_RIGHT,
        ),
    }


def _value_colour(v: float | None) -> colors.Color:
    if v is None:
        return _MUTED
    return _GREEN if v >= 0 else _RED


def _pct(v: float | None, decimals: int = 1) -> str:
    if v is None:
        return "—"
    sign = "+" if v >= 0 else ""
    return f"{sign}{v:.{decimals}f}%"


def _money(v: float | None, ccy: str = "") -> str:
    if v is None:
        return "—"
    prefix = f"{ccy} " if ccy else ""
    if abs(v) >= 1_000_000:
        return f"{prefix}{v / 1_000_000:.2f}M"
    if abs(v) >= 1_000:
        return f"{prefix}{v:,.0f}"
    return f"{prefix}{v:.2f}"


# ── Table helpers ──────────────────────────────────────────────────────────

_BASE_TABLE_STYLE = [
    ("BACKGROUND",  (0, 0), (-1, 0), _NAVY),
    ("TEXTCOLOR",   (0, 0), (-1, 0), _WHITE),
    ("FONTNAME",    (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTSIZE",    (0, 0), (-1, 0), 8),
    ("ALIGN",       (0, 0), (-1, 0), "CENTER"),
    ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
    ("TOPPADDING",  (0, 0), (-1, 0), 6),
    ("FONTNAME",    (0, 1), (-1, -1), "Helvetica"),
    ("FONTSIZE",    (0, 1), (-1, -1), 8),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [_WHITE, _ALT]),
    ("GRID",        (0, 0), (-1, -1), 0.4, _BORDER),
    ("VALIGN",      (0, 0), (-1, -1), "MIDDLE"),
    ("TOPPADDING",  (0, 1), (-1, -1), 4),
    ("BOTTOMPADDING", (0, 1), (-1, -1), 4),
]


def _table(data: list[list], col_widths: list[float], extra_style: list | None = None) -> Table:
    style = list(_BASE_TABLE_STYLE)
    if extra_style:
        style.extend(extra_style)
    return Table(data, colWidths=col_widths, style=TableStyle(style), repeatRows=1)


# ── Cover page ─────────────────────────────────────────────────────────────

def _cover(story: list, investor_name: str, period_label: str, currency: str, s: dict):
    # Dark background header block via a 1-row table
    cover_data = [[Paragraph("TradeOps AI", s["title"])]]
    cover_tbl = Table(
        cover_data,
        colWidths=[16 * cm],
        style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), _NAVY),
            ("TOPPADDING",  (0, 0), (-1, -1), 30),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 30),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ]),
    )
    story.append(cover_tbl)
    story.append(Spacer(1, 0.3 * cm))

    subtitle_data = [[Paragraph("Professional Portfolio Report", s["subtitle"])]]
    sub_tbl = Table(
        subtitle_data,
        colWidths=[16 * cm],
        style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#1e293b")),
            ("TOPPADDING",  (0, 0), (-1, -1), 12),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ]),
    )
    story.append(sub_tbl)
    story.append(Spacer(1, 1 * cm))

    now = datetime.now(timezone.utc)
    meta = [
        ["Prepared for", investor_name],
        ["Report period", period_label],
        ["Base currency", currency],
        ["Generated", now.strftime("%B %d, %Y at %H:%M UTC")],
    ]
    meta_tbl = Table(
        meta,
        colWidths=[4 * cm, 12 * cm],
        style=TableStyle([
            ("FONTNAME",  (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTNAME",  (1, 0), (1, -1), "Helvetica"),
            ("FONTSIZE",  (0, 0), (-1, -1), 10),
            ("TEXTCOLOR", (0, 0), (0, -1), _MUTED),
            ("TEXTCOLOR", (1, 0), (1, -1), _NAVY),
            ("TOPPADDING",  (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LINEBELOW", (0, 0), (-1, -2), 0.3, _BORDER),
            ("VALIGN",    (0, 0), (-1, -1), "MIDDLE"),
        ]),
    )
    story.append(meta_tbl)
    story.append(Spacer(1, 0.5 * cm))
    story.append(HRFlowable(width="100%", thickness=1, color=_BLUE, spaceAfter=6))
    story.append(Paragraph(
        "This report is generated automatically by TradeOps AI and is for informational purposes only. "
        "It does not constitute financial advice. Past performance is not a guarantee of future results.",
        s["disclaimer"],
    ))
    story.append(PageBreak())


# ── Section: Portfolio overview ────────────────────────────────────────────

def _portfolio_overview(story: list, portfolio: Any, s: dict):
    story.append(Paragraph("Portfolio Overview", s["section"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=_BORDER, spaceAfter=8))

    ccy = portfolio.base_currency
    total = portfolio.total_current_value
    cost  = portfolio.total_cost_basis
    pnl   = portfolio.total_unrealized_pnl
    pnl_pct = (pnl / cost * 100) if cost else 0

    summary = [
        ["Portfolio Value", "Cost Basis", "Unrealized P&L", "P&L %"],
        [_money(total, ccy), _money(cost, ccy), _money(pnl, ccy), _pct(pnl_pct)],
    ]
    extra = [
        ("ALIGN",      (0, 1), (-1, 1), "CENTER"),
        ("FONTNAME",   (0, 1), (-1, 1), "Helvetica-Bold"),
        ("FONTSIZE",   (0, 1), (-1, 1), 11),
        ("TEXTCOLOR",  (2, 1), (2, 1), _value_colour(pnl)),
        ("TEXTCOLOR",  (3, 1), (3, 1), _value_colour(pnl_pct)),
        ("TOPPADDING", (0, 1), (-1, 1), 10),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 10),
    ]
    story.append(_table(summary, [4 * cm] * 4, extra))
    story.append(Spacer(1, 0.4 * cm))

    # Holdings table (all accounts combined, sorted by value desc)
    all_holdings = [h for acc in portfolio.accounts for h in acc.holdings]
    all_holdings.sort(key=lambda h: h.current_value or 0, reverse=True)

    if all_holdings:
        story.append(Paragraph("Holdings", s["section"]))
        story.append(HRFlowable(width="100%", thickness=0.5, color=_BORDER, spaceAfter=8))
        rows = [["#", "Name", "Ticker", "Type", "Value", "Weight %", "P&L %"]]
        for i, h in enumerate(all_holdings[:30], 1):
            rows.append([
                str(i),
                (h.name or "")[:32],
                h.ticker or "—",
                h.asset_type or "—",
                _money(h.current_value, ccy),
                f"{h.weight_pct:.1f}%" if h.weight_pct else "—",
                _pct(h.unrealized_pnl_pct),
            ])
        extra_h = [
            ("ALIGN", (0, 1), (0, -1), "CENTER"),
            ("ALIGN", (4, 1), (6, -1), "RIGHT"),
        ]
        for i, h in enumerate(all_holdings[:30], 1):
            col = _value_colour(h.unrealized_pnl_pct)
            extra_h.append(("TEXTCOLOR", (6, i), (6, i), col))
        story.append(_table(rows, [0.6*cm, 5.2*cm, 1.5*cm, 2*cm, 2.5*cm, 1.8*cm, 1.8*cm], extra_h))

    story.append(PageBreak())


# ── Section: Performance metrics ───────────────────────────────────────────

def _performance(story: list, analytics: Any, attribution: Any, s: dict):
    story.append(Paragraph("Performance Analytics", s["section"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=_BORDER, spaceAfter=8))

    metrics = [
        ["Metric", "Value", "Metric", "Value"],
        ["Total Return", _pct(analytics.total_return_pct),
         "Annual Return", _pct(analytics.annual_return_pct)],
        ["Max Drawdown", f"-{analytics.max_drawdown_pct:.1f}%",
         "Current Drawdown", f"-{analytics.current_drawdown_pct:.1f}%"],
        ["Sharpe Ratio", fmt(analytics.sharpe_ratio),
         "Sortino Ratio", fmt(analytics.sortino_ratio)],
        ["Volatility (ann.)", _pct(analytics.annual_volatility_pct),
         "Data Points", str(analytics.data_points)],
        ["Best Period", _pct(analytics.best_period_pct),
         "Worst Period", _pct(analytics.worst_period_pct)],
        [f"Benchmark ({analytics.benchmark_ticker or 'SPY'})",
         _pct(analytics.benchmark_total_return_pct), "Period", f"{analytics.period_days}d"],
    ]

    def row_col(row: int, col: int, val: str) -> colors.Color:
        if col not in (1, 3):
            return _NAVY
        first_char = val[0] if val else ""
        if first_char == "+":
            return _GREEN
        if first_char == "-" and val != "—":
            return _RED
        return _NAVY

    extra_m = [("ALIGN", (1, 1), (1, -1), "RIGHT"), ("ALIGN", (3, 1), (3, -1), "RIGHT")]
    for r in range(1, len(metrics)):
        for c in (1, 3):
            extra_m.append(("TEXTCOLOR", (c, r), (c, r), row_col(r, c, metrics[r][c])))

    story.append(_table(metrics, [4.5*cm, 3*cm, 4.5*cm, 3*cm], extra_m))
    story.append(Spacer(1, 0.4 * cm))

    if attribution:
        # Rolling returns
        rr = attribution.rolling_returns
        rolling = [
            ["1-Month", "3-Month", "6-Month", "1-Year"],
            [_pct(rr.get("1m")), _pct(rr.get("3m")), _pct(rr.get("6m")), _pct(rr.get("1y"))],
        ]
        extra_r = [("ALIGN", (0, 1), (-1, 1), "CENTER"), ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold")]
        story.append(Paragraph("Rolling Returns", s["section"]))
        story.append(_table(rolling, [3.75*cm]*4, extra_r))
        story.append(Spacer(1, 0.4 * cm))

        # Top contributors
        if attribution.contributors:
            story.append(Paragraph("Top Contributors", s["section"]))
            rows = [["Name", "Ticker", "Weight %", "Return %", "Contribution %"]]
            for h in attribution.contributors[:5]:
                rows.append([
                    (h.name or "")[:28], h.ticker or "—",
                    f"{h.weight_pct:.1f}%", _pct(h.return_pct), _pct(h.contribution_pct),
                ])
            story.append(_table(rows, [5*cm, 2*cm, 2.5*cm, 2.5*cm, 3.4*cm]))

        if attribution.detractors:
            story.append(Spacer(1, 0.3 * cm))
            story.append(Paragraph("Top Detractors", s["section"]))
            rows = [["Name", "Ticker", "Weight %", "Return %", "Contribution %"]]
            for h in attribution.detractors[:5]:
                rows.append([
                    (h.name or "")[:28], h.ticker or "—",
                    f"{h.weight_pct:.1f}%", _pct(h.return_pct), _pct(h.contribution_pct),
                ])
            extra_d = [("TEXTCOLOR", (3, i), (4, i), _RED) for i in range(1, len(rows))]
            story.append(_table(rows, [5*cm, 2*cm, 2.5*cm, 2.5*cm, 3.4*cm], extra_d))

    story.append(PageBreak())


# ── Section: Risk / Stress test ────────────────────────────────────────────

def _risk(story: list, stress: Any, s: dict):
    story.append(Paragraph("Risk Analysis — Stress Test Scenarios", s["section"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=_BORDER, spaceAfter=8))

    ccy = stress.currency
    rows = [["Scenario", "Portfolio Impact", "Drawdown", "Recovery Est."]]
    for sc in stress.scenarios:
        rows.append([
            sc.name,
            _money(sc.impact_amount, ccy),
            _pct(sc.impact_pct),
            sc.estimated_recovery or "—",
        ])
    extra_s = [
        ("ALIGN", (1, 1), (2, -1), "RIGHT"),
        ("TEXTCOLOR", (1, i), (2, i), _RED) for i in range(1, len(rows))
    ]
    story.append(_table(rows, [6*cm, 3.5*cm, 3*cm, 3*cm], extra_s))
    story.append(Spacer(1, 0.4 * cm))

    if stress.monte_carlo:
        mc = stress.monte_carlo
        story.append(Paragraph("Monte Carlo Projection", s["section"]))
        mc_data = [
            ["Scenario", "Projected Value", "Growth"],
            ["Pessimistic (P10)", _money(mc.p10, ccy), _pct(((mc.p10 - stress.current_value) / stress.current_value * 100) if stress.current_value else None)],
            ["Base Case (P50)",   _money(mc.p50, ccy), _pct(((mc.p50 - stress.current_value) / stress.current_value * 100) if stress.current_value else None)],
            ["Optimistic (P90)", _money(mc.p90, ccy), _pct(((mc.p90 - stress.current_value) / stress.current_value * 100) if stress.current_value else None)],
        ]
        extra_mc = [
            ("ALIGN", (1, 1), (2, -1), "RIGHT"),
            ("TEXTCOLOR", (1, 1), (2, 1), _RED),
            ("TEXTCOLOR", (1, 2), (2, 2), _NAVY),
            ("TEXTCOLOR", (1, 3), (2, 3), _GREEN),
            ("FONTNAME",  (0, 2), (-1, 2), "Helvetica-Bold"),
        ]
        story.append(_table(mc_data, [7*cm, 4*cm, 4.5*cm], extra_mc))
        story.append(Paragraph(
            f"Projection horizon: {mc.years} years. Based on 1,000 Monte Carlo simulations "
            "using historical volatility. P10/P50/P90 = 10th/50th/90th percentile outcomes.",
            s["small"],
        ))

    story.append(PageBreak())


# ── Section: Tax summary ───────────────────────────────────────────────────

def _tax(story: list, tax: Any, s: dict):
    story.append(Paragraph("Tax-Loss Harvesting Summary", s["section"]))
    story.append(HRFlowable(width="100%", thickness=0.5, color=_BORDER, spaceAfter=8))

    ccy = tax.currency
    summary = [
        ["Total Harvestable Loss", "Estimated Tax Saving", "CGT Rate", "Opportunities"],
        [
            _money(tax.total_harvestable_loss, ccy),
            _money(tax.total_estimated_tax_saving, ccy),
            f"{tax.capital_gains_rate_pct:.1f}%",
            str(len(tax.harvest_opportunities)),
        ],
    ]
    extra_s = [
        ("ALIGN",   (0, 1), (-1, 1), "CENTER"),
        ("FONTNAME",(0, 1), (-1, 1), "Helvetica-Bold"),
        ("FONTSIZE",(0, 1), (-1, 1), 11),
        ("TEXTCOLOR", (0, 1), (1, 1), _RED),
        ("TEXTCOLOR", (2, 1), (3, 1), _GREEN),
    ]
    story.append(_table(summary, [4*cm]*4, extra_s))
    story.append(Spacer(1, 0.4 * cm))

    if tax.harvest_opportunities:
        story.append(Paragraph("Harvest Candidates", s["section"]))
        rows = [["Name", "Ticker", "Holding Days", "Term", "Loss", "Loss %", "Est. Saving"]]
        for op in tax.harvest_opportunities[:10]:
            term = "Short" if op.is_short_term else "Long"
            rows.append([
                (op.name or "")[:26],
                op.ticker or "—",
                str(op.holding_days) if op.holding_days is not None else "—",
                term,
                _money(op.unrealized_loss, ccy),
                _pct(op.unrealized_loss_pct),
                _money(op.estimated_tax_saving, ccy),
            ])
        extra_h = [
            ("ALIGN",  (2, 1), (6, -1), "RIGHT"),
            ("TEXTCOLOR", (4, i), (5, i), _RED) for i in range(1, len(rows))
        ]
        story.append(_table(rows, [4*cm, 1.8*cm, 2*cm, 1.5*cm, 2*cm, 1.8*cm, 2.3*cm], extra_h))

    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph(
        "Tax-loss harvesting involves selling positions at a loss to offset capital gains. "
        "Wash-sale rules (30-day window) apply. Consult a qualified tax advisor before acting on any of the above.",
        s["disclaimer"],
    ))


# ── Public API ─────────────────────────────────────────────────────────────

def fmt(v: float | None, decimals: int = 2) -> str:
    if v is None:
        return "—"
    return f"{v:.{decimals}f}"


def generate_pdf(
    investor_name: str,
    period: str,
    portfolio: Any,
    analytics: Any,
    attribution: Any | None,
    stress: Any | None,
    tax: Any | None,
) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        rightMargin=1.5 * cm,
        leftMargin=1.5 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
        title=f"TradeOps Portfolio Report — {investor_name}",
        author="TradeOps AI",
    )

    s = _styles()
    story: list = []
    ccy = portfolio.base_currency if portfolio else "USD"
    period_label = {"monthly": "Monthly Report", "quarterly": "Quarterly Report"}.get(period, "Portfolio Report")

    _cover(story, investor_name, period_label, ccy, s)

    if portfolio:
        _portfolio_overview(story, portfolio, s)

    if analytics:
        _performance(story, analytics, attribution, s)

    if stress:
        _risk(story, stress, s)

    if tax and tax.harvest_opportunities:
        _tax(story, tax, s)

    doc.build(story)
    return buf.getvalue()

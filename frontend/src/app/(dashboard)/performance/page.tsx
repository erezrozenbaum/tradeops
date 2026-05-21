"use client";

import { useEffect, useState, useCallback } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, BarChart2, AlertTriangle,
  Activity, Award, Calendar, RefreshCw, GitBranch, ShieldAlert, Scissors, FileDown,
  Zap, Scale,
} from "lucide-react";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { StatCard } from "@/components/ui/stat-card";
import { GlowChart, CHART_COLORS, AXIS_PROPS, GRID_PROPS, TOOLTIP_STYLE, TOOLTIP_LABEL_STYLE } from "@/components/ui/glow-chart";
import { formatCurrency } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

interface SnapshotPoint {
  snapshot_at: string;
  total_value: number;
  cost_basis: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  currency: string;
}

interface HistoryResult {
  investor_id: string;
  snapshots: SnapshotPoint[];
}

interface BenchmarkPoint {
  date: string;
  cumulative_return_pct: number;
}

interface CorrelationPair {
  ticker_a: string;
  ticker_b: string;
  correlation: number;
}

interface SectorConcentration {
  sector: string;
  weight_pct: number;
  tickers: string[];
  is_concentrated: boolean;
}

interface ConcentrationRisk {
  sector_concentrations: SectorConcentration[];
  highly_correlated_pairs: CorrelationPair[];
  risk_score: number;
  warnings: string[];
}

interface CorrelationResult {
  tickers: string[];
  matrix: CorrelationPair[];
  concentration_risk: ConcentrationRisk;
  lookback_days: number;
  data_quality: string;
}

interface PerformanceAnalytics {
  investor_id: string;
  currency: string;
  period_days: number;
  data_points: number;
  total_return_pct: number;
  annual_return_pct: number | null;
  max_drawdown_pct: number;
  current_drawdown_pct: number;
  sharpe_ratio: number | null;
  sortino_ratio: number | null;
  annual_volatility_pct: number | null;
  best_period_pct: number | null;
  worst_period_pct: number | null;
  benchmark_ticker: string | null;
  benchmark_total_return_pct: number | null;
  benchmark_series: BenchmarkPoint[];
  beta: number | null;
  mwr_pct: number | null;
  computed_at: string;
}

interface HoldingContribution {
  holding_id: string;
  name: string;
  ticker: string | null;
  asset_type: string;
  weight_pct: number;
  return_pct: number;
  contribution_pct: number;
  cagr_pct: number | null;
}

interface AttributionResult {
  investor_id: string;
  currency: string;
  total_return_pct: number;
  benchmark_ticker: string;
  benchmark_return_pct: number | null;
  alpha_pct: number | null;
  rolling_returns: { "1m": number | null; "3m": number | null; "6m": number | null; "1y": number | null };
  contributors: HoldingContribution[];
  detractors: HoldingContribution[];
  computed_at: string;
}

interface HarvestOpportunity {
  holding_id: string;
  name: string;
  ticker: string | null;
  asset_type: string;
  account_name: string;
  unrealized_loss: number;
  unrealized_loss_pct: number;
  holding_days: number | null;
  holding_period_label: string | null;
  is_short_term: boolean;
  wash_sale_risk: boolean;
  estimated_tax_saving: number;
  suggested_replacement: string | null;
  replacement_rationale: string | null;
}

interface LazyPortfolioComparison {
  investor_id: string;
  currency: string;
  data_gate_passed: boolean;
  snapshot_days: number;
  portfolio_return_pct: number;
  portfolio_sharpe: number | null;
  lazy_return_pct: number | null;
  lazy_sharpe: number | null;
  lazy_composition: string;
  complexity_premium_pct: number | null;
  risk_adjusted_premium: number | null;
  verdict: string;
  computed_at: string;
}

interface GainOffset {
  holding_id: string;
  name: string;
  ticker: string | null;
  asset_type: string;
  unrealized_gain: number;
  unrealized_gain_pct: number;
}

interface TaxOpportunityResult {
  investor_id: string;
  currency: string;
  harvest_opportunities: HarvestOpportunity[];
  gain_offsets: GainOffset[];
  total_harvestable_loss: number;
  total_estimated_tax_saving: number;
  capital_gains_rate_pct: number;
  min_loss_threshold_pct: number;
  computed_at: string;
}

// ── Period selector ────────────────────────────────────────────────────────

const PERIODS = [
  { label: "1M", value: "1m" },
  { label: "3M", value: "3m" },
  { label: "6M", value: "6m" },
  { label: "1Y", value: "1y" },
  { label: "All", value: "all" },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function pct(v: number | null, decimals = 1): string {
  if (v === null || v === undefined) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(decimals)}%`;
}

function fmt(v: number | null, decimals = 2): string {
  if (v === null || v === undefined) return "—";
  return v.toFixed(decimals);
}

// ── Chart tooltip ──────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ ...TOOLTIP_STYLE }}>
      <p style={{ ...TOOLTIP_LABEL_STYLE }}>{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
          <span style={{ color: "#94a3b8" }}>{p.name}:</span>
          <span style={{ fontWeight: 600, color: p.color }}>
            {p.dataKey === "return_pct" || p.dataKey === "bench_pct"
              ? `${p.value >= 0 ? "+" : ""}${Number(p.value).toFixed(2)}%`
              : p.value?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function PerformancePage() {
  const investorId = useInvestorId();
  const [period, setPeriod] = useState("3m");
  const [history, setHistory] = useState<HistoryResult | null>(null);
  const [analytics, setAnalytics] = useState<PerformanceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [correlation, setCorrelation] = useState<CorrelationResult | null>(null);
  const [attribution, setAttribution] = useState<AttributionResult | null>(null);
  const [taxOpps, setTaxOpps] = useState<TaxOpportunityResult | null>(null);
  const [lazyComparison, setLazyComparison] = useState<LazyPortfolioComparison | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const downloadPdf = useCallback(async (reportPeriod: "monthly" | "quarterly") => {
    if (!investorId) return;
    setPdfLoading(true);
    try {
      const res = await fetch(`/api/v1/investors/${investorId}/reports/pdf?period=${reportPeriod}`);
      if (!res.ok) throw new Error("Failed to generate report");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tradeops-report-${reportPeriod}-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail — no UI disruption for optional export
    } finally {
      setPdfLoading(false);
    }
  }, [investorId]);

  const load = useCallback(async () => {
    if (!investorId) return;
    setLoading(true);
    setError(null);
    try {
      const [hRes, aRes] = await Promise.all([
        fetch(`/api/v1/investors/${investorId}/portfolio/history?period=${period}`),
        fetch(`/api/v1/investors/${investorId}/portfolio/analytics?period=${period}`),
      ]);
      if (!hRes.ok || !aRes.ok) throw new Error("Failed to load performance data");
      const [h, a] = await Promise.all([hRes.json(), aRes.json()]);
      setHistory(h);
      setAnalytics(a);
    } catch (e: any) {
      setError(e.message || "Unable to load performance data");
    } finally {
      setLoading(false);
    }
  }, [investorId, period]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!investorId) return;
    fetch(`/api/v1/investors/${investorId}/portfolio/correlation`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setCorrelation(d); });
    fetch(`/api/v1/investors/${investorId}/portfolio/attribution`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setAttribution(d); });
    fetch(`/api/v1/investors/${investorId}/portfolio/tax-opportunities`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setTaxOpps(d); });
    fetch(`/api/v1/investors/${investorId}/portfolio/complexity-premium`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setLazyComparison(d); });
  }, [investorId]);

  // ── Build chart data ─────────────────────────────────────────────────────

  const snaps = history?.snapshots ?? [];
  const currency = snaps[0]?.currency ?? analytics?.currency ?? "USD";

  // Value chart (absolute portfolio value + cost basis)
  const valueChartData = snaps.map((s) => ({
    date: new Date(s.snapshot_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    value: s.total_value,
    cost: s.cost_basis,
    currency,
  }));

  // Return % chart (portfolio vs benchmark — both normalised to 0 at period start)
  const base = snaps[0]?.total_value ?? 0;
  const returnChartData = snaps.map((s, i) => {
    const dateStr = new Date(s.snapshot_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const returnPct = base > 0 ? ((s.total_value - base) / base) * 100 : 0;
    // Try to align benchmark by index (approximate)
    const bench = analytics?.benchmark_series;
    const benchPct = bench && bench.length > 0
      ? bench[Math.min(i, bench.length - 1)].cumulative_return_pct
      : null;
    return { date: dateStr, return_pct: returnPct, bench_pct: benchPct };
  });

  // ── Empty state ───────────────────────────────────────────────────────────
  const hasData = snaps.length >= 2;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6" />
            Performance
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Portfolio history · Risk-adjusted returns · Benchmark comparison
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Period selector */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  period === p.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <div className="relative group">
            <Button variant="outline" size="sm" disabled={pdfLoading}>
              <FileDown className={`h-3.5 w-3.5 mr-1.5 ${pdfLoading ? "animate-pulse" : ""}`} />
              {pdfLoading ? "Generating…" : "Export PDF"}
            </Button>
            {!pdfLoading && (
              <div className="absolute right-0 top-full mt-1 z-50 hidden group-hover:flex flex-col bg-card border border-border rounded-lg shadow-lg overflow-hidden min-w-[140px]">
                <button
                  onClick={() => downloadPdf("monthly")}
                  className="px-3 py-2 text-xs text-left hover:bg-muted transition-colors"
                >
                  Monthly Report
                </button>
                <button
                  onClick={() => downloadPdf("quarterly")}
                  className="px-3 py-2 text-xs text-left hover:bg-muted transition-colors"
                >
                  Quarterly Report
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-lg p-3">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* No data empty state */}
      {!loading && !error && !hasData && (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
            <BarChart2 className="h-12 w-12 text-muted-foreground/30" />
            <p className="font-medium text-muted-foreground">No performance history yet</p>
            <p className="text-sm text-muted-foreground/70 max-w-sm">
              Daily snapshots are captured automatically at 21:00 UTC after the price refresh.
              Your first snapshot will appear after the backend runs its next scheduled job,
              or immediately after you click "Refresh Prices" on the Investments page.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Key metric cards */}
      {analytics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard
            label="Total Return"
            value={pct(analytics.total_return_pct)}
            accent={analytics.total_return_pct >= 0 ? "emerald" : "red"}
            trend={analytics.total_return_pct >= 0 ? "up" : "down"}
            trendLabel={analytics.annual_return_pct !== null ? `${pct(analytics.annual_return_pct)} / yr` : undefined}
            sub={analytics.mwr_pct !== null ? `MWR: ${pct(analytics.mwr_pct)} / yr` : undefined}
            icon={analytics.total_return_pct >= 0
              ? <TrendingUp className="h-4 w-4" />
              : <TrendingDown className="h-4 w-4" />}
          />
          <StatCard
            label="Max Drawdown"
            value={`-${analytics.max_drawdown_pct.toFixed(1)}%`}
            accent={analytics.max_drawdown_pct < 10 ? "emerald" : "red"}
            trend={analytics.max_drawdown_pct < 10 ? "up" : "down"}
            sub={analytics.current_drawdown_pct > 0.5 ? `Currently -${analytics.current_drawdown_pct.toFixed(1)}%` : "At all-time high"}
            icon={<AlertTriangle className="h-4 w-4" />}
          />
          <StatCard
            label="Sharpe Ratio"
            value={analytics.sharpe_ratio !== null ? fmt(analytics.sharpe_ratio) : "—"}
            accent={analytics.sharpe_ratio !== null
              ? analytics.sharpe_ratio > 1 ? "emerald"
                : analytics.sharpe_ratio > 0 ? "amber"
                : "red"
              : "cyan"}
            trend={analytics.sharpe_ratio !== null
              ? analytics.sharpe_ratio > 1 ? "up"
                : analytics.sharpe_ratio > 0 ? "neutral"
                : "down"
              : undefined}
            sub={analytics.sharpe_ratio !== null
              ? analytics.sharpe_ratio > 1 ? "Good risk-adjusted"
                : analytics.sharpe_ratio > 0 ? "Positive, below 1"
                : "Below risk-free"
              : "Need more data"}
            icon={<Award className="h-4 w-4" />}
          />
          <StatCard
            label="Volatility"
            value={analytics.annual_volatility_pct !== null ? `${analytics.annual_volatility_pct.toFixed(1)}%` : "—"}
            accent="cyan"
            sub="Annualised std dev"
            icon={<Activity className="h-4 w-4" />}
          />
          <StatCard
            label={`vs ${analytics.benchmark_ticker === "^TA35" ? "TA-35" : "S&P 500"}`}
            value={analytics.benchmark_total_return_pct !== null
              ? pct(analytics.total_return_pct - analytics.benchmark_total_return_pct)
              : "—"}
            accent={analytics.benchmark_total_return_pct !== null
              ? analytics.total_return_pct > analytics.benchmark_total_return_pct ? "emerald" : "red"
              : "cyan"}
            trend={analytics.benchmark_total_return_pct !== null
              ? analytics.total_return_pct > analytics.benchmark_total_return_pct ? "up" : "down"
              : undefined}
            sub={analytics.benchmark_total_return_pct !== null
              ? `${analytics.benchmark_ticker ?? "SPY"}: ${pct(analytics.benchmark_total_return_pct)}`
              : "Benchmark unavailable"}
            icon={<BarChart2 className="h-4 w-4" />}
          />
          <StatCard
            label="Beta"
            value={analytics.beta !== null ? fmt(analytics.beta) : "—"}
            accent="cyan"
            sub={analytics.beta !== null
              ? analytics.beta > 1.2 ? "High market sensitivity"
                : analytics.beta < 0.8 ? "Defensive portfolio"
                : "Market-like sensitivity"
              : "Need more data"}
            icon={<Activity className="h-4 w-4" />}
          />
        </div>
      )}

      {/* Rolling Returns strip */}
      {attribution && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rolling Returns</span>
              {attribution.alpha_pct !== null && (
                <Badge
                  variant={attribution.alpha_pct >= 0 ? "success" : "danger"}
                  className="ml-auto text-xs"
                >
                  α {attribution.alpha_pct >= 0 ? "+" : ""}{attribution.alpha_pct.toFixed(2)}% vs {attribution.benchmark_ticker === "^TA35" ? "TA-35" : "S&P 500"}
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-4 gap-3">
              {(["1m", "3m", "6m", "1y"] as const).map((window) => {
                const val = attribution.rolling_returns[window];
                const isPos = val !== null && val >= 0;
                const isNeg = val !== null && val < 0;
                return (
                  <div key={window} className="text-center bg-muted/40 rounded-lg py-3 px-2">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">
                      {window === "1m" ? "1 Month" : window === "3m" ? "3 Months" : window === "6m" ? "6 Months" : "1 Year"}
                    </p>
                    <p className={`text-lg font-bold ${isPos ? "text-green-500" : isNeg ? "text-red-500" : "text-muted-foreground"}`}>
                      {val !== null ? pct(val) : "—"}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Attribution */}
      {attribution && (attribution.contributors.length > 0 || attribution.detractors.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top Contributors */}
          {attribution.contributors.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  Top Contributors
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {attribution.contributors.map((h) => (
                  <div key={h.holding_id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium truncate">{h.ticker ?? h.name}</span>
                        <span className="text-xs text-green-500 font-semibold ml-2 shrink-0">
                          +{h.contribution_pct.toFixed(2)}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-green-500"
                          style={{ width: `${Math.min(Math.abs(h.contribution_pct) * 10, 100)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {h.weight_pct.toFixed(1)}% weight · {pct(h.return_pct)} return
                        {h.cagr_pct !== null && ` · ${pct(h.cagr_pct)} CAGR`}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Top Detractors */}
          {attribution.detractors.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  Top Detractors
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {attribution.detractors.map((h) => (
                  <div key={h.holding_id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium truncate">{h.ticker ?? h.name}</span>
                        <span className="text-xs text-red-500 font-semibold ml-2 shrink-0">
                          {h.contribution_pct.toFixed(2)}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-red-500"
                          style={{ width: `${Math.min(Math.abs(h.contribution_pct) * 10, 100)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {h.weight_pct.toFixed(1)}% weight · {pct(h.return_pct)} return
                        {h.cagr_pct !== null && ` · ${pct(h.cagr_pct)} CAGR`}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {hasData && (
        <>
          {/* Portfolio value chart */}
          <GlowChart label="Portfolio Value" height={260} accentColor={CHART_COLORS.blue}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={valueChartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="grad-value" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.blue} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={CHART_COLORS.blue} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis dataKey="date" {...AXIS_PROPS} />
                <YAxis {...AXIS_PROPS} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#64748b" }} />
                <Area type="monotone" dataKey="value" name="Portfolio value"
                  stroke={CHART_COLORS.blue} fill="url(#grad-value)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="cost" name="Cost basis"
                  stroke="#4b5563" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </GlowChart>

          {/* Return vs benchmark chart */}
          {analytics?.benchmark_series && analytics.benchmark_series.length > 0 && (
            <GlowChart
              label={`Return vs ${analytics.benchmark_ticker === "^TA35" ? "TA-35" : "S&P 500"}`}
              height={220}
              accentColor={CHART_COLORS.amber}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={returnChartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid {...GRID_PROPS} />
                  <XAxis dataKey="date" {...AXIS_PROPS} />
                  <YAxis {...AXIS_PROPS} tickFormatter={(v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#64748b" }} />
                  <Line type="monotone" dataKey="return_pct" name="My portfolio"
                    stroke={CHART_COLORS.blue} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="bench_pct" name={analytics.benchmark_ticker === "^TA35" ? "TA-35" : "S&P 500 (SPY)"}
                    stroke={CHART_COLORS.amber} strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </GlowChart>
          )}

          {/* Risk details table */}
          {analytics && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Risk Detail</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-8 text-sm">
                  {[
                    { label: "Sortino Ratio", value: analytics.sortino_ratio !== null ? fmt(analytics.sortino_ratio) : "—" },
                    { label: "Best Single Period", value: pct(analytics.best_period_pct) },
                    { label: "Worst Single Period", value: pct(analytics.worst_period_pct) },
                    { label: "Period Tracked", value: `${analytics.period_days} days` },
                    { label: "Data Points", value: `${analytics.data_points} snapshots` },
                    { label: "Annualised Return", value: pct(analytics.annual_return_pct) },
                    { label: "Current Drawdown", value: analytics.current_drawdown_pct > 0.5 ? `-${analytics.current_drawdown_pct.toFixed(1)}%` : "At peak" },
                    { label: "SPY Total Return", value: pct(analytics.benchmark_total_return_pct) },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="font-medium mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Correlation Matrix + Concentration Risk */}
      {correlation && correlation.tickers.length >= 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Correlation heatmap */}
          {correlation.matrix.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <GitBranch className="h-4 w-4 text-primary" />
                  Correlation Matrix
                  <span className="text-xs font-normal text-muted-foreground ml-1">({correlation.lookback_days}d)</span>
                  {correlation.data_quality !== "full" && (
                    <Badge variant="warning" className="text-[10px] py-0 ml-auto">{correlation.data_quality} data</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="text-[11px] border-collapse">
                    <thead>
                      <tr>
                        <th className="w-10" />
                        {correlation.tickers.map(t => (
                          <th key={t} className="px-1 py-1 font-mono font-semibold text-muted-foreground text-center w-14">{t}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {correlation.tickers.map(rowTicker => (
                        <tr key={rowTicker}>
                          <td className="pr-2 font-mono font-semibold text-muted-foreground text-right">{rowTicker}</td>
                          {correlation.tickers.map(colTicker => {
                            if (rowTicker === colTicker) {
                              return (
                                <td key={colTicker} className="w-14 h-8 text-center font-bold text-[10px] rounded bg-primary/20 text-primary">1.00</td>
                              );
                            }
                            const pair = correlation.matrix.find(
                              p => (p.ticker_a === rowTicker && p.ticker_b === colTicker) ||
                                   (p.ticker_a === colTicker && p.ticker_b === rowTicker)
                            );
                            const c = pair?.correlation ?? null;
                            const bg = c === null ? "bg-muted" :
                              c > 0.8 ? "bg-red-200 dark:bg-red-900/40 text-red-700 dark:text-red-300" :
                              c > 0.5 ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" :
                              c > 0.2 ? "bg-muted" :
                              c > -0.2 ? "bg-blue-50 dark:bg-blue-900/20" :
                              "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300";
                            return (
                              <td key={colTicker} className={`w-14 h-8 text-center rounded text-[10px] ${bg}`}>
                                {c !== null ? c.toFixed(2) : "—"}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-200 dark:bg-red-900/40 inline-block" />High (&gt;0.8)</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-900/30 inline-block" />Moderate (0.5–0.8)</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 dark:bg-green-900/30 inline-block" />Negative (&lt;-0.2)</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Concentration Risk */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldAlert className="h-4 w-4 text-primary" />
                  Concentration Risk
                </CardTitle>
                <Badge
                  variant={correlation.concentration_risk.risk_score > 50 ? "danger" : correlation.concentration_risk.risk_score > 20 ? "warning" : "success"}
                  className="text-xs"
                >
                  Score: {correlation.concentration_risk.risk_score}/100
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {correlation.concentration_risk.warnings.length > 0 && (
                <div className="space-y-1.5">
                  {correlation.concentration_risk.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      {w}
                    </p>
                  ))}
                </div>
              )}
              {correlation.concentration_risk.sector_concentrations.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sector weights</p>
                  {correlation.concentration_risk.sector_concentrations.slice(0, 5).map(s => (
                    <div key={s.sector} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="capitalize font-medium">{s.sector}</span>
                        <span className={s.is_concentrated ? "text-amber-500 font-semibold" : "text-muted-foreground"}>
                          {s.weight_pct.toFixed(1)}%{s.is_concentrated ? " ⚠" : ""}
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${s.is_concentrated ? "bg-amber-500" : "bg-primary"}`}
                          style={{ width: `${Math.min(s.weight_pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {correlation.concentration_risk.warnings.length === 0 && (
                <p className="text-xs text-green-600 dark:text-green-400">No significant concentration issues detected.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tax-Loss Harvesting Opportunities */}
      {taxOpps && taxOpps.harvest_opportunities.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Scissors className="h-4 w-4 text-amber-500" />
                Tax-Loss Harvesting Opportunities
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="warning" className="text-xs">
                  {taxOpps.harvest_opportunities.length} candidate{taxOpps.harvest_opportunities.length > 1 ? "s" : ""}
                </Badge>
                <Badge variant="muted" className="text-xs">
                  {taxOpps.capital_gains_rate_pct}% CGT rate
                </Badge>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Holdings with unrealized loss &gt;{taxOpps.min_loss_threshold_pct}% that can offset capital gains and reduce your tax bill.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-muted/40 rounded-lg p-3 text-center">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Total Harvestable Loss</p>
                <p className="text-base font-bold text-red-500">
                  {formatCurrency(taxOpps.total_harvestable_loss, taxOpps.currency)}
                </p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3 text-center">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Estimated Tax Saving</p>
                <p className="text-base font-bold text-green-500">
                  {formatCurrency(taxOpps.total_estimated_tax_saving, taxOpps.currency)}
                </p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3 text-center sm:col-span-1 col-span-2">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Offsettable Gains</p>
                <p className="text-base font-bold text-foreground">{taxOpps.gain_offsets.length} holdings</p>
              </div>
            </div>

            {/* Harvest candidates table */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Harvest candidates</p>
              {taxOpps.harvest_opportunities.map((op) => (
                <div key={op.holding_id} className="flex items-start gap-3 p-3 border border-border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{op.ticker ?? op.name}</span>
                      {op.ticker && op.ticker !== op.name && (
                        <span className="text-xs text-muted-foreground truncate">{op.name}</span>
                      )}
                      <Badge
                        variant={op.is_short_term ? "warning" : "muted"}
                        className="text-[10px] py-0 shrink-0"
                      >
                        {op.holding_period_label ?? (op.is_short_term ? "Short-term" : "Long-term")}
                      </Badge>
                      {op.wash_sale_risk && (
                        <Badge variant="danger" className="text-[10px] py-0 shrink-0">
                          Wash-sale risk
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {op.account_name}
                    </p>
                    {op.suggested_replacement && (
                      <div className="flex items-start gap-1.5 mt-1.5 text-[11px] bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md px-2 py-1.5">
                        <span className="text-blue-600 dark:text-blue-400 font-semibold shrink-0">
                          Similar position: {op.suggested_replacement}
                        </span>
                        {op.replacement_rationale && (
                          <span className="text-muted-foreground">— {op.replacement_rationale}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-red-500">{op.unrealized_loss_pct.toFixed(1)}%</p>
                    <p className="text-[11px] text-muted-foreground">{formatCurrency(op.unrealized_loss, taxOpps.currency)}</p>
                    <p className="text-[11px] text-green-600 dark:text-green-400 mt-0.5">
                      saves {formatCurrency(op.estimated_tax_saving, taxOpps.currency)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Gain offsets */}
            {taxOpps.gain_offsets.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Holdings with gains to offset</p>
                <div className="flex flex-wrap gap-2">
                  {taxOpps.gain_offsets.map((g) => (
                    <div key={g.holding_id} className="flex items-center gap-1.5 text-xs bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-md px-2.5 py-1.5">
                      <span className="font-medium">{g.ticker ?? g.name}</span>
                      <span className="text-green-600 dark:text-green-400 font-semibold">
                        +{g.unrealized_gain_pct.toFixed(1)}%
                      </span>
                      <span className="text-muted-foreground">
                        {formatCurrency(g.unrealized_gain, taxOpps.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[10px] text-muted-foreground border-t border-border pt-3">
              Estimates use a {taxOpps.capital_gains_rate_pct}% capital gains rate based on your country. Not tax advice — consult a tax professional before acting. Wash-sale rules may defer (not eliminate) recognized losses.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Complexity Premium — Smart Benchmarking */}
      {lazyComparison && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Scale className="h-4 w-4 text-primary" />
                Complexity Premium — vs Lazy Portfolio
              </CardTitle>
              {lazyComparison.data_gate_passed && lazyComparison.complexity_premium_pct !== null && (
                <Badge
                  variant={lazyComparison.complexity_premium_pct >= 0 ? "success" : "danger"}
                  className="text-xs"
                >
                  {lazyComparison.complexity_premium_pct >= 0 ? "+" : ""}
                  {lazyComparison.complexity_premium_pct.toFixed(2)}% vs {lazyComparison.lazy_composition}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              How much did your active strategy earn above a dead-simple passive index?
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {!lazyComparison.data_gate_passed ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <Zap className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">{lazyComparison.verdict}</p>
              </div>
            ) : (
              <>
                {/* Return comparison grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-muted/40 rounded-lg p-3 text-center">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Your Return</p>
                    <p className={`text-lg font-bold ${lazyComparison.portfolio_return_pct >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {pct(lazyComparison.portfolio_return_pct)}
                    </p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3 text-center">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">{lazyComparison.lazy_composition}</p>
                    <p className={`text-lg font-bold ${(lazyComparison.lazy_return_pct ?? 0) >= 0 ? "text-amber-500" : "text-red-500"}`}>
                      {lazyComparison.lazy_return_pct !== null ? pct(lazyComparison.lazy_return_pct) : "—"}
                    </p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3 text-center">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Complexity Premium</p>
                    <p className={`text-lg font-bold ${(lazyComparison.complexity_premium_pct ?? 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {lazyComparison.complexity_premium_pct !== null
                        ? `${lazyComparison.complexity_premium_pct >= 0 ? "+" : ""}${lazyComparison.complexity_premium_pct.toFixed(2)}%`
                        : "—"}
                    </p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3 text-center">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1">Risk-Adj. Premium</p>
                    <p className={`text-lg font-bold ${(lazyComparison.risk_adjusted_premium ?? 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {lazyComparison.risk_adjusted_premium !== null
                        ? `${lazyComparison.risk_adjusted_premium >= 0 ? "+" : ""}${lazyComparison.risk_adjusted_premium.toFixed(2)}`
                        : "—"}
                    </p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">Sharpe delta</p>
                  </div>
                </div>

                {/* Sharpe comparison row */}
                {(lazyComparison.portfolio_sharpe !== null || lazyComparison.lazy_sharpe !== null) && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center justify-between text-xs bg-muted/30 rounded-lg px-3 py-2">
                      <span className="text-muted-foreground">Your Sharpe ratio</span>
                      <span className="font-semibold">{lazyComparison.portfolio_sharpe !== null ? fmt(lazyComparison.portfolio_sharpe) : "—"}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs bg-muted/30 rounded-lg px-3 py-2">
                      <span className="text-muted-foreground">60/40 est. Sharpe</span>
                      <span className="font-semibold">{lazyComparison.lazy_sharpe !== null ? fmt(lazyComparison.lazy_sharpe) : "—"}</span>
                    </div>
                  </div>
                )}

                {/* Verdict */}
                <div className={`rounded-lg px-4 py-3 text-sm font-medium border ${
                  (lazyComparison.complexity_premium_pct ?? 0) > 0.5
                    ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300"
                    : (lazyComparison.complexity_premium_pct ?? 0) < -0.5
                    ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300"
                    : "bg-muted/40 border-border text-foreground"
                }`}>
                  {lazyComparison.verdict}
                </div>

                <p className="text-[10px] text-muted-foreground">
                  Lazy portfolio: {lazyComparison.lazy_composition} (global equities + bonds). Return computed over {lazyComparison.snapshot_days} days.
                  Lazy Sharpe is estimated from a typical 60/40 portfolio volatility of ~10% annualised. Not investment advice.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
          Loading performance data…
        </div>
      )}
    </div>
  );
}

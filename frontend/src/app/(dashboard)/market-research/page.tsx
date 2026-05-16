"use client";

import { useState, useEffect } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Microscope,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Info,
  ArrowRight,
  Target,
  BarChart2,
  Bitcoin,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SectorInsight {
  sector: string;
  etf_ticker: string;
  performance_1m_pct: number | null;
  performance_3m_pct: number | null;
  performance_1y_pct: number | null;
  outlook: "bullish" | "neutral" | "bearish";
}

interface OpportunityPick {
  ticker: string;
  name: string;
  sector: string;
  asset_type: string;
  current_price: number | null;
  currency: string;
  analyst_target: number | null;
  upside_pct: number | null;
  risk_tier: "stable" | "moderate" | "high_opportunity";
  time_horizon_months: number;
  time_horizon_label: string;
  thesis: string;
  why_now: string;
  key_risk: string;
  suggested_allocation_pct: number | null;
  opportunity_score: number;
  key_metrics: {
    forward_pe: number | null;
    revenue_growth_pct: number | null;
    analyst_upside_pct: number | null;
    dividend_yield_pct: number | null;
    pct_from_52w_low: number | null;
    profit_margin_pct: number | null;
  };
}

interface StockCandidate {
  ticker: string;
  name: string;
  sector: string;
  market: string;
  asset_type: string;
  current_price: number | null;
  currency: string;
  analyst_upside_pct: number | null;
  forward_pe: number | null;
  revenue_growth_pct: number | null;
  profit_margin_pct: number | null;
  pct_from_52w_low: number | null;
  opportunity_score: number;
}

interface MarketResearchReport {
  investor_id: string;
  generated_at: string;
  market_overview: string;
  sector_insights: SectorInsight[];
  stable_picks: OpportunityPick[];
  moderate_picks: OpportunityPick[];
  opportunity_picks: OpportunityPick[];
  screening_universe_size: number;
  candidates_scored: number;
  disclaimer: string;
  all_stock_candidates: StockCandidate[];
  crypto_candidates: StockCandidate[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CACHE_KEY = (id: string) => `tradeops_market_research_${id}`;
const STALE_HOURS = 6;

function ageLabel(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function isStale(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() > STALE_HOURS * 3_600_000;
}

function parseError(status: number, detail?: string): string {
  if (status === 401) return "SESSION_EXPIRED";
  if (status === 503) return "AI service not configured — ANTHROPIC_API_KEY is missing.";
  if (status === 404) return "Investor profile not found. Try logging in again.";
  if (status === 502) return "Backend server unreachable. Make sure it is running.";
  if (detail) return detail;
  return `Failed to generate market research (status ${status}). Please try again.`;
}

function fmt(n: number | null, decimals = 1): string {
  return n == null ? "—" : n.toFixed(decimals);
}

function fmtPrice(price: number | null, currency: string): string {
  if (price == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency === "ILS" ? "ILS" : "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

// ── Tier config ───────────────────────────────────────────────────────────────

const TIER = {
  stable: {
    label: "Stable",
    sublabel: "30–35% allocation · Income & capital preservation",
    border: "border-emerald-300/60",
    bg: "bg-emerald-500/5",
    badge: "bg-emerald-500/10 text-emerald-700",
    dot: "bg-emerald-500",
    pct: "30–35%",
  },
  moderate: {
    label: "Moderate Growth",
    sublabel: "40% allocation · Quality growth at reasonable price",
    border: "border-blue-300/60",
    bg: "bg-blue-500/5",
    badge: "bg-blue-500/10 text-blue-700",
    dot: "bg-blue-500",
    pct: "40%",
  },
  high_opportunity: {
    label: "High Opportunity",
    sublabel: "20–25% allocation · Undervalued positions with catalysts",
    border: "border-amber-300/60",
    bg: "bg-amber-500/5",
    badge: "bg-amber-500/10 text-amber-700",
    dot: "bg-amber-500",
    pct: "20–25%",
  },
} as const;

const OUTLOOK_CONFIG = {
  bullish:  { label: "Bullish",  color: "text-emerald-600 bg-emerald-500/10" },
  neutral:  { label: "Neutral",  color: "text-muted-foreground bg-muted" },
  bearish:  { label: "Bearish",  color: "text-red-600 bg-red-500/10" },
};

// ── Components ────────────────────────────────────────────────────────────────

function PctBadge({ value, suffix = "%" }: { value: number | null; suffix?: string }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const positive = value >= 0;
  return (
    <span className={cn("font-medium tabular-nums", positive ? "text-emerald-600" : "text-red-500")}>
      {positive ? "+" : ""}{value.toFixed(1)}{suffix}
    </span>
  );
}

function SectorCard({ s }: { s: SectorInsight }) {
  const cfg = OUTLOOK_CONFIG[s.outlook] ?? OUTLOOK_CONFIG.neutral;
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium truncate">{s.sector}</span>
        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0", cfg.color)}>
          {cfg.label}
        </span>
      </div>
      <div className="flex gap-4 text-xs text-muted-foreground">
        <div className="space-y-0.5">
          <p>1M</p>
          <PctBadge value={s.performance_1m_pct} />
        </div>
        <div className="space-y-0.5">
          <p>3M</p>
          <PctBadge value={s.performance_3m_pct} />
        </div>
        <div className="space-y-0.5">
          <p>1Y</p>
          <PctBadge value={s.performance_1y_pct} />
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">{s.etf_ticker}</p>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center rounded-md border border-border bg-background px-2.5 py-1.5 min-w-[64px]">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function PickCard({ pick }: { pick: OpportunityPick }) {
  const [expanded, setExpanded] = useState(false);
  const tier = TIER[pick.risk_tier];
  const m = pick.key_metrics;

  return (
    <div className={cn("rounded-xl border bg-card overflow-hidden", tier.border)}>
      {/* Header */}
      <div className={cn("px-5 py-4", tier.bg)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn("h-2 w-2 rounded-full shrink-0 mt-1.5", tier.dot)} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-bold tracking-tight">{pick.ticker}</span>
                <span className="text-xs text-muted-foreground truncate">{pick.name}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-[10px] text-muted-foreground">{pick.sector}</span>
                <span className="text-muted-foreground/40">·</span>
                <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize", tier.badge)}>
                  {pick.asset_type}
                </span>
              </div>
            </div>
          </div>

          <div className="text-right shrink-0 space-y-0.5">
            {pick.current_price != null && (
              <p className="text-sm font-semibold tabular-nums">
                {fmtPrice(pick.current_price, pick.currency)}
              </p>
            )}
            {pick.upside_pct != null && (
              <p className={cn("text-xs font-medium", pick.upside_pct > 0 ? "text-emerald-600" : "text-red-500")}>
                {pick.upside_pct > 0 ? "+" : ""}{pick.upside_pct.toFixed(1)}% upside
              </p>
            )}
            {pick.analyst_target != null && (
              <p className="text-[10px] text-muted-foreground">
                Target {fmtPrice(pick.analyst_target, pick.currency)}
              </p>
            )}
          </div>
        </div>

        {/* Key metrics strip */}
        <div className="flex gap-2 mt-3 flex-wrap">
          {m.forward_pe != null && (
            <MetricPill label="Fwd P/E" value={fmt(m.forward_pe)} />
          )}
          {m.revenue_growth_pct != null && (
            <MetricPill label="Rev Growth" value={`${m.revenue_growth_pct > 0 ? "+" : ""}${fmt(m.revenue_growth_pct)}%`} />
          )}
          {m.profit_margin_pct != null && (
            <MetricPill label="Net Margin" value={`${fmt(m.profit_margin_pct)}%`} />
          )}
          {m.dividend_yield_pct != null && m.dividend_yield_pct > 0 && (
            <MetricPill label="Dividend" value={`${fmt(m.dividend_yield_pct)}%`} />
          )}
          {m.pct_from_52w_low != null && (
            <MetricPill label="52w Range" value={`${fmt(m.pct_from_52w_low)}%`} />
          )}
        </div>
      </div>

      {/* Thesis */}
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Hold {pick.time_horizon_label}</span>
          {pick.suggested_allocation_pct != null && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <Target className="h-3 w-3" />
              <span>{pick.suggested_allocation_pct}% suggested allocation</span>
            </>
          )}
        </div>

        <p className="text-sm text-foreground/80 leading-relaxed">{pick.thesis}</p>

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          {expanded ? (
            <><ChevronUp className="h-3 w-3" /> Hide details</>
          ) : (
            <><ChevronDown className="h-3 w-3" /> Why now · Key risk</>
          )}
        </button>

        {expanded && (
          <div className="space-y-3 pt-1 border-t border-border">
            <div>
              <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide mb-1">Why now</p>
              <p className="text-sm text-foreground/70 leading-relaxed">{pick.why_now}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-red-600 uppercase tracking-wide mb-1">Key risk</p>
              <p className="text-sm text-foreground/70 leading-relaxed">{pick.key_risk}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TierSection({
  tier,
  picks,
}: {
  tier: "stable" | "moderate" | "high_opportunity";
  picks: OpportunityPick[];
}) {
  const cfg = TIER[tier];
  if (picks.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className={cn("h-3 w-3 rounded-full", cfg.dot)} />
        <div>
          <h2 className="text-base font-semibold">
            {cfg.label}
            <span className="ml-2 text-sm font-normal text-muted-foreground">{cfg.pct}</span>
          </h2>
          <p className="text-xs text-muted-foreground">{cfg.sublabel}</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {picks.map((pick) => (
          <PickCard key={pick.ticker} pick={pick} />
        ))}
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 70 ? "text-emerald-600 bg-emerald-500/10" :
    score >= 45 ? "text-blue-600 bg-blue-500/10" :
    "text-muted-foreground bg-muted";
  return (
    <span className={cn("text-xs font-semibold tabular-nums px-1.5 py-0.5 rounded", color)}>
      {score.toFixed(0)}
    </span>
  );
}

function CryptoCard({ c }: { c: StockCandidate }) {
  return (
    <div className="rounded-xl border border-violet-300/60 bg-violet-500/5 overflow-hidden">
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Bitcoin className="h-4 w-4 text-violet-500 shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold tracking-tight">{c.ticker.replace("-USD", "")}</span>
                <span className="text-xs text-muted-foreground">{c.name}</span>
              </div>
              <span className="text-[10px] text-violet-600 font-medium bg-violet-500/10 px-1.5 py-0.5 rounded-full">Crypto</span>
            </div>
          </div>
          <div className="text-right space-y-0.5">
            {c.current_price != null && (
              <p className="text-sm font-semibold tabular-nums">
                {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(c.current_price)}
              </p>
            )}
            {c.pct_from_52w_low != null && (
              <p className="text-[11px] text-muted-foreground">
                {c.pct_from_52w_low.toFixed(0)}% above 52w low
              </p>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <BarChart2 className="h-3 w-3" />
            <span>Entry score</span>
          </div>
          <ScoreBadge score={c.opportunity_score} />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Scored on 52-week entry signal. AI may select for high-opportunity tier.
        </p>
      </div>
    </div>
  );
}

function ScreenerTable({ candidates }: { candidates: StockCandidate[] }) {
  const [open, setOpen] = useState(false);
  if (candidates.length === 0) return null;
  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        Full Screened Universe ({candidates.length} instruments)
      </button>
      {open && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  {["Score", "Ticker", "Name", "Sector", "Price", "Upside", "Fwd P/E", "Rev Growth", "Margin", "52w Pos"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {candidates.map((c) => (
                  <tr key={c.ticker} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2"><ScoreBadge score={c.opportunity_score} /></td>
                    <td className="px-3 py-2 font-mono font-semibold">{c.ticker}</td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[140px] truncate">{c.name}</td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{c.sector}</td>
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                      {c.current_price != null ? `${c.currency === "ILS" ? "₪" : "$"}${c.current_price.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {c.analyst_upside_pct != null ? (
                        <span className={c.analyst_upside_pct >= 0 ? "text-emerald-600" : "text-red-500"}>
                          {c.analyst_upside_pct > 0 ? "+" : ""}{c.analyst_upside_pct.toFixed(1)}%
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{c.forward_pe != null ? c.forward_pe.toFixed(1) : "—"}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {c.revenue_growth_pct != null ? (
                        <span className={c.revenue_growth_pct >= 0 ? "text-emerald-600" : "text-red-500"}>
                          {c.revenue_growth_pct > 0 ? "+" : ""}{c.revenue_growth_pct.toFixed(1)}%
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{c.profit_margin_pct != null ? `${c.profit_margin_pct.toFixed(1)}%` : "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{c.pct_from_52w_low != null ? `${c.pct_from_52w_low.toFixed(0)}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MarketResearchPage() {
  const investorId = useInvestorId();
  const [report, setReport] = useState<MarketResearchReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!investorId) return;
    try {
      const raw = localStorage.getItem(CACHE_KEY(investorId));
      if (raw) {
        const { data, savedAt } = JSON.parse(raw);
        setReport(data);
        setCachedAt(savedAt);
      }
    } catch {}
  }, [investorId]);

  useEffect(() => {
    if (!loading) { setElapsed(0); return; }
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [loading]);

  async function generate() {
    if (!investorId) return;
    setLoading(true);
    setError(null);
    setElapsed(0);
    try {
      const res = await fetch(`/api/v1/investors/${investorId}/market-research`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detail = typeof body.detail === "string" ? body.detail : undefined;
        throw new Error(parseError(res.status, detail));
      }
      const data: MarketResearchReport = await res.json();
      setReport(data);
      const savedAt = new Date().toISOString();
      setCachedAt(savedAt);
      localStorage.setItem(CACHE_KEY(investorId), JSON.stringify({ data, savedAt }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  if (!investorId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const showStale = cachedAt && isStale(cachedAt);
  const totalPicks = report
    ? report.stable_picks.length + report.moderate_picks.length + report.opportunity_picks.length
    : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 lg:space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Microscope className="h-6 w-6 text-primary" />
            Deep Market Research
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Fundamental screening of {report?.screening_universe_size ?? "60+"} instruments · AI-generated investment theses · 3-tier portfolio construction
          </p>
        </div>
        <Button onClick={generate} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          {loading ? "Analysing…" : report ? "Refresh" : "Run analysis"}
        </Button>
      </div>

      {/* Error */}
      {error && (
        error === "SESSION_EXPIRED" ? (
          <div className="flex items-start gap-3 text-sm p-4 rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-400">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1">Your session has expired. Please sign in again to refresh market research.</div>
            <a href="/" className="text-xs font-medium underline underline-offset-2 shrink-0">Sign in</a>
          </div>
        ) : (
          <div className="flex items-start gap-3 text-sm p-4 rounded-lg border border-red-500/20 bg-red-500/5 text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
            <button onClick={generate} disabled={loading} className="text-xs font-medium underline underline-offset-2 shrink-0">
              Retry
            </button>
          </div>
        )
      )}

      {/* Stale notice */}
      {showStale && !loading && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-3 text-sm text-amber-800">
          <Clock className="h-4 w-4 shrink-0" />
          Analysis from {ageLabel(cachedAt!)} — market conditions may have changed.
          <button onClick={generate} className="ml-auto text-xs font-medium underline underline-offset-2">
            Refresh now
          </button>
        </div>
      )}

      {/* Empty state */}
      {!report && !loading && (
        <div className="space-y-4">
          <Card>
            <CardContent className="py-16 text-center space-y-4">
              <Microscope className="h-10 w-10 text-muted-foreground mx-auto" />
              <div>
                <p className="text-sm font-medium mb-1">No analysis yet</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Screens {60}+ stocks across 8 sectors for fundamental undervaluation, then applies
                  AI analysis to produce specific investment theses across three risk tiers.
                </p>
              </div>
              <Button onClick={generate}>Run analysis</Button>
              <p className="text-xs text-muted-foreground">Takes ~30 seconds · Screens live market data</p>
            </CardContent>
          </Card>

          <Card className="border-blue-200/60 bg-blue-50/30">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <div className="space-y-2 flex-1">
                  <p className="text-sm font-medium text-blue-900">For personalised tier allocation, complete your profile:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    {[
                      { label: "Risk Model", href: "/risk", desc: "Sets tier %s" },
                      { label: "Holdings", href: "/investments", desc: "Avoids duplicates" },
                      { label: "Financial", href: "/financial", desc: "Investable capital" },
                    ].map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-2 rounded-md border border-blue-200 bg-white/70 px-3 py-2 hover:bg-white transition-colors"
                      >
                        <ArrowRight className="h-3 w-3 text-blue-500 shrink-0" />
                        <div>
                          <p className="font-medium text-blue-900">{item.label}</p>
                          <p className="text-muted-foreground">{item.desc}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <Card>
          <CardContent className="py-14 text-center space-y-4">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {elapsed < 5 ? "Fetching live market data…" :
                 elapsed < 20 ? "Screening fundamentals across 60+ instruments…" :
                 elapsed < 40 ? "Generating AI investment theses…" :
                 "Almost done — finalising analysis…"}
              </p>
              <p className="text-xs text-muted-foreground">
                {elapsed}s elapsed · typically completes in 45–60 seconds
              </p>
            </div>
            <div className="flex justify-center gap-2 text-xs text-muted-foreground">
              {[
                { label: "Market data", done: elapsed >= 5 },
                { label: "Screening", done: elapsed >= 20 },
                { label: "AI analysis", done: elapsed >= 40 },
              ].map((step) => (
                <span key={step.label} className={cn(
                  "flex items-center gap-1 px-2 py-1 rounded-full border",
                  step.done ? "border-primary/40 text-primary bg-primary/5" : "border-border"
                )}>
                  {step.done ? "✓" : "○"} {step.label}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report */}
      {report && !loading && (
        <div className="space-y-8">
          {/* Meta bar */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
            <span>
              Generated {new Date(report.generated_at).toLocaleString()}
              {cachedAt && ` · ${ageLabel(cachedAt)}`}
            </span>
            <span className="text-muted-foreground/40">|</span>
            <span>{report.screening_universe_size} instruments screened</span>
            <span className="text-muted-foreground/40">|</span>
            <span>{report.candidates_scored} top candidates analysed</span>
            <span className="text-muted-foreground/40">|</span>
            <span>{totalPicks} picks selected</span>
          </div>

          {/* Market overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Market Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                {report.market_overview}
              </p>
            </CardContent>
          </Card>

          {/* Sector performance grid */}
          {report.sector_insights.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-base font-semibold">Sector Performance</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {report.sector_insights.map((s) => (
                  <SectorCard key={s.sector} s={s} />
                ))}
              </div>
            </div>
          )}

          {/* Three-tier picks */}
          <TierSection tier="stable" picks={report.stable_picks} />
          <TierSection tier="moderate" picks={report.moderate_picks} />
          <TierSection tier="high_opportunity" picks={report.opportunity_picks} />

          {/* Crypto universe */}
          {report.crypto_candidates && report.crypto_candidates.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Bitcoin className="h-4 w-4 text-violet-500" />
                <div>
                  <h2 className="text-base font-semibold">
                    Crypto Universe
                    <span className="ml-2 text-sm font-normal text-muted-foreground">available for high-opportunity tier</span>
                  </h2>
                  <p className="text-xs text-muted-foreground">Scored on 52-week entry signal — included in AI context for tier selection</p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {report.crypto_candidates.map((c) => (
                  <CryptoCard key={c.ticker} c={c} />
                ))}
              </div>
            </div>
          )}

          {/* Full screener universe */}
          {report.all_stock_candidates && report.all_stock_candidates.length > 0 && (
            <ScreenerTable candidates={report.all_stock_candidates} />
          )}

          {/* Disclaimer */}
          <p className="text-[11px] text-muted-foreground border-t border-border pt-4">
            {report.disclaimer}
          </p>
        </div>
      )}
    </div>
  );
}

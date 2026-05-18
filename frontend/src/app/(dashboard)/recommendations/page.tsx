"use client";

import { useState, useEffect } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Zap,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Circle,
  BookOpen,
  ChevronRight,
  Plus,
  TrendingUp,
  TrendingDown,
  Star,
  ArrowRight,
  Activity,
  Minus,
  Info,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MonthlyAllocation {
  ticker: string;
  name: string;
  asset_type: string;
  risk: string;
  monthly_amount: number;
  pct: number;
  note: string;
}

interface RoadmapPhase {
  number: number;
  title: string;
  status: "current" | "next" | "future" | "completed";
  condition: string;
}

interface InvestmentRoadmap {
  monthly_investable_amount: number;
  currency: string;
  current_phase: number;
  phases: RoadmapPhase[];
  monthly_plan: {
    conservative: MonthlyAllocation[];
    balanced: MonthlyAllocation[];
    growth: MonthlyAllocation[];
  };
}

interface LiveSignal {
  ticker: string;
  name: string;
  asset_type: string;
  current_price: number;
  currency: string;
  change_24h_pct: number | null;
  change_7d_pct: number | null;
  pct_from_52w_low: number | null;
  signal_type: string; // "dip" | "near_low" | "recovery" | "momentum" | "stable"
  signal_note: string;
  risk_level: string;
  is_held: boolean;
}

interface PortfolioAction {
  action: string;
  rationale: string;
  urgency: "immediate" | "soon" | "when_convenient";
}

interface InstrumentRecommendation {
  ticker: string | null;
  name: string;
  asset_type: string;
  risk_level: string;
  why_fits: string;
  suggested_allocation_pct: number | null;
  educational_note: string;
  action: "consider" | "increase" | "start_position";
  is_new_to_you: boolean;
  suggested_position_size_pct: number | null;
  max_loss_amount: number | null;
  stop_loss_note: string | null;
}

interface RecommendationReport {
  investor_id: string;
  overall_guidance: string;
  portfolio_actions: PortfolioAction[];
  investment_roadmap: InvestmentRoadmap | null;
  recommendations: InstrumentRecommendation[];
  market_signals: LiveSignal[];
  generated_at: string;
  disclaimer: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const URGENCY_CONFIG: Record<string, { label: string; color: string; icon: typeof Zap }> = {
  immediate: { label: "Immediate", color: "text-red-500", icon: Zap },
  soon: { label: "Soon", color: "text-amber-500", icon: AlertTriangle },
  when_convenient: { label: "When convenient", color: "text-muted-foreground", icon: Clock },
};

const RISK_BADGE: Record<string, string> = {
  low: "bg-emerald-500/10 text-emerald-600",
  moderate: "bg-blue-500/10 text-blue-600",
  high: "bg-amber-500/10 text-amber-600",
  very_high: "bg-red-500/10 text-red-600",
};

const TIER_CONFIG = {
  conservative: {
    label: "Conservative",
    desc: "Capital preservation — low volatility, stable returns",
    color: "text-emerald-600",
    activeBg: "bg-emerald-500/10 border-emerald-300",
    bar: "bg-emerald-500",
  },
  balanced: {
    label: "Balanced",
    desc: "Growth + stability — moderate risk, diversified",
    color: "text-blue-600",
    activeBg: "bg-blue-500/10 border-blue-300",
    bar: "bg-blue-500",
  },
  growth: {
    label: "Growth",
    desc: "Maximum growth potential — higher volatility",
    color: "text-amber-600",
    activeBg: "bg-amber-500/10 border-amber-300",
    bar: "bg-amber-500",
  },
};

const ACTION_LABEL: Record<string, string> = {
  start_position: "Start position",
  increase: "Increase",
  consider: "Consider",
};

const CACHE_KEY = (id: string) => `tradeops_recommendations_${id}`;
const STALE_HOURS = 24;

function ageLabel(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function isStale(iso: string): boolean {
  return (Date.now() - new Date(iso).getTime()) > STALE_HOURS * 3600000;
}

function parseError(status: number, detail?: string): string {
  if (status === 503) return "AI service not configured — ANTHROPIC_API_KEY is missing.";
  if (status === 404) return "Investor profile not found. Try logging in again.";
  if (status === 502) return "Backend server unreachable. Make sure it is running.";
  if (detail) return detail;
  return `Failed to generate recommendations (status ${status}). Please try again.`;
}

const ACTION_COLOR: Record<string, string> = {
  start_position: "bg-primary/10 text-primary",
  increase: "bg-emerald-500/10 text-emerald-600",
  consider: "bg-muted text-muted-foreground",
};

const ASSET_TYPE_LABEL: Record<string, string> = {
  etf: "ETF", stock: "Stock", crypto: "Crypto", bond: "Bond", fund: "Fund",
};

const SIGNAL_CONFIG: Record<string, { label: string; border: string; badge: string }> = {
  dip:      { label: "Dip",      border: "border-l-red-400",    badge: "bg-red-500/10 text-red-600" },
  near_low: { label: "Near Low", border: "border-l-orange-400", badge: "bg-orange-500/10 text-orange-600" },
  recovery: { label: "Recovery", border: "border-l-amber-400",  badge: "bg-amber-500/10 text-amber-600" },
  momentum: { label: "Momentum", border: "border-l-emerald-400", badge: "bg-emerald-500/10 text-emerald-600" },
  stable:   { label: "Stable",   border: "border-l-border",     badge: "bg-muted text-muted-foreground" },
};

function formatPct(pct: number | null): { text: string; color: string; Icon: typeof TrendingUp } {
  if (pct === null) return { text: "—", color: "text-muted-foreground", Icon: Minus };
  const abs = Math.abs(pct).toFixed(1);
  if (pct > 0) return { text: `+${abs}%`, color: "text-emerald-600", Icon: TrendingUp };
  if (pct < 0) return { text: `-${abs}%`, color: "text-red-500", Icon: TrendingDown };
  return { text: "0.0%", color: "text-muted-foreground", Icon: Minus };
}

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RecommendationsPage() {
  const investorId = useInvestorId();
  const router = useRouter();
  const [report, setReport] = useState<RecommendationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [activeTier, setActiveTier] = useState<"conservative" | "balanced" | "growth">("balanced");
  const [addingTicker, setAddingTicker] = useState<string | null>(null);
  const [addedTickers, setAddedTickers] = useState<Set<string>>(new Set());

  // Load cache on mount (12h TTL)
  useEffect(() => {
    if (!investorId) return;
    try {
      const raw = localStorage.getItem(CACHE_KEY(investorId));
      if (raw) {
        const { data, savedAt } = JSON.parse(raw);
        const ageMs = Date.now() - new Date(savedAt).getTime();
        if (ageMs > 12 * 3600 * 1000) {
          localStorage.removeItem(CACHE_KEY(investorId));
        } else {
          setReport(data);
          setCachedAt(savedAt);
        }
      }
    } catch {}
  }, [investorId]);

  async function generate() {
    if (!investorId) return;
    setLoading(true);
    setError(null);
    setAddedTickers(new Set());
    try {
      const res = await fetch(`/api/v1/investors/${investorId}/recommendations`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detail = typeof body.detail === "string" ? body.detail : undefined;
        throw new Error(parseError(res.status, detail));
      }
      const data: RecommendationReport = await res.json();
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

  async function addToWatchlist(alloc: MonthlyAllocation) {
    if (!investorId || addedTickers.has(alloc.ticker)) return;
    setAddingTicker(alloc.ticker);
    try {
      const r = await fetch(`/api/v1/investors/${investorId}/watchlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: alloc.ticker,
          name: alloc.name,
          asset_type: alloc.asset_type,
          notes: alloc.note,
        }),
      });
      if (r.ok || r.status === 409) {
        setAddedTickers(prev => new Set(Array.from(prev).concat(alloc.ticker)));
      }
    } finally {
      setAddingTicker(null);
    }
  }

  async function addSignalToWatchlist(sig: LiveSignal) {
    if (!investorId || addedTickers.has(sig.ticker)) return;
    setAddingTicker(sig.ticker);
    try {
      const r = await fetch(`/api/v1/investors/${investorId}/watchlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: sig.ticker,
          name: sig.name,
          asset_type: sig.asset_type,
          notes: sig.signal_note,
        }),
      });
      if (r.ok || r.status === 409) {
        setAddedTickers(prev => new Set(Array.from(prev).concat(sig.ticker)));
      }
    } finally {
      setAddingTicker(null);
    }
  }

  const roadmap = report?.investment_roadmap ?? null;
  const tierAllocations = roadmap?.monthly_plan[activeTier] ?? [];
  const discovery = report?.recommendations.filter(r => r.is_new_to_you) ?? [];
  const existing = report?.recommendations.filter(r => !r.is_new_to_you) ?? [];

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Investment Recommendations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your personalised investment roadmap — concrete plans, specific amounts, actionable steps.
          </p>
        </div>
        <Button onClick={generate} disabled={loading} className="shrink-0">
          <Sparkles className="h-4 w-4 mr-2" />
          {loading ? "Analysing…" : report ? "Regenerate" : "Generate"}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="flex-1">{error}</div>
          <button onClick={generate} disabled={loading} className="text-xs font-medium underline underline-offset-2 shrink-0">
            Retry
          </button>
        </div>
      )}

      {/* Stale cache notice */}
      {report && cachedAt && isStale(cachedAt) && !loading && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-3 text-sm text-amber-800">
          <Clock className="h-4 w-4 shrink-0" />
          Showing results from {ageLabel(cachedAt)} — market conditions may have changed.
          <button onClick={generate} className="ml-auto text-xs font-medium underline underline-offset-2">
            Refresh now
          </button>
        </div>
      )}

      {/* Empty state */}
      {!report && !loading && !error && (
        <div className="space-y-4">
          <Card className="border-dashed">
            <CardContent className="pt-12 pb-12 flex flex-col items-center gap-4 text-center">
              <Sparkles className="h-10 w-10 text-muted-foreground/30" />
              <div>
                <p className="font-medium">Get your personalised investment roadmap</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Claude analyses your portfolio, risk model, goals, and financial situation —
                  then gives you a specific monthly plan for three risk levels.
                </p>
              </div>
              <Button onClick={generate} size="lg">
                <Sparkles className="h-4 w-4 mr-2" />
                Generate my roadmap
              </Button>
              <p className="text-xs text-muted-foreground">Takes ~20 seconds · Uses Claude Sonnet AI</p>
            </CardContent>
          </Card>

          {/* Setup hints */}
          <Card className="border-blue-200/60 bg-blue-50/30">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <div className="space-y-2 flex-1">
                  <p className="text-sm font-medium text-blue-900">For the best recommendations, make sure you have set up:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    {[
                      { label: "Financial Profile", href: "/financial", desc: "Income, expenses, savings" },
                      { label: "Risk Model", href: "/risk", desc: "Investment risk allocation" },
                      { label: "Holdings", href: "/investments", desc: "Your current investments" },
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

      {loading && (
        <Card>
          <CardContent className="pt-12 pb-12 flex flex-col items-center gap-3 text-center">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-sm text-muted-foreground">
              Fetching live market data and analysing your portfolio…
            </p>
          </CardContent>
        </Card>
      )}

      {report && (
        <>
          {/* Situation summary */}
          <Card>
            <CardContent className="pt-5">
              {report.overall_guidance.split("\n\n").map((para, i) => (
                <p key={i} className={cn("text-sm text-foreground/80 leading-relaxed", i > 0 && "mt-3")}>
                  {para}
                </p>
              ))}
              <p className="mt-3 text-xs text-muted-foreground border-t pt-3">
                Generated {new Date(report.generated_at).toLocaleString()}
                {cachedAt && ` · ${ageLabel(cachedAt)}`}
              </p>
            </CardContent>
          </Card>

          {/* ── Investment Roadmap ── */}
          {roadmap && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h2 className="text-base font-semibold">Your Investment Roadmap</h2>
              </div>

              {/* Phase progress */}
              <div className="grid grid-cols-3 gap-3">
                {roadmap.phases.map((phase) => {
                  const isCurrent = phase.status === "current";
                  const isDone = phase.status === "completed";
                  return (
                    <Card
                      key={phase.number}
                      className={cn(
                        "relative overflow-hidden",
                        isCurrent && "border-primary/40 bg-primary/5",
                        isDone && "border-emerald-400/40 bg-emerald-500/5",
                      )}
                    >
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start gap-2">
                          {isDone ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                          ) : isCurrent ? (
                            <div className="h-4 w-4 rounded-full border-2 border-primary bg-primary/20 shrink-0 mt-0.5" />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground/30 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <p className={cn(
                              "text-xs font-semibold",
                              isCurrent ? "text-primary" : isDone ? "text-emerald-600" : "text-muted-foreground"
                            )}>
                              Phase {phase.number}
                            </p>
                            <p className="text-sm font-medium mt-0.5">{phase.title}</p>
                            <p className="text-xs text-muted-foreground mt-1 leading-snug">{phase.condition}</p>
                          </div>
                        </div>
                        {isCurrent && (
                          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary/30" />
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Monthly plan */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">
                      Monthly Investment Plan
                    </CardTitle>
                    <span className="text-xs text-muted-foreground">
                      Budget: <span className="font-semibold text-foreground">
                        {formatAmount(roadmap.monthly_investable_amount, roadmap.currency)}/mo
                      </span>
                    </span>
                  </div>
                  {/* Tier tabs */}
                  <div className="flex gap-2 pt-1">
                    {(["conservative", "balanced", "growth"] as const).map((tier) => {
                      const cfg = TIER_CONFIG[tier];
                      const isActive = activeTier === tier;
                      return (
                        <button
                          key={tier}
                          onClick={() => setActiveTier(tier)}
                          className={cn(
                            "flex-1 py-2 px-3 rounded-md border text-xs font-medium transition-all",
                            isActive
                              ? cn(cfg.activeBg, cfg.color)
                              : "border-border text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {TIER_CONFIG[activeTier].desc}
                  </p>
                </CardHeader>

                <CardContent className="space-y-2 pt-0">
                  {tierAllocations.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">No allocations generated for this tier.</p>
                  ) : (
                    tierAllocations.map((alloc) => {
                      const isAdded = addedTickers.has(alloc.ticker);
                      const isAdding = addingTicker === alloc.ticker;
                      return (
                        <div
                          key={alloc.ticker}
                          className="flex items-center gap-3 py-3 border-b last:border-0"
                        >
                          {/* Bar + pct */}
                          <div className="w-10 text-right shrink-0">
                            <span className="text-sm font-bold">{alloc.pct}%</span>
                          </div>
                          <div className="w-1 self-stretch rounded-full shrink-0 bg-muted">
                            <div
                              className={cn("rounded-full", TIER_CONFIG[activeTier].bar)}
                              style={{ height: `${Math.max(alloc.pct, 20)}%`, minHeight: "100%" }}
                            />
                          </div>

                          {/* Instrument info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                {alloc.ticker}
                              </span>
                              <span className={cn(
                                "text-[10px] font-medium px-1.5 py-0.5 rounded",
                                RISK_BADGE[alloc.risk] ?? "bg-muted text-muted-foreground"
                              )}>
                                {alloc.risk}
                              </span>
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                {ASSET_TYPE_LABEL[alloc.asset_type] ?? alloc.asset_type}
                              </span>
                            </div>
                            <p className="text-sm font-medium mt-0.5 truncate">{alloc.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{alloc.note}</p>
                          </div>

                          {/* Amount + add button */}
                          <div className="shrink-0 text-right flex flex-col items-end gap-1.5">
                            <p className="text-sm font-semibold">
                              {formatAmount(alloc.monthly_amount, roadmap.currency)}
                              <span className="text-xs font-normal text-muted-foreground">/mo</span>
                            </p>
                            <button
                              onClick={() => addToWatchlist(alloc)}
                              disabled={isAdded || isAdding}
                              className={cn(
                                "inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded transition-colors",
                                isAdded
                                  ? "bg-emerald-500/10 text-emerald-600 cursor-default"
                                  : "bg-primary/10 text-primary hover:bg-primary/20"
                              )}
                            >
                              {isAdded ? (
                                <><CheckCircle2 className="h-3 w-3" /> Watchlisted</>
                              ) : isAdding ? (
                                "Adding…"
                              ) : (
                                <><Plus className="h-3 w-3" /> Watchlist</>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}

                  <div className="pt-2">
                    <button
                      onClick={() => router.push("/watchlist")}
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                    >
                      View my watchlist <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── Live Market Signals ── */}
          {report.market_signals.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <h2 className="text-base font-semibold">Live Market Signals</h2>
                </div>
                <span className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded-full">
                  Live prices from CoinGecko + Yahoo Finance
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {report.market_signals
                  .filter(s => s.signal_type !== "stable")
                  .slice(0, 12)
                  .map((sig) => {
                    const cfg = SIGNAL_CONFIG[sig.signal_type] ?? SIGNAL_CONFIG.stable;
                    const d24 = formatPct(sig.change_24h_pct);
                    const d7 = formatPct(sig.change_7d_pct);
                    const isAdded = addedTickers.has(sig.ticker);
                    const isAdding = addingTicker === sig.ticker;
                    return (
                      <div
                        key={sig.ticker}
                        className={cn(
                          "rounded-lg border border-l-4 bg-card p-4 space-y-2",
                          cfg.border,
                        )}
                      >
                        {/* Header row */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                {sig.ticker}
                              </span>
                              <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", cfg.badge)}>
                                {cfg.label}
                              </span>
                              {sig.is_held && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600">
                                  Holding
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-medium mt-1 leading-snug truncate">{sig.name}</p>
                          </div>
                          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0", RISK_BADGE[sig.risk_level] ?? "bg-muted text-muted-foreground")}>
                            {sig.risk_level.replace("_", " ")}
                          </span>
                        </div>

                        {/* Price row */}
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold">
                            {sig.current_price.toLocaleString("en-US", {
                              style: "currency",
                              currency: sig.currency,
                              maximumFractionDigits: sig.current_price < 1 ? 4 : sig.current_price < 100 ? 2 : 0,
                            })}
                          </span>
                          <div className="flex items-center gap-2 text-xs">
                            <span className={cn("flex items-center gap-0.5", d24.color)}>
                              <d24.Icon className="h-3 w-3" /> {d24.text} 24h
                            </span>
                            <span className={cn("flex items-center gap-0.5 font-medium", d7.color)}>
                              <d7.Icon className="h-3 w-3" /> {d7.text} 7d
                            </span>
                          </div>
                        </div>

                        {/* Signal note */}
                        <p className="text-xs text-muted-foreground leading-snug">{sig.signal_note}</p>

                        {/* 52w range bar */}
                        {sig.pct_from_52w_low !== null && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>52w Low</span>
                              <span>{sig.pct_from_52w_low.toFixed(0)}% from low</span>
                              <span>52w High</span>
                            </div>
                            <div className="h-1 rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full",
                                  sig.pct_from_52w_low < 20 ? "bg-red-400" :
                                  sig.pct_from_52w_low < 40 ? "bg-amber-400" : "bg-emerald-400"
                                )}
                                style={{ width: `${Math.min(sig.pct_from_52w_low, 100)}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Watchlist button */}
                        <button
                          onClick={() => addSignalToWatchlist(sig)}
                          disabled={isAdded || isAdding}
                          className={cn(
                            "w-full inline-flex items-center justify-center gap-1 text-[11px] font-medium px-2 py-1.5 rounded transition-colors",
                            isAdded
                              ? "bg-emerald-500/10 text-emerald-600 cursor-default"
                              : "bg-primary/10 text-primary hover:bg-primary/20"
                          )}
                        >
                          {isAdded ? (
                            <><CheckCircle2 className="h-3 w-3" /> Watchlisted</>
                          ) : isAdding ? (
                            "Adding…"
                          ) : (
                            <><Plus className="h-3 w-3" /> Add to Watchlist</>
                          )}
                        </button>
                      </div>
                    );
                  })}
              </div>

              {report.market_signals.filter(s => s.signal_type !== "stable").length === 0 && (
                <Card className="border-dashed">
                  <CardContent className="pt-6 pb-6 text-center text-sm text-muted-foreground">
                    No strong signals detected this week — markets are relatively stable.
                  </CardContent>
                </Card>
              )}
            </section>
          )}

          {/* ── Action Plan ── */}
          {report.portfolio_actions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Action Plan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {report.portfolio_actions.map((pa, i) => {
                  const cfg = URGENCY_CONFIG[pa.urgency] ?? URGENCY_CONFIG.when_convenient;
                  const Icon = cfg.icon;
                  return (
                    <div key={i} className="flex gap-3 items-start">
                      <div className={cn("mt-0.5 shrink-0", cfg.color)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{pa.action}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{pa.rationale}</p>
                        <span className={cn("inline-block mt-1 text-[10px] font-medium", cfg.color)}>
                          {cfg.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* ── Discovery instruments ── */}
          {discovery.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                <h2 className="text-sm font-semibold">New to you — worth exploring</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {discovery.map((rec, i) => <InstrumentCard key={i} rec={rec} />)}
              </div>
            </section>
          )}

          {/* ── Existing holdings guidance ── */}
          {existing.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Your current holdings — guidance</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {existing.map((rec, i) => <InstrumentCard key={i} rec={rec} />)}
              </div>
            </section>
          )}

          {/* Disclaimer */}
          <p className="text-xs text-muted-foreground border rounded-md px-4 py-3 bg-muted/30">
            {report.disclaimer}
          </p>
        </>
      )}
    </div>
  );
}

// ── Instrument card ───────────────────────────────────────────────────────────

function InstrumentCard({ rec }: { rec: InstrumentRecommendation }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="flex flex-col">
      <CardContent className="pt-4 flex-1 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            {rec.ticker && (
              <span className="text-xs font-mono font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                {rec.ticker}
              </span>
            )}
            <p className="text-sm font-medium mt-1 leading-snug">{rec.name}</p>
          </div>
          {rec.is_new_to_you && (
            <Badge variant="muted" className="shrink-0 text-[10px]">New</Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", RISK_BADGE[rec.risk_level] ?? "bg-muted text-muted-foreground")}>
            {rec.risk_level.replace("_", " ")}
          </span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            {ASSET_TYPE_LABEL[rec.asset_type] ?? rec.asset_type}
          </span>
          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", ACTION_COLOR[rec.action] ?? "bg-muted text-muted-foreground")}>
            {ACTION_LABEL[rec.action] ?? rec.action}
          </span>
        </div>

        <p className="text-xs text-foreground/80 leading-relaxed">{rec.why_fits}</p>

        {rec.suggested_allocation_pct != null && (
          <p className="text-xs text-muted-foreground">
            Suggested allocation: <span className="font-medium text-foreground">{rec.suggested_allocation_pct}%</span> of investable capital
          </p>
        )}

        {(rec.suggested_position_size_pct != null || rec.max_loss_amount != null) && (
          <div className="flex items-center gap-3 flex-wrap">
            {rec.suggested_position_size_pct != null && (
              <span className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">
                Size: {rec.suggested_position_size_pct.toFixed(1)}% of capital
              </span>
            )}
            {rec.max_loss_amount != null && (
              <span className="text-[10px] bg-red-500/10 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">
                Max loss: ~{Math.round(rec.max_loss_amount).toLocaleString()} · {rec.stop_loss_note ?? "10% stop"}
              </span>
            )}
          </div>
        )}

        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <BookOpen className="h-3 w-3" />
          What is this?
          <ChevronRight className={cn("h-3 w-3 transition-transform", expanded && "rotate-90")} />
        </button>
        {expanded && (
          <p className="text-xs text-muted-foreground leading-relaxed border-t pt-2">
            {rec.educational_note}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

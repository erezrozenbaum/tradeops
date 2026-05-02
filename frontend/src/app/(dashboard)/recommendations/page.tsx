"use client";

import { useState } from "react";
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
  Star,
  ArrowRight,
} from "lucide-react";
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
}

interface RecommendationReport {
  investor_id: string;
  overall_guidance: string;
  portfolio_actions: PortfolioAction[];
  investment_roadmap: InvestmentRoadmap | null;
  recommendations: InstrumentRecommendation[];
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

const ACTION_COLOR: Record<string, string> = {
  start_position: "bg-primary/10 text-primary",
  increase: "bg-emerald-500/10 text-emerald-600",
  consider: "bg-muted text-muted-foreground",
};

const ASSET_TYPE_LABEL: Record<string, string> = {
  etf: "ETF", stock: "Stock", crypto: "Crypto", bond: "Bond", fund: "Fund",
};

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
  const [activeTier, setActiveTier] = useState<"conservative" | "balanced" | "growth">("balanced");
  const [addingTicker, setAddingTicker] = useState<string | null>(null);
  const [addedTickers, setAddedTickers] = useState<Set<string>>(new Set());

  async function generate() {
    if (!investorId) return;
    setLoading(true);
    setError(null);
    setAddedTickers(new Set());
    try {
      const res = await fetch(`/api/v1/investors/${investorId}/recommendations`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "Failed to generate recommendations");
      }
      setReport(await res.json());
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
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="pt-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!report && !loading && !error && (
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
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card>
          <CardContent className="pt-12 pb-12 flex flex-col items-center gap-3 text-center">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-sm text-muted-foreground">
              Analysing your portfolio, goals, and risk model…
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

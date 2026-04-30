"use client";

import { useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Zap,
  BookOpen,
  TrendingUp,
  AlertTriangle,
  Clock,
  ChevronRight,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

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
  etf: "ETF",
  stock: "Stock",
  crypto: "Crypto",
  bond: "Bond",
  fund: "Fund",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RecommendationsPage() {
  const investorId = useInvestorId();
  const [report, setReport] = useState<RecommendationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!investorId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/investors/${investorId}/recommendations`
      );
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

  const discovery = report?.recommendations.filter((r) => r.is_new_to_you) ?? [];
  const existing = report?.recommendations.filter((r) => !r.is_new_to_you) ?? [];

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Investment Recommendations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-powered, personalised guidance based on your full financial profile and portfolio gaps.
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
          <CardContent className="pt-12 pb-12 flex flex-col items-center gap-3 text-center">
            <Sparkles className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">No recommendations yet</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Click Generate to get personalised investment guidance based on your profile,
              risk model, portfolio gaps, and goals.
            </p>
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
          {/* Overall guidance */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Guidance Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {report.overall_guidance.split("\n\n").map((para, i) => (
                <p key={i} className={cn("text-sm text-foreground/80 leading-relaxed", i > 0 && "mt-3")}>
                  {para}
                </p>
              ))}
              <p className="mt-4 text-xs text-muted-foreground border-t pt-3">
                Generated {new Date(report.generated_at).toLocaleString()}
              </p>
            </CardContent>
          </Card>

          {/* Portfolio actions */}
          {report.portfolio_actions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Action Plan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
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
                        <p className="text-xs text-muted-foreground mt-0.5">{pa.rationale}</p>
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

          {/* Discovery — new-to-you instruments */}
          {discovery.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                <h2 className="text-sm font-semibold">New to you — worth exploring</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {discovery.map((rec, i) => (
                  <InstrumentCard key={i} rec={rec} />
                ))}
              </div>
            </section>
          )}

          {/* Existing position recommendations */}
          {existing.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Your current holdings — guidance</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {existing.map((rec, i) => (
                  <InstrumentCard key={i} rec={rec} />
                ))}
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
        {/* Top row */}
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

        {/* Badges */}
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

        {/* Why it fits */}
        <p className="text-xs text-foreground/80 leading-relaxed">{rec.why_fits}</p>

        {/* Allocation hint */}
        {rec.suggested_allocation_pct != null && (
          <p className="text-xs text-muted-foreground">
            Suggested allocation: <span className="font-medium text-foreground">{rec.suggested_allocation_pct}%</span> of investable capital
          </p>
        )}

        {/* Educational note toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
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

"use client";

import { useState, useEffect } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, AlertTriangle, Clock, Info, RefreshCw, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";
import { AIDisclaimer } from "@/components/ui/ai-disclaimer";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AnalysisReport {
  investor_id: string;
  generated_at: string;
  summary: string;
  financial_health: string;
  risk_profile: string;
  portfolio_analysis: string;
  goals_progress: string;
  strategy_analysis: string;
  backtest_insights: string;
  paper_trading_performance: string;
  recommendations: string;
}

const SECTIONS: { key: keyof AnalysisReport; label: string }[] = [
  { key: "summary", label: "Executive Summary" },
  { key: "financial_health", label: "Financial Health" },
  { key: "risk_profile", label: "Risk Profile" },
  { key: "portfolio_analysis", label: "Portfolio Analysis" },
  { key: "goals_progress", label: "Goals Progress" },
  { key: "strategy_analysis", label: "Strategy Analysis" },
  { key: "backtest_insights", label: "Backtest Insights" },
  { key: "paper_trading_performance", label: "Paper Trading Performance" },
  { key: "recommendations", label: "Recommendations" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const CACHE_KEY = (id: string) => `tradeops_ai_report_${id}`;
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
  return `Failed to generate report (status ${status}). Please try again.`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const investorId = useInvestorId();
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  // Load cache on mount
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

  async function generate() {
    if (!investorId) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/investors/${investorId}/ai-report`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detail = typeof body.detail === "string" ? body.detail : undefined;
        throw new Error(parseError(res.status, detail));
      }
      const data: AnalysisReport = await res.json();
      setReport(data);
      const savedAt = new Date().toISOString();
      setCachedAt(savedAt);
      localStorage.setItem(CACHE_KEY(investorId), JSON.stringify({ data, savedAt }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setGenerating(false);
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 lg:space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Financial Report</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Comprehensive AI-generated analysis of your complete financial position
          </p>
        </div>
        <Button onClick={generate} disabled={generating}>
          <RefreshCw className={`h-4 w-4 mr-2 ${generating ? "animate-spin" : ""}`} />
          {generating ? "Generating…" : report ? "Regenerate" : "Generate report"}
        </Button>
      </div>

      <AIDisclaimer />

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 text-sm p-4 rounded-lg border border-red-500/20 bg-red-500/5 text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="flex-1">{error}</div>
          <button onClick={generate} disabled={generating} className="text-xs font-medium underline underline-offset-2 shrink-0">
            Retry
          </button>
        </div>
      )}

      {/* Stale notice */}
      {showStale && !generating && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-3 text-sm text-amber-800">
          <Clock className="h-4 w-4 shrink-0" />
          Report from {ageLabel(cachedAt!)} — regenerate for the latest analysis.
          <button onClick={generate} className="ml-auto text-xs font-medium underline underline-offset-2">
            Refresh now
          </button>
        </div>
      )}

      {/* Empty state */}
      {!report && !generating && (
        <div className="space-y-4">
          <Card>
            <CardContent className="py-16 text-center space-y-4">
              <Sparkles className="h-10 w-10 text-muted-foreground mx-auto" />
              <div>
                <p className="text-sm font-medium mb-1">No report generated yet</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  The AI analyses your financial profile, risk model, portfolio, goals, strategies,
                  backtests, and paper trading to produce a comprehensive narrative report.
                </p>
              </div>
              <Button onClick={generate} disabled={generating}>
                Generate report
              </Button>
              <p className="text-xs text-muted-foreground">Takes ~15 seconds · Uses Claude Sonnet AI</p>
            </CardContent>
          </Card>

          {/* Setup hints */}
          <Card className="border-blue-200/60 bg-blue-50/30">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <div className="space-y-2 flex-1">
                  <p className="text-sm font-medium text-blue-900">For the richest report, complete as many sections as possible:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    {[
                      { label: "Financial Profile", href: "/financial", desc: "Income & expenses" },
                      { label: "Goals", href: "/goals", desc: "Investment targets" },
                      { label: "Risk Model", href: "/risk", desc: "Risk allocation" },
                      { label: "Holdings", href: "/investments", desc: "Current portfolio" },
                      { label: "Backtests", href: "/backtesting", desc: "Strategy results" },
                      { label: "Paper Trading", href: "/paper-trading", desc: "Simulated trades" },
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

      {/* Generating */}
      {generating && (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
            <p className="text-sm text-muted-foreground">
              Analysing your complete financial picture — this takes about 15 seconds…
            </p>
          </CardContent>
        </Card>
      )}

      {/* Report */}
      {report && !generating && (
        <>
          <p className="text-xs text-muted-foreground">
            Generated {new Date(report.generated_at).toLocaleString()}
            {cachedAt && ` · ${ageLabel(cachedAt)}`}
          </p>
          <div className="space-y-4">
            {SECTIONS.map(({ key, label }) => {
              const text = report[key] as string;
              if (!text || typeof text !== "string") return null;
              return (
                <Card key={key}>
                  <CardHeader>
                    <CardTitle className="text-base">{label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                      {text}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

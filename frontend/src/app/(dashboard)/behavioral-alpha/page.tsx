"use client";

import { useEffect, useState, useCallback } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import {
  Activity, TrendingUp, TrendingDown, BookOpen, Target,
  ShieldCheck, AlertTriangle, RefreshCw, Trophy, XCircle, Minus,
} from "lucide-react";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { "Content-Type": "application/json" } });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || `HTTP ${res.status}`); }
  return res.json();
}

interface AlphaDimension {
  label: string;
  group_a_label: string;
  group_b_label: string;
  group_a_avg_return: number | null;
  group_b_avg_return: number | null;
  alpha_pct: number | null;
  group_a_win_rate: number | null;
  group_b_win_rate: number | null;
  group_a_count: number;
  group_b_count: number;
  has_data: boolean;
}

interface DecisionHighlight {
  order_id: string;
  ticker: string | null;
  name: string;
  action: string;
  executed_at: string | null;
  estimated_value: number;
  currency: string;
  return_pct: number;
  had_rationale: boolean;
  was_goal_linked: boolean;
  pre_flight_verdict: string | null;
  rationale_snippet: string | null;
}

interface MistakePattern {
  pattern_key: string;
  label: string;
  description: string;
  frequency: number;
  estimated_avg_return_pct: number | null;
}

interface Report {
  documentation_alpha: AlphaDimension;
  goal_alignment_alpha: AlphaDimension;
  risk_compliance_alpha: AlphaDimension;
  best_decisions: DecisionHighlight[];
  worst_decisions: DecisionHighlight[];
  mistake_patterns: MistakePattern[];
  total_executed: number;
  priced_orders: number;
  price_coverage_pct: number;
  sufficient_data: boolean;
}

// ─── Alpha Card ───────────────────────────────────────────────────────────────

function AlphaCard({ dim, icon }: { dim: AlphaDimension; icon: React.ReactNode }) {
  const alpha = dim.alpha_pct;
  const positive = alpha !== null && alpha > 0;
  const alphaColor = alpha === null ? "text-muted-foreground" : positive ? "text-emerald-400" : "text-rose-400";
  const alphaBg = alpha === null ? "bg-muted/30 border-border" : positive ? "bg-emerald-500/8 border-emerald-500/20" : "bg-rose-500/8 border-rose-500/20";

  const ReturnNum = ({ val, count }: { val: number | null; count: number }) => {
    if (val === null) return <span className="text-muted-foreground text-xs">No data</span>;
    const pos = val >= 0;
    return (
      <div>
        <span className={`text-xl font-bold tabular-nums ${pos ? "text-emerald-400" : "text-rose-400"}`}>
          {val >= 0 ? "+" : ""}{val.toFixed(1)}%
        </span>
        <span className="text-[10px] text-muted-foreground ml-1">avg · {count} trades</span>
      </div>
    );
  };

  return (
    <Card className={`border ${alphaBg}`}>
      <CardContent className="pt-4 pb-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-primary">{icon}</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{dim.label}</span>
          </div>
          {alpha !== null && (
            <div className={`flex items-center gap-1 text-sm font-bold ${alphaColor}`}>
              {positive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {alpha >= 0 ? "+" : ""}{alpha.toFixed(1)}%
            </div>
          )}
        </div>

        {dim.has_data ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{dim.group_a_label}</p>
              <ReturnNum val={dim.group_a_avg_return} count={dim.group_a_count} />
              {dim.group_a_win_rate !== null && (
                <p className="text-[10px] text-muted-foreground">{(dim.group_a_win_rate * 100).toFixed(0)}% win rate</p>
              )}
            </div>
            <div className="space-y-1 border-l border-border pl-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{dim.group_b_label}</p>
              <ReturnNum val={dim.group_b_avg_return} count={dim.group_b_count} />
              {dim.group_b_win_rate !== null && (
                <p className="text-[10px] text-muted-foreground">{(dim.group_b_win_rate * 100).toFixed(0)}% win rate</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Needs {3 - dim.group_a_count - dim.group_b_count} more priced executed orders to unlock comparison.
          </p>
        )}

        {alpha !== null && dim.has_data && (
          <div className={`text-[11px] rounded px-2 py-1 text-center font-medium ${alphaBg} ${alphaColor}`}>
            {positive
              ? `${dim.group_a_label} trades outperform by ${alpha.toFixed(1)}%`
              : `${dim.group_b_label} trades currently lead — watch as history grows`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Decision Highlight row ───────────────────────────────────────────────────

function HighlightRow({ d, type }: { d: DecisionHighlight; type: "best" | "worst" }) {
  const pos = d.return_pct >= 0;
  const ReturnIcon = pos ? TrendingUp : TrendingDown;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <div className={`mt-0.5 rounded-full p-1 ${type === "best" ? "bg-emerald-500/15" : "bg-rose-500/15"}`}>
        {type === "best"
          ? <Trophy className="w-3 h-3 text-emerald-400" />
          : <XCircle className="w-3 h-3 text-rose-400" />}
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold">{d.ticker ?? d.name}</span>
          {d.ticker && d.name !== d.ticker && <span className="text-xs text-muted-foreground truncate max-w-40">{d.name}</span>}
          <div className="flex gap-1">
            {d.had_rationale && <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded px-1">documented</span>}
            {d.was_goal_linked && <span className="text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded px-1">goal</span>}
            {d.pre_flight_verdict && <span className={`text-[9px] rounded px-1 border ${
              d.pre_flight_verdict === "proceed" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
              d.pre_flight_verdict === "caution" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
              "bg-rose-500/10 text-rose-400 border-rose-500/20"
            }`}>{d.pre_flight_verdict}</span>}
          </div>
        </div>
        {d.rationale_snippet && <p className="text-[11px] text-muted-foreground/70 italic leading-relaxed">"{d.rationale_snippet}"</p>}
        {d.executed_at && <p className="text-[10px] text-muted-foreground">{new Date(d.executed_at).toLocaleDateString()}</p>}
      </div>
      <div className={`flex items-center gap-0.5 text-sm font-bold tabular-nums shrink-0 ${pos ? "text-emerald-400" : "text-rose-400"}`}>
        <ReturnIcon className="w-3.5 h-3.5" />
        {d.return_pct >= 0 ? "+" : ""}{d.return_pct.toFixed(1)}%
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function BehavioralAlphaPage() {
  const investorId = useInvestorId();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!investorId) return;
    setLoading(true); setError(null);
    try { setReport(await apiFetch<Report>(`/investors/${investorId}/behavioral-alpha`)); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [investorId]);

  useEffect(() => { load(); }, [load]);

  if (!investorId || loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Behavioral Alpha
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            How much your decision habits actually impact your returns — measured on your own history.
          </p>
        </div>
        <button onClick={load} className="p-2 text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && <div className="text-sm text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-3">{error}</div>}

      {report && (
        <>
          {/* Coverage note */}
          {report.total_executed > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 border border-border rounded-lg px-3 py-2">
              <Activity className="w-3.5 h-3.5 shrink-0" />
              {report.priced_orders} of {report.total_executed} executed buy orders have live price data
              ({report.price_coverage_pct.toFixed(0)}% coverage) — hit Reprice in Paper Trading to improve coverage.
            </div>
          )}

          {/* Alpha dimensions */}
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Alpha by Behavior</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <AlphaCard dim={report.documentation_alpha} icon={<BookOpen className="w-4 h-4" />} />
              <AlphaCard dim={report.goal_alignment_alpha} icon={<Target className="w-4 h-4" />} />
              <AlphaCard dim={report.risk_compliance_alpha} icon={<ShieldCheck className="w-4 h-4" />} />
            </div>
          </div>

          {/* Best / Worst decisions */}
          {(report.best_decisions.length > 0 || report.worst_decisions.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {report.best_decisions.length > 0 && (
                <Card>
                  <CardContent className="pt-4 pb-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5 text-emerald-400" /> Best Decisions
                    </p>
                    {report.best_decisions.map(d => <HighlightRow key={d.order_id} d={d} type="best" />)}
                  </CardContent>
                </Card>
              )}
              {report.worst_decisions.length > 0 && (
                <Card>
                  <CardContent className="pt-4 pb-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5 text-rose-400" /> Costliest Decisions
                    </p>
                    {report.worst_decisions.map(d => <HighlightRow key={d.order_id} d={d} type="worst" />)}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Mistake patterns */}
          {report.mistake_patterns.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mistake Patterns</h2>
              <div className="space-y-2">
                {report.mistake_patterns.map(p => (
                  <div key={p.pattern_key} className="flex items-start gap-3 bg-rose-500/5 border border-rose-500/15 rounded-lg px-4 py-3">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{p.label}</span>
                        <span className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded px-1.5 py-0.5">
                          {p.frequency}×
                        </span>
                        {p.estimated_avg_return_pct !== null && (
                          <span className={`text-[10px] rounded px-1.5 py-0.5 border font-medium ${
                            p.estimated_avg_return_pct >= 0
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          }`}>
                            avg {p.estimated_avg_return_pct >= 0 ? "+" : ""}{p.estimated_avg_return_pct.toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{p.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!report.sufficient_data && (
            <Card>
              <CardContent className="py-12 text-center space-y-2">
                <Activity className="w-8 h-8 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Execute 3+ buy orders and hit Reprice to unlock behavioral alpha analysis.
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Alpha is computed from live price cache vs. your entry price on executed orders —
                  no manual data entry needed.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

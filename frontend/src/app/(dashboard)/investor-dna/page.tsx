"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import {
  Fingerprint, CheckCircle2, XCircle, ArrowRight, RefreshCw,
  TrendingUp, AlertTriangle, Lightbulb, BarChart3, Minus,
} from "lucide-react";
import { MetricTooltip } from "@/components/ui/metric-tooltip";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface DnaSignal {
  key: string;
  title: string;
  value: string;
  detail: string;
}

interface LeakageByClass {
  asset_class: string;
  documented_count: number;
  undocumented_count: number;
  documented_avg_return_pct: number | null;
  undocumented_avg_return_pct: number | null;
  leakage_pct: number | null;
  leakage_dollar: number | null;
  currency: string;
}

interface DnaRecommendation {
  continue_doing: string[];
  reduce: string[];
  avoid: string[];
}

interface InvestorDnaReport {
  has_sufficient_data: boolean;
  total_executed: number;
  priced_orders: number;
  dqs: number | null;
  dqs_label: string | null;
  doc_rate: number | null;
  goal_rate: number | null;
  edge: DnaSignal[];
  risks: DnaSignal[];
  recommendation: DnaRecommendation;
  leakage_by_class: LeakageByClass[];
  total_leakage_dollar: number | null;
  total_leakage_currency: string | null;
  generated_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function dqsColor(score: number) {
  if (score >= 80) return "text-emerald-400";
  if (score >= 65) return "text-sky-400";
  if (score >= 45) return "text-amber-400";
  return "text-rose-400";
}

function pctBar(pct: number | null, color: string) {
  if (pct === null) return null;
  const width = Math.min(Math.abs(pct) * 3, 100);
  return (
    <div className="h-1 rounded-full bg-white/8 mt-1.5 overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} />
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SignalRow({ signal, variant }: { signal: DnaSignal; variant: "edge" | "risk" }) {
  const isEdge = variant === "edge";
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${
      isEdge
        ? "border-emerald-500/20 bg-emerald-500/5"
        : "border-rose-500/20 bg-rose-500/5"
    }`}>
      <div className="mt-0.5 shrink-0">
        {isEdge
          ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          : <XCircle className="w-4 h-4 text-rose-400" />}
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-foreground">{signal.title}</span>
          <span className={`text-sm font-mono font-bold shrink-0 ${isEdge ? "text-emerald-400" : "text-rose-400"}`}>
            {signal.value}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{signal.detail}</p>
      </div>
    </div>
  );
}

function LeakageTable({ rows, total, currency }: {
  rows: LeakageByClass[];
  total: number | null;
  currency: string | null;
}) {
  const relevant = rows.filter(r => r.documented_count + r.undocumented_count >= 2);
  if (relevant.length === 0) return null;

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <MetricTooltip content="Breaks down the documented vs undocumented return gap by asset class. Positive gap = documented trades outperformed in that class. Dollar impact estimated from live price data.">
              Capital Leakage Attribution
            </MetricTooltip>
          </h2>
          {total != null && currency && total > 0 && (
            <div className="text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded px-2.5 py-1">
              Total leakage: -{total.toLocaleString()} {currency}
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-muted-foreground/60 border-b border-white/6">
                <th className="text-left pb-2 font-medium">Asset Class</th>
                <th className="text-right pb-2 font-medium">Documented avg</th>
                <th className="text-right pb-2 font-medium">Undocumented avg</th>
                <th className="text-right pb-2 font-medium">Gap</th>
                <th className="text-right pb-2 font-medium">Dollar impact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/4">
              {relevant.map(row => {
                const gapColor = (row.leakage_pct ?? 0) > 0
                  ? "text-rose-400"
                  : (row.leakage_pct ?? 0) < 0
                  ? "text-emerald-400"
                  : "text-muted-foreground";
                return (
                  <tr key={row.asset_class} className="hover:bg-white/2 transition-colors">
                    <td className="py-2 font-medium text-foreground capitalize">{row.asset_class}</td>
                    <td className="py-2 text-right text-emerald-400 font-mono">
                      {row.documented_avg_return_pct != null
                        ? `${row.documented_avg_return_pct >= 0 ? "+" : ""}${row.documented_avg_return_pct.toFixed(1)}%`
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2 text-right text-muted-foreground font-mono">
                      {row.undocumented_avg_return_pct != null
                        ? `${row.undocumented_avg_return_pct >= 0 ? "+" : ""}${row.undocumented_avg_return_pct.toFixed(1)}%`
                        : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className={`py-2 text-right font-mono font-semibold ${gapColor}`}>
                      {row.leakage_pct != null
                        ? `${row.leakage_pct >= 0 ? "+" : ""}${row.leakage_pct.toFixed(1)}%`
                        : "—"}
                    </td>
                    <td className="py-2 text-right">
                      {row.leakage_dollar != null && row.leakage_dollar !== 0 ? (
                        <span className={row.leakage_dollar > 0 ? "text-rose-400 font-semibold" : "text-emerald-400 font-semibold"}>
                          {row.leakage_dollar > 0 ? "-" : "+"}{Math.abs(row.leakage_dollar).toLocaleString()} {row.currency}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-muted-foreground/50">
          Gap = documented avg return minus undocumented avg return. Positive gap means documented trades outperformed.
          Dollar impact is estimated from current price data.
        </p>
      </CardContent>
    </Card>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function InvestorDnaPage() {
  const investorId = useInvestorId();
  const [report, setReport] = useState<InvestorDnaReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!investorId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<InvestorDnaReport>(`/investors/${investorId}/investor-dna`);
      setReport(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load Investor DNA");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [investorId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Fingerprint className="w-5 h-5 text-primary" />
            Investor DNA
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            What TradeOps has learned about your decision-making patterns.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-muted/40 text-muted-foreground border border-border hover:bg-muted/70 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded px-4 py-3">
          {error}
        </div>
      )}

      {loading && !report && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-3 text-primary" />
          Analysing your decision history…
        </div>
      )}

      {report && (
        <>
          {/* Stats strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {report.dqs != null && (
              <div className="rounded-lg border border-white/8 bg-white/3 p-4 text-center">
                <div className={`text-2xl font-bold tabular-nums ${dqsColor(report.dqs)}`}>
                  {report.dqs.toFixed(0)}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">
                  <MetricTooltip content="Decision Quality Score (0–100) — composite measure of your decision discipline across documentation, risk handling, goal alignment, and outcome correlation.">DQS</MetricTooltip>
                </div>
                {report.dqs_label && (
                  <div className={`text-[10px] font-medium mt-0.5 ${dqsColor(report.dqs)}`}>{report.dqs_label}</div>
                )}
              </div>
            )}
            <div className="rounded-lg border border-white/8 bg-white/3 p-4 text-center">
              <div className="text-2xl font-bold tabular-nums text-foreground">{report.total_executed}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Decisions</div>
            </div>
            {report.doc_rate != null && (
              <div className="rounded-lg border border-white/8 bg-white/3 p-4 text-center">
                <div className={`text-2xl font-bold tabular-nums ${report.doc_rate >= 0.65 ? "text-emerald-400" : report.doc_rate >= 0.35 ? "text-amber-400" : "text-rose-400"}`}>
                  {(report.doc_rate * 100).toFixed(0)}%
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">
                <MetricTooltip content="Percentage of executed orders with a written rationale. Strong predictor of better performance — documented trades outperform undocumented ones on average.">Documented</MetricTooltip>
              </div>
              </div>
            )}
            {report.total_leakage_dollar != null && report.total_leakage_dollar > 0 && report.total_leakage_currency && (
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-4 text-center">
                <div className="text-2xl font-bold tabular-nums text-rose-400">
                  -{report.total_leakage_dollar.toLocaleString()}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">
                  <MetricTooltip content="Estimated dollar cost of undocumented execution — the return gap between your documented and undocumented trades, scaled to your actual position sizes.">
                    Leakage ({report.total_leakage_currency})
                  </MetricTooltip>
                </div>
              </div>
            )}
          </div>

          {!report.has_sufficient_data && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-300 text-center">
              <AlertTriangle className="w-4 h-4 mx-auto mb-2" />
              Not enough priced execution history yet — patterns will surface after {3 - report.priced_orders} more executed orders with live price data.
            </div>
          )}

          {report.has_sufficient_data && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Edge */}
              <Card>
                <CardContent className="p-5 space-y-3">
                  <h2 className="font-semibold text-sm flex items-center gap-2 text-emerald-400">
                    <TrendingUp className="w-4 h-4" />
                    <MetricTooltip content="Behavioral patterns where your documented, deliberate approach consistently outperforms your undocumented trades. Computed from your actual returns — not predictions.">
                      Your Edge
                    </MetricTooltip>
                  </h2>
                  {report.edge.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No consistent outperformance patterns detected yet. Keep building your history.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {report.edge.map(s => <SignalRow key={s.key} signal={s} variant="edge" />)}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Risks */}
              <Card>
                <CardContent className="p-5 space-y-3">
                  <h2 className="font-semibold text-sm flex items-center gap-2 text-rose-400">
                    <AlertTriangle className="w-4 h-4" />
                    <MetricTooltip content="Behavioral anti-patterns visible in your execution history that cost you performance. Computed from your actual returns — these are facts about your past decisions, not opinions.">
                      Your Risks
                    </MetricTooltip>
                  </h2>
                  {report.risks.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No significant behavioral risk patterns detected. Keep your current discipline.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {report.risks.map(s => <SignalRow key={s.key} signal={s} variant="risk" />)}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Leakage table */}
          {report.has_sufficient_data && (
            <LeakageTable
              rows={report.leakage_by_class}
              total={report.total_leakage_dollar}
              currency={report.total_leakage_currency}
            />
          )}

          {/* Recommendation */}
          {report.has_sufficient_data && (
            <Card>
              <CardContent className="p-5 space-y-4">
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-primary" />
                  TradeOps Recommendation
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Continue */}
                  {report.recommendation.continue_doing.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400">Continue</div>
                      <div className="space-y-1.5">
                        {report.recommendation.continue_doing.map((item, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-foreground">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Reduce */}
                  {report.recommendation.reduce.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-400">Reduce</div>
                      <div className="space-y-1.5">
                        {report.recommendation.reduce.map((item, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-foreground">
                            <Minus className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Avoid */}
                  {report.recommendation.avoid.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-rose-400">Avoid</div>
                      <div className="space-y-1.5">
                        {report.recommendation.avoid.map((item, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-foreground">
                            <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {report.recommendation.continue_doing.length === 0 &&
                   report.recommendation.reduce.length === 0 &&
                   report.recommendation.avoid.length === 0 && (
                    <div className="col-span-3 text-sm text-muted-foreground text-center py-2">
                      Insufficient pattern data for a recommendation. Stage and execute more orders with rationale.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <p className="text-[10px] text-muted-foreground/40 text-center">
            DNA profile derived from {report.priced_orders} priced executions as of {new Date(report.generated_at).toLocaleDateString()}.
            Analytical only — not financial advice.
          </p>
        </>
      )}
    </div>
  );
}

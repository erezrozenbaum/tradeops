"use client";

import { useEffect, useState, useCallback } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent } from "@/components/ui/card";
import { formatPercent } from "@/lib/utils";
import {
  BrainCircuit, TrendingUp, TrendingDown, Minus,
  ShieldCheck, BookOpen, Target, BarChart2,
  RefreshCw, AlertTriangle, CheckCircle2, Lightbulb, Sparkles,
} from "lucide-react";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

interface DQSComponents {
  documentation: number;
  risk_intelligence: number;
  goal_alignment: number;
  outcome_correlation: number;
}

interface OutcomeComparison {
  documented_avg_return_pct: number | null;
  undocumented_avg_return_pct: number | null;
  documented_win_rate: number | null;
  undocumented_win_rate: number | null;
  outperformance_pct: number | null;
  sample_documented: number;
  sample_undocumented: number;
  has_sufficient_data: boolean;
}

interface BehavioralInsight {
  category: "strength" | "warning" | "pattern" | "opportunity";
  title: string;
  body: string;
  metric: string | null;
}

interface DQSHistoryPoint {
  month: string;
  score: number;
  order_count: number;
}

interface Report {
  dqs: number;
  dqs_label: string;
  components: DQSComponents;
  trend: string;
  trend_delta: number | null;
  dqs_history: DQSHistoryPoint[];
  insights: BehavioralInsight[];
  outcome_comparison: OutcomeComparison | null;
  coach_notes: string[];
  total_orders: number;
  executed_orders: number;
  documented_orders: number;
  sufficient_data: boolean;
}

// ─── DQS Gauge ────────────────────────────────────────────────────────────────

function DQSGauge({ score, label }: { score: number; label: string }) {
  const R = 70;
  const cx = 90;
  const cy = 90;
  const arcStart = Math.PI * 0.75;
  const arcEnd = Math.PI * 2.25;
  const totalArc = arcEnd - arcStart;

  const polarToXY = (angle: number, r: number) => ({
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  });

  const describeArc = (startAngle: number, endAngle: number, r: number) => {
    const s = polarToXY(startAngle, r);
    const e = polarToXY(endAngle, r);
    const large = endAngle - startAngle > Math.PI ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  const filledEnd = arcStart + (score / 100) * totalArc;

  const color =
    score >= 80 ? "#10b981" :
    score >= 65 ? "#3b82f6" :
    score >= 45 ? "#f59e0b" :
    "#ef4444";

  const trackColor = "var(--border)";

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 180 120" className="w-52 h-36">
        {/* Track */}
        <path
          d={describeArc(arcStart, arcEnd, R)}
          fill="none"
          stroke={trackColor}
          strokeWidth="12"
          strokeLinecap="round"
          opacity="0.25"
        />
        {/* Fill */}
        {score > 0 && (
          <path
            d={describeArc(arcStart, filledEnd, R)}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
          />
        )}
        {/* Score text */}
        <text
          x={cx}
          y={cy + 8}
          textAnchor="middle"
          fontSize="28"
          fontWeight="700"
          fill="currentColor"
          className="fill-foreground"
        >
          {score.toFixed(0)}
        </text>
        <text
          x={cx}
          y={cy + 24}
          textAnchor="middle"
          fontSize="10"
          fill="currentColor"
          className="fill-muted-foreground"
        >
          / 100
        </text>
      </svg>
      <span
        className="text-sm font-semibold -mt-2"
        style={{ color }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── Component bar ─────────────────────────────────────────────────────────────

function ComponentBar({
  label,
  value,
  max,
  icon,
}: {
  label: string;
  value: number;
  max: number;
  icon: React.ReactNode;
}) {
  const pct = Math.min(100, (value / max) * 100);
  const color =
    pct >= 80 ? "bg-emerald-500" :
    pct >= 55 ? "bg-blue-500" :
    pct >= 35 ? "bg-amber-500" :
    "bg-rose-500";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className="tabular-nums font-medium text-foreground">
          {value.toFixed(1)} / {max}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Insight card ─────────────────────────────────────────────────────────────

function InsightCard({ insight }: { insight: BehavioralInsight }) {
  const cfg: Record<string, { bg: string; border: string; icon: React.ReactNode; label: string }> = {
    strength:    { bg: "bg-emerald-500/5",  border: "border-emerald-500/20", icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />, label: "Strength" },
    warning:     { bg: "bg-rose-500/5",     border: "border-rose-500/20",    icon: <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />,    label: "Warning" },
    pattern:     { bg: "bg-blue-500/5",     border: "border-blue-500/20",    icon: <BarChart2 className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />,        label: "Pattern" },
    opportunity: { bg: "bg-amber-500/5",    border: "border-amber-500/20",   icon: <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />,       label: "Opportunity" },
  };
  const style = cfg[insight.category] ?? cfg.pattern;

  return (
    <div className={`rounded-lg border p-4 space-y-2 ${style.bg} ${style.border}`}>
      <div className="flex items-start gap-2">
        {style.icon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground">{insight.title}</p>
            {insight.metric && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${style.border} ${style.bg}`}>
                {insight.metric}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mt-1">{insight.body}</p>
        </div>
      </div>
    </div>
  );
}

// ─── DQS History bars ─────────────────────────────────────────────────────────

function DQSHistoryChart({ history }: { history: DQSHistoryPoint[] }) {
  if (history.length === 0) return null;
  const maxScore = Math.max(...history.map(h => h.score), 1);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Monthly DQS trend</p>
      <div className="flex items-end gap-1 h-16">
        {history.map((point) => {
          const heightPct = (point.score / maxScore) * 100;
          const color =
            point.score >= 80 ? "bg-emerald-500" :
            point.score >= 65 ? "bg-blue-500" :
            point.score >= 45 ? "bg-amber-500" :
            "bg-rose-500";
          return (
            <div key={point.month} className="flex-1 flex flex-col items-center gap-0.5" title={`${point.month}: ${point.score}`}>
              <div className="w-full flex items-end justify-center h-14">
                <div
                  className={`w-full rounded-t ${color} opacity-75 transition-all`}
                  style={{ height: `${heightPct}%`, minHeight: "2px" }}
                />
              </div>
              <span className="text-[9px] text-muted-foreground/60 rotate-[-45deg] origin-top-left translate-y-1">
                {point.month.slice(5)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Outcome comparison ───────────────────────────────────────────────────────

function OutcomeComparisonCard({ oc }: { oc: OutcomeComparison | null }) {
  if (!oc || !oc.has_sufficient_data) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-5 space-y-2 text-center">
        <Sparkles className="w-5 h-5 text-muted-foreground/40 mx-auto" />
        <p className="text-sm font-medium text-muted-foreground">Outcome Correlation Unlocks Soon</p>
        <p className="text-xs text-muted-foreground/70 max-w-xs mx-auto">
          Once you have 3+ executed buy orders with live price data, TradeOps will show whether
          your documented decisions outperform undocumented ones — using your actual market returns.
        </p>
        <div className="flex justify-center gap-6 pt-2 opacity-40 pointer-events-none select-none" aria-hidden>
          <div className="text-center">
            <div className="text-xl font-bold text-emerald-400">+14.3%</div>
            <div className="text-[10px] text-muted-foreground">Documented</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-rose-400">−3.1%</div>
            <div className="text-[10px] text-muted-foreground">Undocumented</div>
          </div>
        </div>
      </div>
    );
  }

  const op = oc.outperformance_pct;
  const hasBoth = oc.documented_avg_return_pct !== null && oc.undocumented_avg_return_pct !== null;
  const docPositive = (oc.documented_avg_return_pct ?? 0) >= 0;
  const undocPositive = (oc.undocumented_avg_return_pct ?? 0) >= 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <BarChart2 className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold">Outcome Correlation — Your Data</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className={`rounded-lg p-3 space-y-0.5 ${docPositive ? "bg-emerald-500/8 border border-emerald-500/15" : "bg-rose-500/8 border border-rose-500/15"}`}>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <BookOpen className="w-3 h-3" /> Documented
          </p>
          {oc.documented_avg_return_pct !== null ? (
            <p className={`text-2xl font-bold tabular-nums ${docPositive ? "text-emerald-400" : "text-rose-400"}`}>
              {oc.documented_avg_return_pct >= 0 ? "+" : ""}{oc.documented_avg_return_pct.toFixed(1)}%
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No data</p>
          )}
          {oc.documented_win_rate !== null && (
            <p className="text-[11px] text-muted-foreground">{(oc.documented_win_rate * 100).toFixed(0)}% win rate · {oc.sample_documented} trades</p>
          )}
        </div>

        <div className={`rounded-lg p-3 space-y-0.5 ${undocPositive ? "bg-emerald-500/8 border border-emerald-500/15" : "bg-rose-500/8 border border-rose-500/15"}`}>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Undocumented
          </p>
          {oc.undocumented_avg_return_pct !== null ? (
            <p className={`text-2xl font-bold tabular-nums ${undocPositive ? "text-emerald-400" : "text-rose-400"}`}>
              {oc.undocumented_avg_return_pct >= 0 ? "+" : ""}{oc.undocumented_avg_return_pct.toFixed(1)}%
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No data yet</p>
          )}
          {oc.undocumented_win_rate !== null && (
            <p className="text-[11px] text-muted-foreground">{(oc.undocumented_win_rate * 100).toFixed(0)}% win rate · {oc.sample_undocumented} trades</p>
          )}
        </div>
      </div>

      {hasBoth && op !== null && (
        <div className={`text-center text-xs rounded-lg py-2 px-3 font-medium ${
          op > 0
            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
        }`}>
          {op > 0
            ? `Documented trades outperform by ${op.toFixed(1)}% — your thesis-writing habit pays off`
            : `Undocumented trades lead by ${Math.abs(op).toFixed(1)}% — watch this as your history grows`
          }
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DecisionIntelligencePage() {
  const investorId = useInvestorId();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!investorId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Report>(`/investors/${investorId}/decision-intelligence`);
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [investorId]);

  useEffect(() => { load(); }, [load]);

  const TrendIcon = !report ? null :
    report.trend === "improving" ? TrendingUp :
    report.trend === "declining" ? TrendingDown :
    Minus;

  const trendColor =
    report?.trend === "improving" ? "text-emerald-400" :
    report?.trend === "declining" ? "text-rose-400" :
    "text-muted-foreground";

  if (!investorId || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-primary" />
            Decision Intelligence
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            How well you make decisions — independent of market performance.
          </p>
        </div>
        <button
          onClick={load}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="text-sm text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {report && (
        <>
          {/* ─── Hero: DQS + components + trend ─── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Score gauge */}
            <Card className="md:col-span-1">
              <CardContent className="pt-6 pb-4 flex flex-col items-center space-y-3">
                <DQSGauge score={report.dqs} label={report.dqs_label} />
                {TrendIcon && (
                  <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
                    <TrendIcon className="w-3.5 h-3.5" />
                    {report.trend === "improving" && report.trend_delta
                      ? `+${report.trend_delta.toFixed(0)} pts recent trend`
                      : report.trend === "declining" && report.trend_delta
                      ? `${report.trend_delta.toFixed(0)} pts recent trend`
                      : report.trend === "stable"
                      ? "Stable"
                      : "Not enough history yet"}
                  </div>
                )}
                <div className="text-[11px] text-muted-foreground text-center space-y-0.5">
                  <div>{report.total_orders} orders · {report.documented_orders} documented</div>
                  <div>{report.executed_orders} executed</div>
                </div>
              </CardContent>
            </Card>

            {/* Component breakdown + history */}
            <Card className="md:col-span-2">
              <CardContent className="pt-5 pb-5 space-y-5">
                <div className="space-y-3">
                  <ComponentBar
                    label="Documentation Discipline"
                    value={report.components.documentation}
                    max={35}
                    icon={<BookOpen className="w-3.5 h-3.5" />}
                  />
                  <ComponentBar
                    label="Risk Intelligence"
                    value={report.components.risk_intelligence}
                    max={30}
                    icon={<ShieldCheck className="w-3.5 h-3.5" />}
                  />
                  <ComponentBar
                    label="Goal Alignment"
                    value={report.components.goal_alignment}
                    max={20}
                    icon={<Target className="w-3.5 h-3.5" />}
                  />
                  <ComponentBar
                    label="Outcome Correlation"
                    value={report.components.outcome_correlation}
                    max={15}
                    icon={<BarChart2 className="w-3.5 h-3.5" />}
                  />
                </div>
                {report.dqs_history.length > 1 && (
                  <DQSHistoryChart history={report.dqs_history} />
                )}
              </CardContent>
            </Card>
          </div>

          {/* ─── Outcome Correlation ─── */}
          <OutcomeComparisonCard oc={report.outcome_comparison} />

          {/* ─── Behavioral Insights ─── */}
          {report.insights.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-0.5">
                Behavioral Insights
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {report.insights.map((ins, i) => (
                  <InsightCard key={i} insight={ins} />
                ))}
              </div>
            </div>
          )}

          {/* ─── Coach ─── */}
          {report.coach_notes.length > 0 && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-5 pb-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold">Coach</p>
                </div>
                <ul className="space-y-2">
                  {report.coach_notes.map((note, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                      <span className="text-primary mt-0.5 shrink-0">→</span>
                      {note}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* ─── Empty state ─── */}
          {!report.sufficient_data && (
            <Card>
              <CardContent className="py-12 text-center space-y-3">
                <BrainCircuit className="w-8 h-8 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Stage and document your first orders to start building your Decision Quality profile.
                </p>
                <p className="text-xs text-muted-foreground/70">
                  The more orders you stage — especially with written rationale — the more precisely
                  the system can measure your decision quality and show you what your patterns reveal.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

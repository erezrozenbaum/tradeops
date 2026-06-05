"use client";

import { useEffect, useState, useCallback } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent } from "@/components/ui/card";
import {
  TrendingUp, TrendingDown, Minus, RefreshCw, LineChart,
  CheckCircle2, AlertTriangle, Clock, X, ShieldAlert, Zap,
} from "lucide-react";
import { MetricTooltip } from "@/components/ui/metric-tooltip";

// ── Types ──────────────────────────────────────────────────────────────────────

interface WindowMetrics {
  dqs: number | null;
  doc_rate_pct: number | null;
  risk_overrides: number;
  behavioral_alpha_pct: number | null;
  order_count: number;
}

interface MetricDelta {
  key: string;
  title: string;
  previous: number | null;
  current: number | null;
  delta: number | null;
  direction: "improving" | "declining" | "stable" | "insufficient_data";
  unit: string;
}

interface InvestorEvolutionReport {
  investor_id: string;
  has_sufficient_data: boolean;
  has_comparison: boolean;
  current_window_start: string;
  current_window_end: string;
  previous_window_start: string | null;
  previous_window_end: string | null;
  current: WindowMetrics;
  previous: WindowMetrics | null;
  deltas: MetricDelta[];
  strengths: string[];
  concerns: string[];
  patterns: BehavioralPattern[];
  generated_at: string;
}

interface BehavioralPattern {
  key: string;
  name: string;
  severity: "high" | "medium" | "low";
  description: string;
  implication: string;
  metric: string | null;
}

interface OverrideOrder {
  id: string;
  ticker: string | null;
  name: string | null;
  action: string;
  quantity: number | null;
  unit_price: number | null;
  currency: string;
  rationale: string | null;
  created_at: string;
}

// ── API ────────────────────────────────────────────────────────────────────────

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { "Content-Type": "application/json" } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(value: number | null, unit: string): string {
  if (value === null) return "—";
  if (unit === "%") return `${value.toFixed(1)}%`;
  if (unit === "points") return value.toFixed(1);
  if (unit === "count") return String(Math.round(value));
  return String(value);
}

function fmtDelta(delta: number | null, unit: string, invert = false): string {
  if (delta === null) return "—";
  const sign = delta > 0 ? "+" : "";
  if (unit === "%") return `${sign}${delta.toFixed(1)}%`;
  if (unit === "points") return `${sign}${delta.toFixed(1)}`;
  if (unit === "count") {
    const effective = invert ? -delta : delta;
    return effective > 0 ? `▼ ${Math.abs(delta)}` : effective < 0 ? `▲ ${Math.abs(delta)}` : "—";
  }
  return `${sign}${delta}`;
}

function directionColors(direction: string) {
  if (direction === "improving") return { text: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/25" };
  if (direction === "declining") return { text: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/25" };
  return { text: "text-muted-foreground", bg: "bg-muted/20 border-border" };
}

function DirectionIcon({ direction }: { direction: string }) {
  if (direction === "improving") return <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />;
  if (direction === "declining") return <TrendingDown className="w-3.5 h-3.5 text-rose-400" />;
  return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ── Metric tooltips ────────────────────────────────────────────────────────────

const METRIC_TOOLTIPS: Record<string, string> = {
  dqs: "Decision Quality Score (0–100) — average decision discipline across documentation, risk handling, goal alignment, and outcome tracking. Same formula as the Decision Intelligence page.",
  doc_rate: "Percentage of executed orders that included a written rationale before execution. Higher rates correlate with better long-term performance — documented trades tend to outperform undocumented ones.",
  risk_overrides: "Orders executed despite the pre-flight engine issuing a 'Reconsider' verdict. Lower is better. Click to see the full list when count > 0.",
  behavioral_alpha: "Estimated return gap between your documented and undocumented trades in this 90-day window, based on live price data. Positive = your documentation discipline generated measurable alpha.",
};

// ── Metric Card ────────────────────────────────────────────────────────────────

function MetricCard({
  delta,
  hasComparison,
  onClick,
}: {
  delta: MetricDelta;
  hasComparison: boolean;
  onClick?: () => void;
}) {
  const { text, bg } = directionColors(delta.direction);
  const isOverride = delta.key === "risk_overrides";
  const isClickable = isOverride && delta.current !== null && delta.current > 0 && onClick;

  return (
    <div
      className={`rounded-lg border p-4 space-y-3 ${bg} ${isClickable ? "cursor-pointer hover:brightness-110 transition-all" : ""}`}
      onClick={isClickable ? onClick : undefined}
      title={isClickable ? "Click to see override orders" : undefined}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
          {METRIC_TOOLTIPS[delta.key]
            ? <MetricTooltip content={METRIC_TOOLTIPS[delta.key]}>{delta.title}</MetricTooltip>
            : delta.title}
        </span>
        <div className="flex items-center gap-1.5">
          {isClickable && <ShieldAlert className="w-3 h-3 text-amber-400 opacity-70" />}
          <DirectionIcon direction={delta.direction} />
        </div>
      </div>

      {hasComparison ? (
        <div className="flex items-end gap-3">
          <div className="space-y-0.5">
            <div className="text-[10px] text-muted-foreground/60">Previous 90d</div>
            <div className="text-lg font-semibold text-muted-foreground/70">{fmt(delta.previous, delta.unit)}</div>
          </div>
          <div className="text-muted-foreground/30 pb-1">→</div>
          <div className="space-y-0.5">
            <div className="text-[10px] text-muted-foreground/60">Current 90d</div>
            <div className={`text-2xl font-bold ${text}`}>{fmt(delta.current, delta.unit)}</div>
          </div>
        </div>
      ) : (
        <div className="space-y-0.5">
          <div className="text-[10px] text-muted-foreground/60">Current 90d</div>
          <div className={`text-2xl font-bold ${text}`}>{fmt(delta.current, delta.unit)}</div>
        </div>
      )}

      {hasComparison && delta.delta !== null && (
        <div className={`text-xs font-medium ${text}`}>
          {isOverride
            ? delta.delta < 0
              ? `${Math.abs(delta.delta)} fewer — improved`
              : delta.delta > 0
              ? `${delta.delta} more — watch this`
              : "No change"
            : fmtDelta(delta.delta, delta.unit)}
        </div>
      )}
    </div>
  );
}

// ── Behavioral Patterns ────────────────────────────────────────────────────────

const SEVERITY_STYLE = {
  high: {
    card: "border-rose-500/25 bg-rose-500/5",
    badge: "bg-rose-500/15 text-rose-400",
    metric: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
  },
  medium: {
    card: "border-amber-500/25 bg-amber-500/5",
    badge: "bg-amber-500/15 text-amber-400",
    metric: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  },
  low: {
    card: "border-blue-500/25 bg-blue-500/5",
    badge: "bg-blue-500/15 text-blue-400",
    metric: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  },
};

function PatternCard({ pattern }: { pattern: BehavioralPattern }) {
  const s = SEVERITY_STYLE[pattern.severity] ?? SEVERITY_STYLE.low;
  return (
    <div className={`rounded-lg border p-4 space-y-2.5 ${s.card}`}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <span className="text-sm font-semibold text-foreground">{pattern.name}</span>
        <div className="flex items-center gap-2 shrink-0">
          {pattern.metric && (
            <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded ${s.metric}`}>
              {pattern.metric}
            </span>
          )}
          <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${s.badge}`}>
            {pattern.severity}
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{pattern.description}</p>
      <p className="text-[11px] text-foreground/60 leading-relaxed border-l-2 border-current/15 pl-2.5 italic">
        {pattern.implication}
      </p>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function InvestorEvolutionPage() {
  const investorId = useInvestorId();
  const [report, setReport] = useState<InvestorEvolutionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [overrides, setOverrides] = useState<OverrideOrder[] | null>(null);
  const [overridesLoading, setOverridesLoading] = useState(false);
  const [showOverrides, setShowOverrides] = useState(false);

  async function fetchOverrides() {
    if (!investorId) return;
    setOverridesLoading(true);
    setShowOverrides(true);
    try {
      const data = await apiFetch<OverrideOrder[]>(`/investors/${investorId}/investor-evolution/overrides`);
      setOverrides(data);
    } catch {
      setOverrides([]);
    } finally {
      setOverridesLoading(false);
    }
  }

  const fetchReport = useCallback(async () => {
    if (!investorId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<InvestorEvolutionReport>(`/investors/${investorId}/investor-evolution`);
      setReport(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [investorId]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Override drill-down modal */}
      {showOverrides && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold">Risk Overrides — Current 90-day Window</h3>
              </div>
              <button onClick={() => setShowOverrides(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
              {overridesLoading && (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              )}
              {!overridesLoading && overrides && overrides.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No override orders in the current window.</p>
              )}
              {!overridesLoading && overrides && overrides.map(o => (
                <div key={o.id} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{o.ticker ?? "—"}</span>
                      {o.name && <span className="text-xs text-muted-foreground truncate max-w-32">{o.name}</span>}
                      <span className={`text-[10px] font-medium uppercase px-1.5 py-0.5 rounded ${o.action === "buy" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                        {o.action}
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {o.quantity != null && o.unit_price != null
                      ? `${o.quantity} × ${o.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${o.currency}`
                      : o.currency}
                  </div>
                  {o.rationale ? (
                    <p className="text-[12px] text-foreground/80 leading-relaxed border-l-2 border-amber-500/30 pl-2">
                      {o.rationale}
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground/50 italic">No rationale documented — blind override.</p>
                  )}
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-border shrink-0">
              <p className="text-[11px] text-muted-foreground/50">
                These orders were executed despite a pre-flight "Reconsider" verdict within the current 90-day window.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <LineChart className="w-5 h-5 text-primary" />
            Investor Evolution
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Current you vs historical you — rolling 90-day behavioral improvement.
          </p>
        </div>
        <button
          onClick={fetchReport}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-muted/40 text-muted-foreground border border-border hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-400">
          {error}
        </div>
      )}

      {!loading && report && !report.has_sufficient_data && (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <Clock className="w-8 h-8 text-muted-foreground/40 mx-auto" />
            <div className="text-sm font-medium text-foreground">Evolution report unlocks after 90 days of decisions</div>
            <div className="text-[13px] text-muted-foreground max-w-sm mx-auto leading-relaxed">
              You currently have {report.current.order_count} order{report.current.order_count !== 1 ? "s" : ""} in the current window.
              Keep staging and executing orders — the evolution engine needs at least 3 to establish a baseline.
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && report && report.has_sufficient_data && (
        <>
          {/* Window banner */}
          <div className="rounded-lg border border-white/8 bg-white/3 px-4 py-3 text-xs text-muted-foreground flex flex-wrap gap-4 items-center">
            {report.has_comparison && report.previous_window_start && report.previous_window_end && (
              <span>
                <span className="text-muted-foreground/50">Previous window:</span>{" "}
                <span className="text-foreground">{formatDate(report.previous_window_start)} → {formatDate(report.previous_window_end)}</span>
                <span className="ml-2 text-muted-foreground/40">({report.previous?.order_count} orders)</span>
              </span>
            )}
            <span>
              <span className="text-muted-foreground/50">Current window:</span>{" "}
              <span className="text-foreground">{formatDate(report.current_window_start)} → {formatDate(report.current_window_end)}</span>
              <span className="ml-2 text-muted-foreground/40">({report.current.order_count} orders)</span>
            </span>
            {!report.has_comparison && (
              <span className="text-amber-400/80 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Previous window has insufficient data — comparison will appear after 180 days of history
              </span>
            )}
          </div>

          {/* Metric cards */}
          {report.deltas.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {report.deltas.map(delta => (
                <MetricCard
                  key={delta.key}
                  delta={delta}
                  hasComparison={report.has_comparison}
                  onClick={delta.key === "risk_overrides" ? fetchOverrides : undefined}
                />
              ))}
            </div>
          )}

          {/* Strengths + Concerns */}
          {(report.strengths.length > 0 || report.concerns.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {report.strengths.length > 0 && (
                <Card>
                  <CardContent className="p-5 space-y-3">
                    <h2 className="text-sm font-semibold flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      Current Strengths
                    </h2>
                    <ul className="space-y-2">
                      {report.strengths.map((s, i) => (
                        <li key={i} className="text-[13px] text-muted-foreground leading-relaxed flex gap-2">
                          <span className="text-emerald-500/60 mt-0.5 shrink-0">▸</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
              {report.concerns.length > 0 && (
                <Card>
                  <CardContent className="p-5 space-y-3">
                    <h2 className="text-sm font-semibold flex items-center gap-2 text-amber-400">
                      <AlertTriangle className="w-4 h-4" />
                      Watch Points
                    </h2>
                    <ul className="space-y-2">
                      {report.concerns.map((c, i) => (
                        <li key={i} className="text-[13px] text-muted-foreground leading-relaxed flex gap-2">
                          <span className="text-amber-500/60 mt-0.5 shrink-0">▸</span>
                          {c}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Detected Patterns */}
          {report.patterns.length > 0 && (
            <div className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Detected Patterns
                </h2>
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                  Named behavioral anti-patterns auto-detected from your current 90-day order history.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {report.patterns.map(p => <PatternCard key={p.key} pattern={p} />)}
              </div>
            </div>
          )}

          {/* Methodology note */}
          <div className="text-[11px] text-muted-foreground/40 text-center">
            Rolling windows refresh continuously — each day the current window advances by one day.
            DQS computed using the same formula as Decision Intelligence.
            Behavioral alpha reflects documented vs undocumented return delta within the window.
          </div>
        </>
      )}
    </div>
  );
}

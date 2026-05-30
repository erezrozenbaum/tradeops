"use client";

import { useEffect, useState, useCallback } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent } from "@/components/ui/card";
import {
  TrendingUp, TrendingDown, Minus, RefreshCw, LineChart,
  CheckCircle2, AlertTriangle, Clock,
} from "lucide-react";

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
  generated_at: string;
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

// ── Metric Card ────────────────────────────────────────────────────────────────

function MetricCard({ delta, hasComparison }: { delta: MetricDelta; hasComparison: boolean }) {
  const { text, bg } = directionColors(delta.direction);
  const isOverride = delta.key === "risk_overrides";

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${bg}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{delta.title}</span>
        <DirectionIcon direction={delta.direction} />
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

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function InvestorEvolutionPage() {
  const investorId = useInvestorId();
  const [report, setReport] = useState<InvestorEvolutionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
                <MetricCard key={delta.key} delta={delta} hasComparison={report.has_comparison} />
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

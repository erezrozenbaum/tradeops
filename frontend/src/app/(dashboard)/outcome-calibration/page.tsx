"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent } from "@/components/ui/card";
import { Target, RefreshCw, TrendingUp, Clock, CheckCircle2 } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface CalibrationMilestone {
  days: number;
  order_count: number;
  avg_projected_low_risk: number | null;
  avg_actual_low_risk: number | null;
  avg_projected_growth: number | null;
  avg_actual_growth: number | null;
  avg_projected_high_risk: number | null;
  avg_actual_high_risk: number | null;
  avg_accuracy_score: number | null;
}

interface CalibrationOrderRow {
  order_id: string;
  ticker: string | null;
  name: string;
  action: string;
  executed_at: string | null;
  milestone_days: number;
  proj_low_risk: number | null;
  act_low_risk: number | null;
  proj_growth: number | null;
  act_growth: number | null;
  proj_high_risk: number | null;
  act_high_risk: number | null;
  accuracy_score: number | null;
}

interface CalibrationOut {
  investor_id: string;
  milestones: CalibrationMilestone[];
  orders: CalibrationOrderRow[];
  has_data: boolean;
  generated_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return `${v.toFixed(1)}%`;
}

function accuracyColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 85) return "text-green-500";
  if (score >= 70) return "text-amber-500";
  return "text-red-500";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

function milestoneLabel(days: number): string {
  if (days === 30) return "30-Day";
  if (days === 90) return "90-Day";
  return "180-Day";
}

function TierBar({ label, projected, actual }: { label: string; projected: number | null; actual: number | null }) {
  if (projected === null && actual === null) return null;
  const diff = projected !== null && actual !== null ? actual - projected : null;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground capitalize">{label}</span>
        <span className="font-mono text-[11px]">
          <span className="text-muted-foreground">proj {fmt(projected)}</span>
          {" → "}
          <span className="font-medium">{fmt(actual)}</span>
          {diff !== null && (
            <span className={`ml-1.5 ${diff >= 0 ? "text-green-500" : "text-red-500"}`}>
              ({diff >= 0 ? "+" : ""}{diff.toFixed(1)}%)
            </span>
          )}
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
        {projected !== null && (
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary/30"
            style={{ width: `${Math.min(projected, 100)}%` }}
          />
        )}
        {actual !== null && (
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary"
            style={{ width: `${Math.min(actual, 100)}%` }}
          />
        )}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function OutcomeCalibrationPage() {
  const investorId = useInvestorId();
  const [data, setData] = useState<CalibrationOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [milestoneFilter, setMilestoneFilter] = useState<number | null>(null);

  async function load() {
    if (!investorId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/v1/investors/${investorId}/staged-orders/calibration`);
      if (r.ok) setData(await r.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [investorId]);

  if (!investorId || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const visibleOrders = milestoneFilter
    ? (data?.orders ?? []).filter(o => o.milestone_days === milestoneFilter)
    : (data?.orders ?? []);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Outcome Calibration
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            How accurate were your projected tier allocations at 30, 90, and 180 days?
          </p>
        </div>
        <button
          onClick={load}
          className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {!data?.has_data ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Clock className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-medium">No milestone data yet</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              Calibration data appears after executed orders reach their 30, 90, or 180-day milestones.
              The daily outcome worker captures your portfolio state at each checkpoint.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Milestone summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(data?.milestones ?? []).map((m) => (
              <button
                key={m.days}
                onClick={() => setMilestoneFilter(milestoneFilter === m.days ? null : m.days)}
                className={`text-left rounded-lg border transition-colors ${
                  milestoneFilter === m.days
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40 bg-card"
                }`}
              >
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{milestoneLabel(m.days)}</span>
                    {m.order_count > 0 ? (
                      <span className="text-xs text-muted-foreground">{m.order_count} order{m.order_count > 1 ? "s" : ""}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No data</span>
                    )}
                  </div>
                  {m.avg_accuracy_score !== null ? (
                    <div>
                      <p className={`text-2xl font-bold tabular-nums ${accuracyColor(m.avg_accuracy_score)}`}>
                        {m.avg_accuracy_score.toFixed(1)}
                        <span className="text-sm font-normal text-muted-foreground ml-1">/100</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">avg accuracy</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-2xl font-bold text-muted-foreground/40">—</p>
                      <p className="text-xs text-muted-foreground mt-0.5">no snapshots yet</p>
                    </div>
                  )}
                  {m.order_count > 0 && (
                    <div className="space-y-2 pt-1">
                      <TierBar label="low risk" projected={m.avg_projected_low_risk} actual={m.avg_actual_low_risk} />
                      <TierBar label="growth" projected={m.avg_projected_growth} actual={m.avg_actual_growth} />
                      <TierBar label="high risk" projected={m.avg_projected_high_risk} actual={m.avg_actual_high_risk} />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Accuracy legend */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />85+ excellent</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />70–84 good</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />&lt;70 needs review</span>
            <span className="ml-auto">Bars: <span className="text-primary/50">projected</span> vs <span className="text-primary">actual</span></span>
          </div>

          {/* Per-order detail table */}
          <Card>
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Order Detail</p>
              {milestoneFilter && (
                <span className="text-xs text-muted-foreground">
                  — {milestoneLabel(milestoneFilter)} only
                </span>
              )}
              <span className="ml-auto text-xs text-muted-foreground">{visibleOrders.length} record{visibleOrders.length !== 1 ? "s" : ""}</span>
            </div>
            {visibleOrders.length === 0 ? (
              <CardContent className="py-10 text-center">
                <CheckCircle2 className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No records for this milestone yet.</p>
              </CardContent>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="px-4 py-3 text-left font-medium">Order</th>
                      <th className="px-4 py-3 text-left font-medium">Executed</th>
                      <th className="px-4 py-3 text-center font-medium">Milestone</th>
                      <th className="px-4 py-3 text-center font-medium">Low Risk P→A</th>
                      <th className="px-4 py-3 text-center font-medium">Growth P→A</th>
                      <th className="px-4 py-3 text-center font-medium">High Risk P→A</th>
                      <th className="px-4 py-3 text-center font-medium">Accuracy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {visibleOrders.map((row, i) => (
                      <tr key={i} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono font-semibold text-xs">
                            {row.ticker ?? "—"}
                          </span>
                          <span className="ml-2 text-xs text-muted-foreground truncate max-w-[120px] inline-block align-middle">
                            {row.name}
                          </span>
                          <span className={`ml-1.5 text-[10px] font-semibold uppercase ${row.action === "buy" ? "text-green-500" : "text-red-500"}`}>
                            {row.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {fmtDate(row.executed_at)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs font-medium">{row.milestone_days}d</span>
                        </td>
                        <td className="px-4 py-3 text-center text-xs">
                          <span className="text-muted-foreground">{fmt(row.proj_low_risk)}</span>
                          <span className="mx-1 text-muted-foreground/40">→</span>
                          <span className="font-medium">{fmt(row.act_low_risk)}</span>
                        </td>
                        <td className="px-4 py-3 text-center text-xs">
                          <span className="text-muted-foreground">{fmt(row.proj_growth)}</span>
                          <span className="mx-1 text-muted-foreground/40">→</span>
                          <span className="font-medium">{fmt(row.act_growth)}</span>
                        </td>
                        <td className="px-4 py-3 text-center text-xs">
                          <span className="text-muted-foreground">{fmt(row.proj_high_risk)}</span>
                          <span className="mx-1 text-muted-foreground/40">→</span>
                          <span className="font-medium">{fmt(row.act_high_risk)}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-sm font-bold tabular-nums ${accuracyColor(row.accuracy_score)}`}>
                            {row.accuracy_score !== null ? row.accuracy_score.toFixed(1) : "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

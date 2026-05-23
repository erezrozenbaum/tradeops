"use client";

import { useEffect, useState } from "react";
import { PieChart, TrendingUp, TrendingDown, ShieldCheck, Info } from "lucide-react";
import { GlowCard } from "@/components/ui/glow-card";
import { StatCard } from "@/components/ui/stat-card";

interface AttributionFactor {
  factor: string;
  label: string;
  value_change: number;
  pct_of_total_change: number | null;
  description: string;
}

interface ConfidenceLayer {
  dimension: string;
  label: string;
  score: number;
  note: string;
}

interface PerformanceAttribution {
  investor_id: string;
  period: string;
  period_start: string;
  period_end: string;
  start_value: number;
  end_value: number;
  total_change: number;
  total_return_pct: number | null;
  currency: string;
  factors: AttributionFactor[];
  confidence: ConfidenceLayer[];
  overall_confidence_score: number;
  computed_at: string;
  note: string | null;
}

const PERIOD_OPTIONS = [
  { key: "ytd", label: "YTD" },
  { key: "1y", label: "1 Year" },
  { key: "6m", label: "6 Months" },
  { key: "3m", label: "3 Months" },
];

const FACTOR_COLORS: Record<string, string> = {
  savings_contribution: "#22d3ee",
  market_return: "#22c55e",
  fees_drag: "#ef4444",
};

function ConfidenceDot({ score }: { score: number }) {
  const color = score >= 0.7 ? "bg-cyber-green" : score >= 0.4 ? "bg-amber-400" : "bg-cyber-red";
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}

export default function AttributionPage() {
  const [data, setData] = useState<PerformanceAttribution | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState("ytd");

  useEffect(() => {
    const id = localStorage.getItem("tradeops_investor_id");
    if (!id) { setError("No investor selected"); setLoading(false); return; }

    setLoading(true);
    fetch(`/api/v1/investors/${id}/attribution?period=${period}`)
      .then(r => {
        if (r.status === 404) return null;
        return r.ok ? r.json() : r.json().then((e: { detail?: string }) => Promise.reject(e.detail || "Failed"));
      })
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [period]);

  const totalPositive = data
    ? data.total_change >= 0
    : true;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <PieChart className="h-5 w-5 text-cyber-cyan" />
            Performance Attribution
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Break down what actually drove your portfolio value change.
          </p>
        </div>
        <div className="flex items-center gap-1">
          {PERIOD_OPTIONS.map(o => (
            <button
              key={o.key}
              onClick={() => setPeriod(o.key)}
              className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                period === o.key
                  ? "bg-cyber-cyan/10 text-cyber-cyan border-cyber-cyan/30 font-medium"
                  : "text-muted-foreground border-cyber-rule/40 hover:border-cyber-cyan/20"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm animate-pulse">
          Computing attribution…
        </div>
      ) : error ? (
        <div className="p-4 text-cyber-red text-sm">{error}</div>
      ) : !data ? (
        <GlowCard className="p-10 text-center text-muted-foreground text-sm">
          Not enough portfolio snapshots to compute attribution for this period.
          Generate a portfolio analysis first, then revisit after some time has passed.
        </GlowCard>
      ) : (
        <>
          {data.note && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-400/10 border border-amber-400/20 text-xs text-amber-400">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {data.note}
            </div>
          )}

          {/* Top stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Start Value"
              value={`${data.start_value.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${data.currency}`}
              sub={new Date(data.period_start).toLocaleDateString()}
            />
            <StatCard
              label="End Value"
              value={`${data.end_value.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${data.currency}`}
              sub={new Date(data.period_end).toLocaleDateString()}
            />
            <StatCard
              label="Total Change"
              value={`${data.total_change >= 0 ? "+" : ""}${data.total_change.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${data.currency}`}
              sub={data.total_return_pct !== null ? `${data.total_return_pct >= 0 ? "+" : ""}${data.total_return_pct}% return` : ""}
            />
            <StatCard
              label="Data Confidence"
              value={`${(data.overall_confidence_score * 100).toFixed(0)}%`}
              sub="attribution reliability"
            />
          </div>

          {/* Attribution factors */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              {totalPositive ? <TrendingUp className="h-4 w-4 text-cyber-green" /> : <TrendingDown className="h-4 w-4 text-cyber-red" />}
              What Drove the Change
            </h2>
            {data.factors.map(f => {
              const barColor = FACTOR_COLORS[f.factor] || "#6b7280";
              const isNegative = f.value_change < 0;
              const totalAbs = data.factors.reduce((s, x) => s + Math.abs(x.value_change), 0);
              const barWidth = totalAbs > 0 ? (Math.abs(f.value_change) / totalAbs) * 100 : 0;

              return (
                <GlowCard key={f.factor} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{f.label}</span>
                    <div className="flex items-center gap-3">
                      {f.pct_of_total_change !== null && (
                        <span className="text-xs text-muted-foreground">
                          {f.pct_of_total_change >= 0 ? "+" : ""}{f.pct_of_total_change}% of change
                        </span>
                      )}
                      <span
                        className="text-sm font-bold"
                        style={{ color: isNegative ? "#ef4444" : barColor }}
                      >
                        {isNegative ? "" : "+"}{f.value_change.toLocaleString(undefined, { maximumFractionDigits: 0 })} {data.currency}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${barWidth}%`, backgroundColor: barColor }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{f.description}</p>
                </GlowCard>
              );
            })}
          </div>

          {/* Confidence layers */}
          <GlowCard className="p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-cyber-cyan" />
              Data Confidence Breakdown
            </h2>
            <div className="space-y-3">
              {data.confidence.map(c => (
                <div key={c.dimension} className="flex items-start gap-3">
                  <ConfidenceDot score={c.score} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">{c.label}</span>
                      <span className="text-xs text-muted-foreground">{(c.score * 100).toFixed(0)}%</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{c.note}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground border-t border-cyber-rule/30 pt-3">
              Overall confidence: <span className="font-semibold text-foreground">{(data.overall_confidence_score * 100).toFixed(0)}%</span>.
              {data.overall_confidence_score < 0.5
                ? " Attribution is indicative. Refresh portfolio snapshots and price data for improved accuracy."
                : " Attribution reliability is acceptable for decision-making."}
            </p>
          </GlowCard>
        </>
      )}
    </div>
  );
}

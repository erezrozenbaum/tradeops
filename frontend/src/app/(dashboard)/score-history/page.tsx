"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Activity, Trophy } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

interface TwinPoint {
  computed_at: string;
  overall_score: number;
  financial_stability: number;
  behavioral_discipline: number;
  emotional_risk: number;
  portfolio_consistency: number;
  financial_resilience: number;
  risk_alignment: number;
  long_term_discipline: number;
  contribution_momentum: number;
}

interface MaturityPoint {
  computed_at: string;
  composite_score: number;
  stage: string;
}

interface ScoreHistoryResponse {
  twin_history: TwinPoint[];
  maturity_history: MaturityPoint[];
}

const STAGE_COLOR: Record<string, string> = {
  foundation: "#f59e0b",
  discipline: "#3b82f6",
  optimization: "#22c55e",
  advanced_cognition: "#a855f7",
};

const DIM_LINES = [
  { key: "financial_stability", label: "Stability", color: "#22c55e" },
  { key: "behavioral_discipline", label: "Discipline", color: "#3b82f6" },
  { key: "emotional_risk", label: "Emotional Risk", color: "#ef4444" },
  { key: "portfolio_consistency", label: "Consistency", color: "#a855f7" },
  { key: "financial_resilience", label: "Resilience", color: "#06b6d4" },
  { key: "risk_alignment", label: "Risk Alignment", color: "#f59e0b" },
  { key: "long_term_discipline", label: "LT Discipline", color: "#f97316" },
  { key: "contribution_momentum", label: "Contributions", color: "#ec4899" },
];

function fmt(dt: string) {
  const d = new Date(dt);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-cyber-surface border border-cyber-border rounded-xl p-4">
      <h2 className="text-sm font-semibold text-cyber-muted uppercase tracking-wider mb-4">{title}</h2>
      {children}
    </div>
  );
}

const chartTooltipStyle = {
  backgroundColor: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: 8,
  fontSize: 11,
  color: "#94a3b8",
};

export default function ScoreHistoryPage() {
  const investorId = useInvestorId();
  const [data, setData] = useState<ScoreHistoryResponse | null>(null);
  const [months, setMonths] = useState(6);
  const [showDimensions, setShowDimensions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!investorId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/v1/investors/${investorId}/command-center/score-history?months=${months}`, {
      credentials: "include",
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [investorId, months]);

  const twinData = data?.twin_history.map(p => ({
    ...p,
    date: fmt(p.computed_at),
  })) ?? [];

  const maturityData = data?.maturity_history.map(p => ({
    ...p,
    date: fmt(p.computed_at),
    color: STAGE_COLOR[p.stage] ?? "#64748b",
  })) ?? [];

  const isEmpty = !loading && !error && twinData.length === 0 && maturityData.length === 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-cyber-text flex items-center gap-2">
            <Activity size={22} className="text-cyber-blue" />
            Score History
          </h1>
          <p className="text-cyber-muted text-sm mt-1">
            How your Twin Score, Maturity, and financial dimensions evolved over time
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-cyber-muted">Window:</span>
          {([1, 3, 6, 12] as const).map(m => (
            <button
              key={m}
              onClick={() => setMonths(m)}
              className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                months === m
                  ? "bg-cyber-blue/10 border-cyber-blue text-cyber-blue"
                  : "border-cyber-border text-cyber-muted hover:text-cyber-text"
              }`}
            >
              {m}mo
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex flex-col gap-4 animate-pulse">
          <div className="h-56 rounded-xl bg-cyber-surface/60" />
          <div className="h-56 rounded-xl bg-cyber-surface/60" />
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400">{error}</div>
      )}

      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Activity size={36} className="text-cyber-muted mb-4" />
          <p className="font-semibold text-cyber-text">No score history yet</p>
          <p className="text-sm text-cyber-muted mt-1 max-w-xs">
            Score snapshots are computed daily. Check back after your first full day with the platform.
          </p>
        </div>
      )}

      {!loading && !error && (twinData.length > 0 || maturityData.length > 0) && (
        <>
          {/* Twin Score overall */}
          {twinData.length > 0 && (
            <ChartCard title="Financial Twin Score (Overall)">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={twinData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => [v.toFixed(1), "Twin Score"]} />
                  <Line
                    type="monotone"
                    dataKey="overall_score"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    name="Twin Score"
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Maturity score */}
          {maturityData.length > 0 && (
            <ChartCard title="Investor Maturity Composite Score">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={maturityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(v: number, _name: string, props: { payload?: MaturityPoint & { date: string; color: string } }) => [
                      `${v.toFixed(1)} (${props.payload?.stage?.replace("_", " ") ?? ""})`,
                      "Maturity Score",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="composite_score"
                    stroke="#a855f7"
                    strokeWidth={2}
                    dot={false}
                    name="Maturity"
                  />
                </LineChart>
              </ResponsiveContainer>

              {/* Stage legend */}
              <div className="flex flex-wrap gap-3 mt-3">
                {Object.entries(STAGE_COLOR).map(([stage, color]) => (
                  <div key={stage} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-xs text-cyber-muted capitalize">{stage.replace("_", " ")}</span>
                  </div>
                ))}
              </div>
            </ChartCard>
          )}

          {/* 8 twin dimensions */}
          {twinData.length > 0 && (
            <div className="bg-cyber-surface border border-cyber-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-cyber-muted uppercase tracking-wider">Twin Dimensions</h2>
                <button
                  onClick={() => setShowDimensions(v => !v)}
                  className="text-xs text-cyber-blue hover:text-cyber-blue/80 transition-colors"
                >
                  {showDimensions ? "Hide" : "Show all 8 dimensions"}
                </button>
              </div>

              {!showDimensions ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {DIM_LINES.map(d => {
                    const latest = twinData[twinData.length - 1];
                    const val = latest?.[d.key as keyof TwinPoint] as number | undefined;
                    return (
                      <div key={d.key} className="flex flex-col items-center bg-cyber-bg rounded-lg p-2.5 border border-cyber-border">
                        <span className="text-[10px] text-cyber-muted mb-1">{d.label}</span>
                        <span className="text-lg font-bold" style={{ color: d.color }}>
                          {val != null ? val.toFixed(1) : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={twinData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number, name: string) => [v.toFixed(1), name]} />
                    <Legend wrapperStyle={{ fontSize: 10, color: "#64748b" }} />
                    {DIM_LINES.map(d => (
                      <Line
                        key={d.key}
                        type="monotone"
                        dataKey={d.key}
                        stroke={d.color}
                        strokeWidth={1.5}
                        dot={false}
                        name={d.label}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          {/* Summary stats */}
          {twinData.length > 1 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(() => {
                const scores = twinData.map(p => p.overall_score);
                const latest = scores[scores.length - 1];
                const earliest = scores[0];
                const delta = latest - earliest;
                const high = Math.max(...scores);
                const low = Math.min(...scores);
                return [
                  { label: "Current", value: latest.toFixed(1), color: "text-cyber-blue" },
                  { label: "Change", value: `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}`, color: delta >= 0 ? "text-emerald-400" : "text-red-400" },
                  { label: "Period High", value: high.toFixed(1), color: "text-emerald-400" },
                  { label: "Period Low", value: low.toFixed(1), color: "text-amber-400" },
                ].map(s => (
                  <div key={s.label} className="bg-cyber-surface border border-cyber-border rounded-xl p-4 text-center">
                    <p className="text-xs text-cyber-muted uppercase tracking-wider mb-1">{s.label}</p>
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  </div>
                ));
              })()}
            </div>
          )}
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Target, TrendingUp, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { GlowCard } from "@/components/ui/glow-card";
import { StatCard } from "@/components/ui/stat-card";

interface DriftItem {
  category: string;
  tier_key: string;
  target_pct: number;
  actual_pct: number;
  drift_pct: number;
  status: "on_track" | "minor_drift" | "major_drift";
}

interface StrategyDriftReport {
  investor_id: string;
  computed_at: string;
  alignment_score: number | null;
  risk_profile: string | null;
  stability_score: number | null;
  locked_pct: number;
  tradeable_pct: number;
  drift_items: DriftItem[];
  top_concern: string | null;
  summary: string;
  last_snapshot_at: string | null;
  risk_model_generated_at: string | null;
}

const STATUS_CONFIG = {
  on_track: { label: "On Track", color: "text-cyber-green", bg: "bg-cyber-green/10 border-cyber-green/20", icon: CheckCircle },
  minor_drift: { label: "Minor Drift", color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20", icon: Info },
  major_drift: { label: "Major Drift", color: "text-cyber-red", bg: "bg-cyber-red/10 border-cyber-red/20", icon: AlertTriangle },
};

function AlignmentGauge({ score }: { score: number }) {
  const color = score >= 80 ? "#22d3ee" : score >= 60 ? "#f59e0b" : "#ef4444";
  const circumference = 2 * Math.PI * 44;
  const dashOffset = circumference * (1 - score / 100);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" fill="none" stroke="hsl(217 30% 12%)" strokeWidth="8" />
          <circle
            cx="50" cy="50" r="44" fill="none"
            stroke={color} strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold" style={{ color }}>{score}</span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-widest">/ 100</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground">Alignment Score</span>
    </div>
  );
}

function DriftBar({ item }: { item: DriftItem }) {
  const cfg = STATUS_CONFIG[item.status];
  const Icon = cfg.icon;
  const maxPct = 100;
  const targetLeft = Math.min(99, item.target_pct);
  const actualLeft = Math.min(99, item.actual_pct);

  return (
    <div className={`p-4 rounded-lg border ${cfg.bg}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
          <span className="text-sm font-medium text-foreground">{item.category}</span>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
          {cfg.label}
        </span>
      </div>

      {/* Visual bar */}
      <div className="relative h-2 bg-muted/40 rounded-full mb-3">
        {/* Actual fill */}
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-700"
          style={{ width: `${item.actual_pct}%`, background: item.status === "on_track" ? "#22d3ee" : item.status === "minor_drift" ? "#f59e0b" : "#ef4444" }}
        />
        {/* Target marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-white/50 rounded-full"
          style={{ left: `${item.target_pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Actual: <span className={`font-semibold ${cfg.color}`}>{item.actual_pct}%</span></span>
        <span>Target: <span className="font-semibold text-foreground">{item.target_pct}%</span></span>
        <span>
          Drift:{" "}
          <span className={`font-semibold ${item.drift_pct > 0 ? "text-amber-400" : item.drift_pct < 0 ? "text-sky-400" : "text-muted-foreground"}`}>
            {item.drift_pct > 0 ? "+" : ""}{item.drift_pct}%
          </span>
        </span>
      </div>
    </div>
  );
}

export default function StrategyDriftPage() {
  const [report, setReport] = useState<StrategyDriftReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = localStorage.getItem("tradeops_investor_id");
    if (!id) { setError("No investor selected"); setLoading(false); return; }

    fetch(`/api/v1/investors/${id}/strategy-drift`)
      .then(r => r.ok ? r.json() : r.json().then((e: { detail?: string }) => Promise.reject(e.detail || "Failed")))
      .then(setReport)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm animate-pulse">
        Analyzing strategy drift…
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="p-6 text-cyber-red text-sm">
        {error || "Failed to load drift report."}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Target className="h-5 w-5 text-cyber-cyan" />
          Strategy Drift
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Compare your current portfolio allocation against your risk model targets.
        </p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Risk Profile"
          value={report.risk_profile ? report.risk_profile.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase()) : "—"}
          sub="stability classification"
        />
        <StatCard
          label="Stability Score"
          value={report.stability_score !== null ? String(report.stability_score) : "—"}
          sub="/ 100"
        />
        <StatCard
          label="Tradeable"
          value={`${report.tradeable_pct}%`}
          sub="of portfolio (excl. locked)"
        />
        <StatCard
          label="Locked Assets"
          value={`${report.locked_pct}%`}
          sub="pension / study funds"
        />
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Gauge */}
        <GlowCard className="flex flex-col items-center justify-center p-6 gap-4">
          {report.alignment_score !== null ? (
            <AlignmentGauge score={report.alignment_score} />
          ) : (
            <div className="text-muted-foreground text-sm text-center">No data available</div>
          )}
          {report.top_concern && (
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Top Concern</p>
              <p className="text-xs text-amber-400 font-medium">{report.top_concern}</p>
            </div>
          )}
        </GlowCard>

        {/* Summary */}
        <GlowCard className="md:col-span-2 p-5 flex flex-col justify-between gap-4">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Analysis Summary</p>
            <p className="text-sm text-foreground leading-relaxed">{report.summary}</p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-muted-foreground border-t border-cyber-rule/40 pt-3">
            {report.last_snapshot_at && (
              <span>Portfolio snapshot: {new Date(report.last_snapshot_at).toLocaleDateString()}</span>
            )}
            {report.risk_model_generated_at && (
              <span>Risk model: {new Date(report.risk_model_generated_at).toLocaleDateString()}</span>
            )}
            <span>Computed: {new Date(report.computed_at).toLocaleString()}</span>
          </div>
        </GlowCard>
      </div>

      {/* Drift items */}
      {report.drift_items.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-cyber-cyan" />
            Tier Drift Analysis
          </h2>
          {report.drift_items.map(item => (
            <DriftBar key={item.tier_key} item={item} />
          ))}
        </div>
      ) : (
        <GlowCard className="p-8 text-center text-muted-foreground text-sm">
          No drift data available. Generate a portfolio analysis and risk model first.
        </GlowCard>
      )}
    </div>
  );
}

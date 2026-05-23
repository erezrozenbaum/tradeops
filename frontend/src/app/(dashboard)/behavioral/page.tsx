"use client";

import { useEffect, useState } from "react";
import { Brain, TrendingUp, Clock, AlertTriangle, CheckCircle, Info, BarChart2 } from "lucide-react";
import { GlowCard } from "@/components/ui/glow-card";
import { StatCard } from "@/components/ui/stat-card";

interface HoldingPeriodStats {
  avg_days: number | null;
  median_days: number | null;
  short_term_count: number;
  medium_term_count: number;
  long_term_count: number;
  matched_pairs: number;
}

interface BehavioralPattern {
  key: string;
  label: string;
  description: string;
  severity: "info" | "warning" | "positive";
}

interface BehavioralMetrics {
  investor_id: string;
  computed_at: string;
  holding_period_stats: HoldingPeriodStats;
  monthly_trade_counts: Record<string, number>;
  recommendation_action_rate: number | null;
  recommendation_sample_size: number;
  patterns_detected: BehavioralPattern[];
  behavioral_score: number;
  summary: string;
  data_period_days: number;
}

const SEVERITY_CONFIG = {
  positive: { icon: CheckCircle, color: "text-cyber-green", bg: "bg-cyber-green/10 border-cyber-green/20" },
  info: { icon: Info, color: "text-sky-400", bg: "bg-sky-400/10 border-sky-400/20" },
  warning: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20" },
};

function ScoreRing({ score }: { score: number }) {
  const color = score >= 70 ? "#22d3ee" : score >= 45 ? "#f59e0b" : "#ef4444";
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
      <span className="text-xs text-muted-foreground">Behavioral Score</span>
    </div>
  );
}

function MonthlyChart({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts).slice(-12);
  if (entries.length === 0) return null;

  const max = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Monthly Trade Activity</p>
      <div className="flex items-end gap-1 h-16">
        {entries.map(([month, count]) => (
          <div key={month} className="flex-1 flex flex-col items-center gap-1 group">
            <div
              className="w-full bg-cyber-cyan/30 rounded-sm transition-all group-hover:bg-cyber-cyan/50"
              style={{ height: `${(count / max) * 100}%`, minHeight: 2 }}
            />
            <span className="text-[8px] text-muted-foreground/60 hidden group-hover:block absolute -mt-5 bg-background px-1 rounded">
              {count}
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground/50">
        <span>{entries[0]?.[0]}</span>
        <span>{entries[entries.length - 1]?.[0]}</span>
      </div>
    </div>
  );
}

export default function BehavioralPage() {
  const [data, setData] = useState<BehavioralMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = localStorage.getItem("tradeops_investor_id");
    if (!id) { setError("No investor selected"); setLoading(false); return; }

    fetch(`/api/v1/investors/${id}/behavioral-patterns`)
      .then(r => r.ok ? r.json() : r.json().then((e: { detail?: string }) => Promise.reject(e.detail || "Failed")))
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm animate-pulse">
        Analyzing behavioral patterns…
      </div>
    );
  }
  if (error || !data) {
    return <div className="p-6 text-cyber-red text-sm">{error || "Failed to load."}</div>;
  }

  const hp = data.holding_period_stats;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Brain className="h-5 w-5 text-cyber-cyan" />
          Portfolio Behavioral Intelligence
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Analysis of your trading behavior over the last {data.data_period_days} days.
        </p>
      </div>

      {/* Top row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Avg Holding Period"
          value={hp.avg_days !== null ? `${hp.avg_days}d` : "—"}
          sub="buy to sell"
        />
        <StatCard
          label="Median Holding"
          value={hp.median_days !== null ? `${hp.median_days}d` : "—"}
          sub="completed trades"
        />
        <StatCard
          label="Rec. Follow Rate"
          value={data.recommendation_action_rate !== null
            ? `${(data.recommendation_action_rate * 100).toFixed(0)}%`
            : "—"}
          sub={`of ${data.recommendation_sample_size} AI recs`}
        />
        <StatCard
          label="Matched Pairs"
          value={String(hp.matched_pairs)}
          sub="buy-sell pairs analyzed"
        />
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Score gauge */}
        <GlowCard className="flex flex-col items-center justify-center p-6 gap-4">
          <ScoreRing score={data.behavioral_score} />
          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            Higher = more disciplined, patient, systematic trading behavior.
          </p>
        </GlowCard>

        {/* Summary + chart */}
        <GlowCard className="md:col-span-2 p-5 space-y-4">
          <p className="text-sm text-foreground leading-relaxed">{data.summary}</p>
          <MonthlyChart counts={data.monthly_trade_counts} />
        </GlowCard>
      </div>

      {/* Holding period distribution */}
      <GlowCard className="p-5 space-y-4">
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
          <Clock className="h-3 w-3" /> Holding Period Distribution
        </p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Short-term", sub: "< 30 days", count: hp.short_term_count, color: "text-cyber-red" },
            { label: "Medium-term", sub: "30–180 days", count: hp.medium_term_count, color: "text-amber-400" },
            { label: "Long-term", sub: "> 180 days", count: hp.long_term_count, color: "text-cyber-green" },
          ].map(({ label, sub, count, color }) => {
            const total = hp.short_term_count + hp.medium_term_count + hp.long_term_count;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={label} className="text-center">
                <p className={`text-2xl font-bold ${color}`}>{count}</p>
                <p className="text-xs font-medium text-foreground">{label}</p>
                <p className="text-[10px] text-muted-foreground">{sub}</p>
                <div className="mt-2 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${color.replace("text-", "bg-").replace("amber-400", "amber-400/60")}`}
                    style={{ width: `${pct}%`, backgroundColor: color.includes("cyan") ? "#22d3ee" : color.includes("green") ? "#22c55e" : color.includes("red") ? "#ef4444" : "#f59e0b" }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{pct}%</p>
              </div>
            );
          })}
        </div>
      </GlowCard>

      {/* Patterns */}
      {data.patterns_detected.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-cyber-cyan" />
            Detected Behavioral Patterns
          </h2>
          {data.patterns_detected.map(p => {
            const cfg = SEVERITY_CONFIG[p.severity];
            const Icon = cfg.icon;
            return (
              <div key={p.key} className={`p-4 rounded-lg border flex gap-3 ${cfg.bg}`}>
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.color}`} />
                <div>
                  <p className={`text-sm font-semibold ${cfg.color}`}>{p.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{p.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

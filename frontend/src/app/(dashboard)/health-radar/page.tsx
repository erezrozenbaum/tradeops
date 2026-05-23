"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertCircle, RefreshCw, Activity, TrendingUp, TrendingDown, Minus,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HealthDimensions {
  stability: number;
  liquidity: number;
  discipline: number;
  diversification: number;
  emotional_control: number;
  contribution_consistency: number;
  tax_efficiency: number;
  risk_alignment: number;
  financial_resilience: number;
}

interface HealthSnapshot {
  id: string;
  computed_at: string;
  dimensions: HealthDimensions;
  overall_score: number;
  previous_overall: number | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DIM_KEYS = [
  "stability",
  "liquidity",
  "discipline",
  "diversification",
  "emotional_control",
  "contribution_consistency",
  "tax_efficiency",
  "risk_alignment",
  "financial_resilience",
] as const;

type DimKey = typeof DIM_KEYS[number];

const DIM_LABELS: Record<DimKey, string> = {
  stability: "Stability",
  liquidity: "Liquidity",
  discipline: "Discipline",
  diversification: "Diversification",
  emotional_control: "Emotional Control",
  contribution_consistency: "Contribution Consistency",
  tax_efficiency: "Tax Efficiency",
  risk_alignment: "Risk Alignment",
  financial_resilience: "Financial Resilience",
};

const DIM_DESCRIPTIONS: Record<DimKey, string> = {
  stability: "Income surplus, expense coverage, and financial score",
  liquidity: "Emergency fund months — ability to cover unexpected expenses",
  discipline: "Trading behaviour quality based on transaction history",
  diversification: "Unique assets held across your portfolio",
  emotional_control: "Absence of short-term reactive / panic trading",
  contribution_consistency: "Regularity of investment contributions",
  tax_efficiency: "Long-term vs short-term holding ratio (longer = more efficient)",
  risk_alignment: "Portfolio allocation tracking your target risk model",
  financial_resilience: "Emergency fund buffer combined with net worth strength",
};

const SCORE_COLOR = (s: number) =>
  s >= 75 ? "#22c55e" : s >= 50 ? "#3b82f6" : s >= 25 ? "#eab308" : "#ef4444";

// ─── Radar Chart (9-sided) ────────────────────────────────────────────────────

function HealthRadarChart({ dims, size = 280 }: { dims: HealthDimensions; size?: number }) {
  const N = DIM_KEYS.length;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36;
  const labelR = size * 0.47;

  function point(i: number, pct: number) {
    const angle = (i * 2 * Math.PI) / N - Math.PI / 2;
    return {
      x: cx + pct * r * Math.cos(angle),
      y: cy + pct * r * Math.sin(angle),
    };
  }

  const gridLevels = [0.25, 0.5, 0.75, 1.0];
  const gridPaths = gridLevels.map((lvl) => {
    const pts = DIM_KEYS.map((_, i) => point(i, lvl));
    return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + " Z";
  });

  const dataPts = DIM_KEYS.map((k, i) => point(i, (dims[k] ?? 0) / 100));
  const dataPath =
    dataPts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + " Z";

  const axisLines = DIM_KEYS.map((_, i) => {
    const outer = point(i, 1.0);
    return { x1: cx, y1: cy, x2: outer.x, y2: outer.y };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {gridPaths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={0.5} className="text-muted/20" />
      ))}
      {axisLines.map((l, i) => (
        <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="currentColor" strokeWidth={0.5} className="text-muted/30" />
      ))}
      <path d={dataPath} fill="#22c55e" fillOpacity={0.12} stroke="#22c55e" strokeWidth={1.5} />
      {dataPts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill={SCORE_COLOR(dims[DIM_KEYS[i]])} />
      ))}
      {DIM_KEYS.map((k, i) => {
        const angle = (i * 2 * Math.PI) / N - Math.PI / 2;
        const lp = {
          x: cx + labelR * Math.cos(angle),
          y: cy + labelR * Math.sin(angle),
        };
        return (
          <text
            key={i}
            x={lp.x}
            y={lp.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={8}
            className="fill-muted-foreground"
          >
            {DIM_LABELS[k]}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Score bar row ────────────────────────────────────────────────────────────

function ScoreRow({ label, score, description }: { label: string; score: number; description: string }) {
  const color = score >= 75 ? "bg-green-500" : score >= 50 ? "bg-blue-500" : score >= 25 ? "bg-yellow-500" : "bg-red-500";
  const textColor = score >= 75 ? "text-green-400" : score >= 50 ? "text-blue-400" : score >= 25 ? "text-yellow-400" : "text-red-400";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <div>
          <span className="font-medium">{label}</span>
          <span className="text-muted-foreground ml-2">{description}</span>
        </div>
        <span className={`font-bold tabular-nums shrink-0 ml-2 ${textColor}`}>{Math.round(score)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/30">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function Trend({ current, previous }: { current: number; previous: number | null }) {
  if (previous === null) return null;
  const delta = current - previous;
  if (Math.abs(delta) < 0.5) return <Minus className="h-4 w-4 text-muted-foreground" />;
  if (delta > 0) return <TrendingUp className="h-4 w-4 text-green-400" />;
  return <TrendingDown className="h-4 w-4 text-red-400" />;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HealthRadarPage() {
  const investorId = useInvestorId();
  const [snap, setSnap] = useState<HealthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!investorId) return;
    try {
      const res = await fetch(`/api/v1/investors/${investorId}/health-radar`);
      if (!res.ok) throw new Error("Failed to load health radar");
      setSnap(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    if (!investorId) return;
    setRefreshing(true);
    setError(null);
    try {
      // Health radar is co-computed with twin — use twin refresh
      const res = await fetch(`/api/v1/investors/${investorId}/twin/refresh`, { method: "POST" });
      if (!res.ok) throw new Error("Refresh failed");
      // Reload health radar separately
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setRefreshing(false);
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-green-400" />
            Financial Health Radar
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            9-dimensional view of your overall financial health — updated daily.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Recalculating…" : "Refresh"}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-500 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {snap && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Radar */}
          <Card className="md:col-span-2 flex flex-col items-center justify-center">
            <CardContent className="pt-6 flex flex-col items-center gap-3">
              <HealthRadarChart dims={snap.dimensions} />
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{Math.round(snap.overall_score)}</span>
                <span className="text-muted-foreground text-sm">/ 100</span>
                <Trend current={snap.overall_score} previous={snap.previous_overall} />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Overall Health Score · {new Date(snap.computed_at).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>

          {/* Score breakdown */}
          <Card className="md:col-span-3">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Dimension Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {DIM_KEYS.map((k) => (
                <ScoreRow
                  key={k}
                  label={DIM_LABELS[k]}
                  score={snap.dimensions[k]}
                  description={DIM_DESCRIPTIONS[k]}
                />
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertCircle, RefreshCw, Cpu, TrendingUp, TrendingDown, Minus,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TwinDimensions {
  financial_stability: number;
  behavioral_discipline: number;
  emotional_risk: number;
  portfolio_consistency: number;
  financial_resilience: number;
  risk_alignment: number;
  long_term_discipline: number;
  contribution_momentum: number;
}

interface TwinSnapshot {
  id: string;
  computed_at: string;
  dimensions: TwinDimensions;
  overall_score: number;
  previous_overall: number | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DIM_KEYS = [
  "financial_stability",
  "behavioral_discipline",
  "emotional_risk",
  "portfolio_consistency",
  "financial_resilience",
  "risk_alignment",
  "long_term_discipline",
  "contribution_momentum",
] as const;

type DimKey = typeof DIM_KEYS[number];

const DIM_LABELS: Record<DimKey, string> = {
  financial_stability: "Financial Stability",
  behavioral_discipline: "Behavioral Discipline",
  emotional_risk: "Emotional Risk",
  portfolio_consistency: "Portfolio Consistency",
  financial_resilience: "Financial Resilience",
  risk_alignment: "Risk Alignment",
  long_term_discipline: "Long-Term Discipline",
  contribution_momentum: "Contribution Momentum",
};

const DIM_DESCRIPTIONS: Record<DimKey, string> = {
  financial_stability: "Income, emergency fund, and debt management quality",
  behavioral_discipline: "Overall trading behaviour from 12-month history",
  emotional_risk: "Short-term reactive trading tendency — lower is better",
  portfolio_consistency: "Actual vs target risk model allocation alignment",
  financial_resilience: "Emergency fund buffer + net worth shock absorption",
  risk_alignment: "Portfolio risk level vs stated risk profile",
  long_term_discipline: "Average holding duration — patience and conviction",
  contribution_momentum: "Frequency of recent investment contributions",
};

// ─── Radar Chart ─────────────────────────────────────────────────────────────

function RadarChart({ dims, size = 260 }: { dims: TwinDimensions; size?: number }) {
  const N = DIM_KEYS.length;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const labelR = size * 0.48;

  function point(i: number, pct: number) {
    const angle = (i * 2 * Math.PI) / N - Math.PI / 2;
    return {
      x: cx + pct * r * Math.cos(angle),
      y: cy + pct * r * Math.sin(angle),
    };
  }

  function labelPoint(i: number) {
    const angle = (i * 2 * Math.PI) / N - Math.PI / 2;
    return {
      x: cx + labelR * Math.cos(angle),
      y: cy + labelR * Math.sin(angle),
    };
  }

  // Grid rings
  const gridLevels = [0.25, 0.5, 0.75, 1.0];
  const gridPaths = gridLevels.map((lvl) => {
    const pts = DIM_KEYS.map((_, i) => point(i, lvl));
    return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + " Z";
  });

  // Data polygon
  const dataPts = DIM_KEYS.map((k, i) => point(i, (dims[k] ?? 0) / 100));
  const dataPath =
    dataPts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + " Z";

  // Axis lines
  const axisLines = DIM_KEYS.map((_, i) => {
    const outer = point(i, 1.0);
    return { x1: cx, y1: cy, x2: outer.x, y2: outer.y };
  });

  // Short labels (first word only for outer labels)
  const shortLabels = DIM_KEYS.map((k) => {
    const words = DIM_LABELS[k].split(" ");
    return words.length <= 2 ? DIM_LABELS[k] : words[0] + " " + words[1];
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Grid rings */}
      {gridPaths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={0.5} className="text-muted/20" />
      ))}
      {/* Axis lines */}
      {axisLines.map((l, i) => (
        <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="currentColor" strokeWidth={0.5} className="text-muted/30" />
      ))}
      {/* Data polygon */}
      <path d={dataPath} fill="hsl(var(--primary))" fillOpacity={0.15} stroke="hsl(var(--primary))" strokeWidth={1.5} />
      {/* Data points */}
      {dataPts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="hsl(var(--primary))" />
      ))}
      {/* Labels */}
      {DIM_KEYS.map((_, i) => {
        const lp = labelPoint(i);
        return (
          <text
            key={i}
            x={lp.x}
            y={lp.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={8.5}
            className="fill-muted-foreground"
          >
            {shortLabels[i]}
          </text>
        );
      })}
      {/* Centre score */}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize={18} fontWeight={700} className="fill-foreground">
        {/* no centre text — avoid clutter */}
      </text>
    </svg>
  );
}

// ─── Dimension Card ───────────────────────────────────────────────────────────

function DimCard({ dimKey, score }: { dimKey: DimKey; score: number }) {
  const color =
    score >= 75 ? "text-green-400" : score >= 50 ? "text-blue-400" : score >= 25 ? "text-yellow-400" : "text-red-400";
  const barColor =
    score >= 75 ? "bg-green-500" : score >= 50 ? "bg-blue-500" : score >= 25 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="p-3 rounded-lg border border-border bg-card space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium leading-tight">{DIM_LABELS[dimKey]}</p>
        <span className={`text-sm font-bold tabular-nums shrink-0 ${color}`}>{Math.round(score)}</span>
      </div>
      <div className="h-1 rounded-full bg-muted/30">
        <div className={`h-full rounded-full ${barColor} transition-all duration-700`} style={{ width: `${score}%` }} />
      </div>
      <p className="text-xs text-muted-foreground leading-snug">{DIM_DESCRIPTIONS[dimKey]}</p>
    </div>
  );
}

// ─── Trend indicator ─────────────────────────────────────────────────────────

function Trend({ current, previous }: { current: number; previous: number | null }) {
  if (previous === null) return null;
  const delta = current - previous;
  if (Math.abs(delta) < 0.5) return <Minus className="h-4 w-4 text-muted-foreground" />;
  if (delta > 0) return <TrendingUp className="h-4 w-4 text-green-400" />;
  return <TrendingDown className="h-4 w-4 text-red-400" />;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TwinPage() {
  const investorId = useInvestorId();
  const [snap, setSnap] = useState<TwinSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!investorId) return;
    try {
      const res = await fetch(`/api/v1/investors/${investorId}/twin`);
      if (!res.ok) throw new Error("Failed to load twin data");
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
      const res = await fetch(`/api/v1/investors/${investorId}/twin/refresh`, { method: "POST" });
      if (!res.ok) throw new Error("Refresh failed");
      setSnap(await res.json());
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
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Cpu className="h-6 w-6 text-violet-400" />
            Financial Twin
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            A mirror of your financial self across 8 behavioural dimensions — updated daily.
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
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Radar */}
            <Card className="md:col-span-1 flex flex-col items-center justify-center">
              <CardContent className="pt-6 flex flex-col items-center gap-3">
                <RadarChart dims={snap.dimensions} />
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{Math.round(snap.overall_score)}</span>
                  <span className="text-muted-foreground text-sm">/ 100</span>
                  <Trend current={snap.overall_score} previous={snap.previous_overall} />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Overall Twin Score · {new Date(snap.computed_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>

            {/* Dimension cards */}
            <Card className="md:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Dimension Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {DIM_KEYS.map((k) => (
                    <DimCard key={k} dimKey={k} score={snap.dimensions[k]} />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Trophy, TrendingUp, ChevronRight } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ComponentScores {
  financial_stability: number;
  debt_discipline: number;
  savings_consistency: number;
  emotional_discipline: number;
  strategy_consistency: number;
  contribution_regularity: number;
  data_maturity: number;
  portfolio_complexity: number;
}

interface MaturitySnapshot {
  id: string;
  computed_at: string;
  composite_score: number;
  stage: string;
  stage_label: string;
  component_scores: ComponentScores;
  features_unlocked: string[];
  notes: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGE_ORDER = ["foundation", "discipline", "optimization", "advanced_cognition"];

const STAGE_COLORS: Record<string, string> = {
  foundation: "text-slate-400",
  discipline: "text-blue-400",
  optimization: "text-violet-400",
  advanced_cognition: "text-amber-400",
};

const STAGE_BG: Record<string, string> = {
  foundation: "bg-slate-500/10 border-slate-500/30",
  discipline: "bg-blue-500/10 border-blue-500/30",
  optimization: "bg-violet-500/10 border-violet-500/30",
  advanced_cognition: "bg-amber-500/10 border-amber-500/30",
};

const STAGE_DESCRIPTIONS: Record<string, string> = {
  foundation: "Building the essentials — financial profile, risk model, and basic investing habits.",
  discipline: "Developing consistent habits. Behavioral analytics and strategy tools are now available.",
  optimization: "Refining your strategy with attribution analysis and advanced intelligence features.",
  advanced_cognition: "Institutional-grade financial thinking. All platform features are unlocked.",
};

const COMPONENT_LABELS: Record<keyof ComponentScores, string> = {
  financial_stability: "Financial Stability",
  debt_discipline: "Debt Discipline",
  savings_consistency: "Savings Consistency",
  emotional_discipline: "Emotional Discipline",
  strategy_consistency: "Strategy Consistency",
  contribution_regularity: "Contribution Regularity",
  data_maturity: "Data Maturity",
  portfolio_complexity: "Portfolio Complexity",
};

const COMPONENT_WEIGHTS: Record<keyof ComponentScores, number> = {
  financial_stability: 20,
  debt_discipline: 15,
  savings_consistency: 15,
  emotional_discipline: 15,
  strategy_consistency: 15,
  contribution_regularity: 10,
  data_maturity: 5,
  portfolio_complexity: 5,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreArc({ score }: { score: number }) {
  const r = 56;
  const cx = 70;
  const cy = 70;
  const startAngle = -210;
  const sweepDeg = 240;

  function polarToXY(angle: number) {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  const start = polarToXY(startAngle);
  const end = polarToXY(startAngle + sweepDeg);
  const trackPath = `M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${end.x} ${end.y}`;

  const fillDeg = (score / 100) * sweepDeg;
  const fillEnd = polarToXY(startAngle + fillDeg);
  const largeArc = fillDeg > 180 ? 1 : 0;
  const fillPath =
    fillDeg > 0
      ? `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${fillEnd.x} ${fillEnd.y}`
      : "";

  const color =
    score >= 75 ? "#f59e0b" : score >= 50 ? "#8b5cf6" : score >= 25 ? "#3b82f6" : "#94a3b8";

  return (
    <svg width={140} height={120} viewBox="0 0 140 120">
      <path d={trackPath} fill="none" stroke="currentColor" strokeWidth={8} className="text-muted/20" strokeLinecap="round" />
      {fillPath && (
        <path d={fillPath} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" />
      )}
      <text x={cx} y={cy - 2} textAnchor="middle" className="fill-foreground" fontSize={22} fontWeight={700}>
        {Math.round(score)}
      </text>
      <text x={cx} y={cy + 16} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>
        / 100
      </text>
    </svg>
  );
}

function ComponentBar({ label, score, weight }: { label: string; score: number; weight: number }) {
  const color =
    score >= 75 ? "bg-green-500" : score >= 50 ? "bg-blue-500" : score >= 25 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-foreground font-medium">{label}</span>
        <span className="text-muted-foreground">{Math.round(score)}/100 · {weight}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function StageRoadmap({ current }: { current: string }) {
  const labels: Record<string, string> = {
    foundation: "Foundation",
    discipline: "Discipline",
    optimization: "Optimization",
    advanced_cognition: "Advanced",
  };
  const currentIdx = STAGE_ORDER.indexOf(current);
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {STAGE_ORDER.map((stage, i) => {
        const isDone = i < currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div key={stage} className="flex items-center gap-1">
            <div
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                isCurrent
                  ? `${STAGE_BG[stage]} ${STAGE_COLORS[stage]}`
                  : isDone
                  ? "bg-green-500/10 border-green-500/30 text-green-400"
                  : "bg-muted/20 border-border text-muted-foreground"
              }`}
            >
              {isDone ? "✓ " : ""}{labels[stage]}
            </div>
            {i < STAGE_ORDER.length - 1 && (
              <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MaturityPage() {
  const investorId = useInvestorId();
  const [snapshot, setSnapshot] = useState<MaturitySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!investorId) return;
    try {
      const res = await fetch(`/api/v1/investors/${investorId}/maturity`);
      if (!res.ok) throw new Error("Failed to load maturity data");
      setSnapshot(await res.json());
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
      const res = await fetch(`/api/v1/investors/${investorId}/maturity/refresh`, { method: "POST" });
      if (!res.ok) throw new Error("Refresh failed");
      setSnapshot(await res.json());
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
            <Trophy className="h-6 w-6 text-amber-400" />
            Investor Maturity
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your progress across 8 financial discipline dimensions — refreshed weekly.
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

      {snapshot && (
        <>
          {/* Stage + Score hero */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="md:col-span-1">
              <CardContent className="pt-6 flex flex-col items-center gap-3">
                <ScoreArc score={snapshot.composite_score} />
                <div className="text-center">
                  <Badge
                    variant="muted"
                    className={`text-sm font-semibold px-3 py-1 ${STAGE_BG[snapshot.stage]} ${STAGE_COLORS[snapshot.stage]}`}
                  >
                    {snapshot.stage_label}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-2 max-w-[180px]">
                    {STAGE_DESCRIPTIONS[snapshot.stage]}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Last computed {new Date(snapshot.computed_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Your Journey</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <StageRoadmap current={snapshot.stage} />

                {snapshot.notes.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Next steps
                    </p>
                    {snapshot.notes.map((note, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <TrendingUp className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
                        <span>{note}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Component breakdown */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Component Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                {(Object.keys(COMPONENT_LABELS) as Array<keyof ComponentScores>).map((key) => (
                  <ComponentBar
                    key={key}
                    label={COMPONENT_LABELS[key]}
                    score={snapshot.component_scores[key]}
                    weight={COMPONENT_WEIGHTS[key]}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Features unlocked */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Features Unlocked at Your Stage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {snapshot.features_unlocked.map((f) => (
                  <Badge key={f} variant="muted" className="capitalize text-xs">
                    {f.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

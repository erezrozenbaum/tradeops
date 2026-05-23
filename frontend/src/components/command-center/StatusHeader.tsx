"use client";

import { TrendingUp, TrendingDown, Minus, Brain, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusHeaderProps {
  twinScore: number;
  twinDelta: number | null;
  twinTrend: string;
  maturityStageLabel: string;
  stabilityClassification: string;
  stabilityScore: number;
  netWorthChangePct: number | null;
  activeRiskCount: number;
}

const STAGE_COLORS: Record<string, string> = {
  Foundation: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  Discipline: "text-blue-400 border-blue-400/30 bg-blue-400/10",
  Optimization: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  "Advanced Cognition": "text-purple-400 border-purple-400/30 bg-purple-400/10",
};

const STABILITY_COLORS: Record<string, string> = {
  strong: "text-emerald-400",
  stable: "text-blue-400",
  fragile: "text-amber-400",
  unstable: "text-red-400",
  unknown: "text-muted-foreground",
};

function TrendPill({ label, value, trend }: { label: string; value: string; trend: "up" | "down" | "flat" }) {
  const Icon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const color = trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-muted-foreground";
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-muted-foreground/60">{label}</span>
      <span className={cn("flex items-center gap-0.5 font-mono font-medium", color)}>
        <Icon className="h-3 w-3" />
        {value}
      </span>
    </div>
  );
}

export function StatusHeader({
  twinScore,
  twinDelta,
  twinTrend,
  maturityStageLabel,
  stabilityClassification,
  stabilityScore,
  netWorthChangePct,
  activeRiskCount,
}: StatusHeaderProps) {
  const scoreColor = twinScore >= 70 ? "text-emerald-400" : twinScore >= 45 ? "text-blue-400" : "text-amber-400";
  const stageCls = STAGE_COLORS[maturityStageLabel] || "text-muted-foreground border-muted/30 bg-muted/10";
  const stabColor = STABILITY_COLORS[stabilityClassification] || "text-muted-foreground";

  return (
    <div
      className="rounded-xl border bg-cyber-surface/60 backdrop-blur-sm p-4 sm:p-5"
      style={{ borderColor: "hsl(217 30% 12%)" }}
    >
      <div className="flex flex-wrap items-center gap-4 sm:gap-8">
        {/* Twin Score */}
        <div className="flex items-center gap-3">
          <Brain className="h-5 w-5 text-muted-foreground/50 shrink-0" />
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Financial Twin</p>
            <div className="flex items-baseline gap-1.5">
              <span className={cn("text-3xl font-bold font-mono tabular-nums", scoreColor)}>
                {twinScore.toFixed(1)}
              </span>
              {twinDelta !== null && (
                <span className={cn("text-xs font-mono", twinTrend === "up" ? "text-emerald-400" : twinTrend === "down" ? "text-red-400" : "text-muted-foreground")}>
                  {twinDelta >= 0 ? "+" : ""}{twinDelta.toFixed(1)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stage chip */}
        <div className={cn("px-3 py-1.5 rounded-md border text-xs font-semibold tracking-wide", stageCls)}>
          {maturityStageLabel}
        </div>

        {/* Trend pills */}
        <div className="flex flex-wrap gap-3 sm:gap-5 text-xs ml-auto">
          <TrendPill
            label="Stability"
            value={`${stabilityClassification} (${stabilityScore.toFixed(0)})`}
            trend={stabilityClassification === "strong" || stabilityClassification === "stable" ? "up" : "down"}
          />
          {netWorthChangePct !== null && (
            <TrendPill
              label="Net Worth 12m"
              value={`${netWorthChangePct >= 0 ? "+" : ""}${netWorthChangePct.toFixed(1)}%`}
              trend={netWorthChangePct > 0 ? "up" : netWorthChangePct < 0 ? "down" : "flat"}
            />
          )}
          {activeRiskCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              <span className="font-medium">{activeRiskCount} behavioral {activeRiskCount === 1 ? "risk" : "risks"}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

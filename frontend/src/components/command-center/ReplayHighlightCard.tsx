"use client";

import Link from "next/link";
import { GitBranch, ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReplayHighlight {
  scenario_type: string;
  insight_text: string;
  delta: number;
  delta_pct: number;
  reference_date: string | null;
}

interface ReplayHighlightCardProps {
  data: ReplayHighlight | null;
}

const SCENARIO_LABELS: Record<string, string> = {
  counterfactual_rebalance: "Rebalance Replay",
  counterfactual_constraint: "Constraint Replay",
  counterfactual_hold: "Panic-Sell Replay",
};

export function ReplayHighlightCard({ data }: ReplayHighlightCardProps) {
  if (!data) return null;

  const isPositive = data.delta_pct > 0;
  const label = SCENARIO_LABELS[data.scenario_type] ?? "Decision Replay";

  return (
    <div
      className="rounded-xl border bg-cyber-surface p-5"
      style={{ borderColor: "hsl(217 30% 12%)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-muted-foreground/60" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground/70">
            Decision Replay Insight
          </h2>
        </div>
        <Link href="/futures" className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-foreground transition-colors">
          Full replay <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="flex items-start gap-4">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground/70 mb-1">{label}</p>
          <p className="text-sm text-foreground/90 leading-relaxed italic">
            &ldquo;{data.insight_text}&rdquo;
          </p>
          {data.reference_date && (
            <p className="text-[11px] text-muted-foreground/40 mt-2">Reference date: {data.reference_date}</p>
          )}
        </div>
        <div className={cn(
          "shrink-0 flex flex-col items-center rounded-lg px-3 py-2",
          isPositive ? "bg-red-500/10 border border-red-500/20" : "bg-emerald-500/10 border border-emerald-500/20",
        )}>
          {isPositive
            ? <TrendingDown className="h-4 w-4 text-red-400" />
            : <TrendingUp className="h-4 w-4 text-emerald-400" />
          }
          <span className={cn("text-sm font-bold font-mono mt-0.5", isPositive ? "text-red-400" : "text-emerald-400")}>
            {isPositive ? "" : "+"}{data.delta_pct.toFixed(1)}%
          </span>
          <span className="text-[10px] text-muted-foreground/50">estimated</span>
        </div>
      </div>
    </div>
  );
}

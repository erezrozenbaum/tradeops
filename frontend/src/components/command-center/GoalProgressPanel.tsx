"use client";

import Link from "next/link";
import { Target, ArrowRight, TrendingUp, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface GoalProgressItem {
  id: string;
  name: string;
  goal_type: string;
  progress_pct: number;
  months_to_target: number | null;
  on_track: boolean;
  status: string;
  currency: string;
  target_amount: number;
  current_amount: number;
  monthly_contribution_needed: number | null;
}

interface GoalProgressPanelProps {
  goals: GoalProgressItem[];
}

const STATUS_CONFIG: Record<string, { label: string; badge: string; bar: string; icon: React.ReactNode }> = {
  at_risk: {
    label: "At Risk",
    badge: "bg-amber-500/15 text-amber-400",
    bar: "bg-amber-500",
    icon: <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />,
  },
  on_track: {
    label: "On Track",
    badge: "bg-emerald-500/15 text-emerald-400",
    bar: "bg-emerald-500",
    icon: <TrendingUp className="h-3.5 w-3.5 text-emerald-400 shrink-0" />,
  },
  complete: {
    label: "Complete",
    badge: "bg-cyan-500/15 text-cyber-cyan",
    bar: "bg-cyber-cyan",
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-cyber-cyan shrink-0" />,
  },
  no_date: {
    label: "No Date",
    badge: "bg-muted/30 text-muted-foreground",
    bar: "bg-muted-foreground/40",
    icon: <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />,
  },
  needs_log: {
    label: "Needs Update",
    badge: "bg-muted/30 text-muted-foreground",
    bar: "bg-muted-foreground/40",
    icon: <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />,
  },
};

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function GoalProgressPanel({ goals }: GoalProgressPanelProps) {
  return (
    <div className="rounded-xl border bg-cyber-surface p-5" style={{ borderColor: "hsl(217 30% 12%)" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground/60" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground/70">
            Goal Progress
          </h2>
        </div>
        <Link
          href="/goals"
          className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          All goals <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {!goals.length ? (
        <p className="text-xs text-muted-foreground/50">
          No goals configured.{" "}
          <Link href="/goals" className="text-cyber-cyan/70 hover:text-cyber-cyan underline-offset-2 underline">
            Add a goal
          </Link>{" "}
          to track progress here.
        </p>
      ) : (
        <div className="space-y-4">
          {goals.map((goal) => {
            const cfg = STATUS_CONFIG[goal.status] ?? STATUS_CONFIG.no_date;
            const barWidth = Math.min(100, Math.max(0, goal.progress_pct));

            return (
              <div key={goal.id} className="space-y-2">
                {/* Header row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {cfg.icon}
                    <span className="text-xs font-medium text-foreground truncate">{goal.name}</span>
                  </div>
                  <span className={cn("text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded shrink-0", cfg.badge)}>
                    {cfg.label}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", cfg.bar)}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>

                {/* Stats row */}
                <div className="flex items-center justify-between text-[11px] text-muted-foreground/60">
                  <span>
                    {fmt(goal.current_amount, goal.currency)}{" "}
                    <span className="text-muted-foreground/40">/ {fmt(goal.target_amount, goal.currency)}</span>
                  </span>
                  <span className="tabular-nums">{goal.progress_pct.toFixed(0)}%</span>
                </div>

                {/* Sub-info row */}
                <div className="flex items-center justify-between text-[11px] text-muted-foreground/50">
                  {goal.months_to_target != null ? (
                    <span>{goal.months_to_target.toFixed(0)} months remaining</span>
                  ) : (
                    <span>No target date</span>
                  )}
                  {goal.monthly_contribution_needed != null && goal.status === "at_risk" && (
                    <span className="text-amber-400/70">
                      Need {fmt(goal.monthly_contribution_needed, goal.currency)}/mo
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

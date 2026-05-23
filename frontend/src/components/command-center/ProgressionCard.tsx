"use client";

import { CheckCircle2, Circle, Dot } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProgressionStage {
  key: string;
  label: string;
  is_current: boolean;
  is_complete: boolean;
}

interface InvestorProgression {
  stages: ProgressionStage[];
  current_stage: string;
  current_stage_label: string;
  composite_score: number;
  features_unlocked: string[];
  next_unlock_feature: string | null;
  score_to_next_stage: number | null;
}

interface ProgressionCardProps {
  data: InvestorProgression;
}

const FEATURE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  paper_trading: "Paper Trading",
  risk_model: "Risk Model",
  strategy_recommendation: "Strategies",
  backtesting: "Backtesting",
  goals: "Goals",
  financial_profile: "Financial Profile",
  behavioral_intel: "Behavioral Intelligence",
  timeline: "Decision Timeline",
  strategy_drift: "Strategy Drift",
  attribution: "Performance Attribution",
  simulation: "Simulation Engine",
  counterfactual_replay: "Counterfactual Replay",
  financial_twin: "Financial Twin",
  health_radar: "Health Radar",
  thought_partner_advanced: "Advanced Thought Partner",
};

export function ProgressionCard({ data }: ProgressionCardProps) {
  return (
    <div className="rounded-xl border bg-cyber-surface p-5" style={{ borderColor: "hsl(217 30% 12%)" }}>
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground/70 mb-4">
        Investor Progression
      </h2>

      {/* Stage track */}
      <div className="flex items-center gap-1 mb-5">
        {data.stages.map((stage, i) => (
          <div key={stage.key} className="flex items-center gap-1 flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1 min-w-0">
              {stage.is_complete ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : stage.is_current ? (
                <div className="h-4 w-4 rounded-full border-2 border-blue-400 bg-blue-400/20 shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground/30 shrink-0" />
              )}
              <span className={cn(
                "text-[10px] font-medium text-center leading-none truncate max-w-[56px]",
                stage.is_current ? "text-blue-400" : stage.is_complete ? "text-emerald-400/70" : "text-muted-foreground/30",
              )}>
                {stage.label}
              </span>
            </div>
            {i < data.stages.length - 1 && (
              <div className={cn(
                "flex-1 h-px mx-1 mb-4",
                i < data.stages.findIndex(s => s.is_current) ? "bg-emerald-400/40" : "bg-white/10",
              )} />
            )}
          </div>
        ))}
      </div>

      {/* Score */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-muted-foreground/60">Maturity Score</span>
        <span className="text-sm font-mono font-bold text-foreground">{data.composite_score.toFixed(1)}</span>
      </div>

      {data.score_to_next_stage !== null && data.score_to_next_stage > 0 && (
        <p className="text-[11px] text-muted-foreground/50 mb-4">
          {data.score_to_next_stage.toFixed(1)} points to next stage
        </p>
      )}

      {/* Unlocked features */}
      <div>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50 block mb-2">Unlocked</span>
        <div className="flex flex-wrap gap-1.5">
          {data.features_unlocked.map(f => (
            <span key={f} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground/60 border border-white/8">
              {FEATURE_LABELS[f] ?? f}
            </span>
          ))}
        </div>
      </div>

      {data.next_unlock_feature && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: "hsl(217 30% 12%)" }}>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50 block mb-1">Next Unlock</span>
          <span className="text-xs text-blue-400/80">{FEATURE_LABELS[data.next_unlock_feature] ?? data.next_unlock_feature}</span>
        </div>
      )}
    </div>
  );
}

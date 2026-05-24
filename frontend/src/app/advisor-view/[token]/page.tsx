"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { StatusHeader } from "@/components/command-center/StatusHeader";
import { ActionsPanel } from "@/components/command-center/ActionsPanel";
import { EvolutionFeed } from "@/components/command-center/EvolutionFeed";
import { HealthRadarCard } from "@/components/command-center/HealthRadarCard";
import { TwinInsightsCard } from "@/components/command-center/TwinInsightsCard";
import { BehavioralRisksPanel } from "@/components/command-center/BehavioralRisksPanel";
import { FuturesPreviewCard } from "@/components/command-center/FuturesPreviewCard";
import { ReplayHighlightCard } from "@/components/command-center/ReplayHighlightCard";
import { AIThoughtPartnerCard } from "@/components/command-center/AIThoughtPartnerCard";
import { ProgressionCard } from "@/components/command-center/ProgressionCard";
import { GoalProgressPanel } from "@/components/command-center/GoalProgressPanel";
import { Eye, AlertTriangle } from "lucide-react";
import type { MaturityVariant } from "@/hooks/useMaturityVariant";

// ─── Types (mirrors CommandCenterReport) ─────────────────────────────────────

interface AdvisorSnapshot {
  investor_name: string;
  expires_at: string;
  report: {
    header: {
      twin_overall_score: number;
      twin_score_delta_7d: number | null;
      twin_trend: string;
      maturity_stage: string;
      maturity_stage_label: string;
      stability_classification: string;
      stability_score: number;
      net_worth_change_pct_12m: number | null;
      active_behavioral_risk_count: number;
    };
    top_actions: Array<{
      title: string;
      rationale: string;
      severity: string;
      impact: string;
      urgent: boolean;
      category: string;
      link: string | null;
    }>;
    evolution_feed: Array<{
      metric: string;
      label: string;
      direction: string;
      from_value: number | null;
      to_value: number | null;
      delta_display: string;
      cause: string | null;
      item_severity: string;
    }>;
    health_radar: Array<{ dimension: string; label: string; value: number }>;
    twin_insights: {
      positive_drivers: Array<{ label: string; value: number }>;
      drag_factors: Array<{ label: string; value: number }>;
    };
    behavioral_risks: Array<{
      event_type: string;
      severity: string;
      description: string;
      recommendation: string;
    }>;
    futures_preview: {
      paths: Array<{ label: string; values: number[]; color: string }>;
      fi_probability: number | null;
      has_data: boolean;
    };
    replay_highlight: {
      scenario_type: string;
      insight_text: string;
      delta: number;
      delta_pct: number;
      reference_date: string | null;
    } | null;
    ai_summary: string;
    ai_summary_verbosity: string;
    progression: {
      stages: Array<{ key: string; label: string; is_current: boolean; is_complete: boolean }>;
      current_stage: string;
      current_stage_label: string;
      composite_score: number;
      features_unlocked: string[];
      next_unlock_feature: string | null;
      score_to_next_stage: number | null;
    };
    goal_progress: Array<{
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
    }>;
    maturity_stage: string;
    generated_at: string;
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdvisorViewPage() {
  const params = useParams<{ token: string }>();
  const [snapshot, setSnapshot] = useState<AdvisorSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.token) return;
    fetch(`/api/v1/advisor-share/${params.token}`)
      .then(async (res) => {
        if (res.status === 404) throw new Error("This share link has expired or been revoked.");
        if (!res.ok) throw new Error(`Unable to load shared report (HTTP ${res.status}).`);
        return res.json() as Promise<AdvisorSnapshot>;
      })
      .then(setSnapshot)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load report"))
      .finally(() => setLoading(false));
  }, [params.token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col gap-4 p-6 animate-pulse">
        <div className="h-8 w-48 rounded-lg bg-cyber-surface/60" />
        <div className="h-20 rounded-xl bg-cyber-surface/60" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-48 rounded-xl bg-cyber-surface/60" />
          <div className="h-48 rounded-xl bg-cyber-surface/60" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-red-400 mx-auto" />
          <p className="text-sm font-medium text-red-400">{error}</p>
          <p className="text-xs text-muted-foreground/50">The investor may have revoked this link, or it has expired after 7 days.</p>
        </div>
      </div>
    );
  }

  if (!snapshot) return null;

  const { report, investor_name, expires_at } = snapshot;
  const { header } = report;

  // Advisor view uses "optimization" variant — all sections visible
  const variant: MaturityVariant = {
    showNumericMetrics: true,
    showCausalExplanations: true,
    showProbabilisticLanguage: false,
    actionCopyDetail: "detailed",
    radarLabelStyle: "full",
    aiVerbosity: "standard",
    showFuturesPreview: true,
    showReplayHighlight: true,
    showDragFactors: true,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Read-only banner */}
      <div className="sticky top-0 z-40 flex items-center justify-between px-4 py-2 border-b bg-cyber-surface/90 backdrop-blur-sm" style={{ borderColor: "hsl(217 30% 12%)" }}>
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-cyber-blue" />
          <span className="text-xs font-medium text-cyber-blue">Advisor View — Read Only</span>
        </div>
        <div className="text-xs text-muted-foreground/40">
          {investor_name} · expires {new Date(expires_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto">
        {/* Page title */}
        <div>
          <h1 className="text-lg font-bold tracking-tight">{investor_name}</h1>
          <p className="text-xs text-muted-foreground/60 mt-0.5">
            Generated {new Date(report.generated_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>

        {/* Status Header */}
        <StatusHeader
          twinScore={header.twin_overall_score}
          twinDelta={header.twin_score_delta_7d}
          twinTrend={header.twin_trend}
          maturityStageLabel={header.maturity_stage_label}
          stabilityClassification={header.stability_classification}
          stabilityScore={header.stability_score}
          netWorthChangePct={header.net_worth_change_pct_12m}
          activeRiskCount={header.active_behavioral_risk_count}
        />

        {/* Row 1: Actions + Evolution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ActionsPanel actions={report.top_actions} variant={variant} />
          <EvolutionFeed items={report.evolution_feed} variant={variant} />
        </div>

        {/* Row 2: Behavioral Risks + Futures Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BehavioralRisksPanel risks={report.behavioral_risks} />
          <FuturesPreviewCard data={report.futures_preview} />
        </div>

        {/* Row 3: Goals + Health Radar */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <GoalProgressPanel goals={report.goal_progress} />
          <HealthRadarCard data={report.health_radar} />
        </div>

        {/* Twin Insights */}
        <TwinInsightsCard data={report.twin_insights} variant={variant} />

        {/* Replay Highlight */}
        {report.replay_highlight && (
          <ReplayHighlightCard data={report.replay_highlight} />
        )}

        {/* AI Summary */}
        <AIThoughtPartnerCard
          summary={report.ai_summary}
          verbosityUsed={report.ai_summary_verbosity}
          maturityStageLabel={header.maturity_stage_label}
          onVerbosityChange={() => {}}
        />

        {/* Progression */}
        <ProgressionCard data={report.progression} />

        {/* Footer disclaimer */}
        <div className="rounded-xl border p-4 text-xs text-muted-foreground/40 text-center" style={{ borderColor: "hsl(217 30% 10%)" }}>
          This is a read-only advisor snapshot shared by the investor. TradeOps AI is an educational and analytical platform — not financial advice.
        </div>
      </div>
    </div>
  );
}

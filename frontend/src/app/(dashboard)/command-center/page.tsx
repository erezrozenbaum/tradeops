"use client";

import { useEffect, useState, useCallback } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { useMaturityVariant } from "@/hooks/useMaturityVariant";
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
import { RefreshCw, Share2, Copy, CheckCheck, Trash2, X } from "lucide-react";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CommandCenterReport {
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
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CommandCenterPage() {
  const investorId = useInvestorId();
  const [report, setReport] = useState<CommandCenterReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verbosity, setVerbosity] = useState<"beginner" | "standard" | "advanced">("standard");
  const [reloading, setReloading] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareTokens, setShareTokens] = useState<Array<{ token: string; created_at: string; expires_at: string }>>([]);
  const [shareCreating, setShareCreating] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const variant = useMaturityVariant(report?.maturity_stage);

  const fetchReport = useCallback(async (inv: string, v: string, showReloading = false) => {
    if (showReloading) setReloading(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/investors/${inv}/command-center?verbosity=${v}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: CommandCenterReport = await res.json();
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load command center");
    } finally {
      setLoading(false);
      setReloading(false);
    }
  }, []);

  useEffect(() => {
    if (investorId) fetchReport(investorId, verbosity);
  }, [investorId, verbosity, fetchReport]);

  const handleVerbosityChange = (v: "beginner" | "standard" | "advanced") => {
    setVerbosity(v);
    if (investorId) fetchReport(investorId, v, true);
  };

  const openShareModal = async () => {
    setShowShareModal(true);
    if (!investorId) return;
    const res = await fetch(`/api/v1/investors/${investorId}/advisor-share`, { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      setShareTokens(data.tokens);
    }
  };

  const createShare = async () => {
    if (!investorId) return;
    setShareCreating(true);
    const res = await fetch(`/api/v1/investors/${investorId}/advisor-share`, {
      method: "POST",
      credentials: "include",
    });
    if (res.ok) {
      const newToken = await res.json();
      setShareTokens((prev) => [newToken, ...prev]);
    }
    setShareCreating(false);
  };

  const revokeShare = async (token: string) => {
    if (!investorId) return;
    const res = await fetch(`/api/v1/investors/${investorId}/advisor-share/${token}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      setShareTokens((prev) => prev.filter((t) => t.token !== token));
    }
  };

  const copyShareLink = (token: string) => {
    const url = `${window.location.origin}/advisor-view/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-6 animate-pulse">
        <div className="h-20 rounded-xl bg-cyber-surface/60" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-48 rounded-xl bg-cyber-surface/60" />
          <div className="h-48 rounded-xl bg-cyber-surface/60" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-64 rounded-xl bg-cyber-surface/60" />
          <div className="h-64 rounded-xl bg-cyber-surface/60" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-400">
          Failed to load Command Center: {error}
        </div>
      </div>
    );
  }

  if (!report) return null;

  const { header } = report;

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Page title row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Command Center</h1>
          <p className="text-xs text-muted-foreground/60 mt-0.5">
            {new Date(report.generated_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={openShareModal}
            className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </button>
          <button
            onClick={() => investorId && fetchReport(investorId, verbosity, true)}
            disabled={reloading}
            className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-foreground transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${reloading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border bg-cyber-surface shadow-2xl" style={{ borderColor: "hsl(217 30% 16%)" }}>
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: "hsl(217 30% 12%)" }}>
              <div>
                <h2 className="text-sm font-semibold">Share with Advisor</h2>
                <p className="text-xs text-muted-foreground/50 mt-0.5">Read-only link · expires in 7 days · no write access</p>
              </div>
              <button onClick={() => setShowShareModal(false)} className="text-muted-foreground/50 hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <button
                onClick={createShare}
                disabled={shareCreating}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-cyber-blue/10 border border-cyber-blue/20 text-cyber-blue text-xs font-medium py-2.5 hover:bg-cyber-blue/15 transition-colors disabled:opacity-50"
              >
                <Share2 className="h-3.5 w-3.5" />
                {shareCreating ? "Creating…" : "Create New Share Link"}
              </button>

              {shareTokens.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground/40 font-medium uppercase tracking-wide">Active Links</p>
                  {shareTokens.map((t) => (
                    <div
                      key={t.token}
                      className="flex items-center gap-2 rounded-lg border p-3"
                      style={{ borderColor: "hsl(217 30% 12%)" }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-muted-foreground/70 truncate">{t.token.slice(0, 20)}…</p>
                        <p className="text-[10px] text-muted-foreground/40 mt-0.5">
                          Expires {new Date(t.expires_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                        </p>
                      </div>
                      <button
                        onClick={() => copyShareLink(t.token)}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-cyber-blue transition-colors shrink-0"
                      >
                        {copiedToken === t.token ? (
                          <CheckCheck className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        {copiedToken === t.token ? "Copied" : "Copy"}
                      </button>
                      <button
                        onClick={() => revokeShare(t.token)}
                        className="text-muted-foreground/30 hover:text-red-400 transition-colors shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {shareTokens.length === 0 && (
                <p className="text-xs text-muted-foreground/30 text-center py-2">No active share links</p>
              )}
            </div>
          </div>
        </div>
      )}

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

      {/* Row 1: Actions + Evolution Feed */}
      <CollapsibleSection id="actions_feed" title="Actions & Evolution">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ActionsPanel actions={report.top_actions} variant={variant} />
          <EvolutionFeed items={report.evolution_feed} variant={variant} />
        </div>
      </CollapsibleSection>

      {/* Row 2: Behavioral Risks + Futures Preview */}
      <CollapsibleSection id="risks_futures" title="Risks & Futures">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BehavioralRisksPanel risks={report.behavioral_risks} />
          {variant.showFuturesPreview && (
            <FuturesPreviewCard data={report.futures_preview} />
          )}
          {!variant.showFuturesPreview && (
            <div className="rounded-xl border bg-cyber-surface/30 p-5 flex items-center justify-center" style={{ borderColor: "hsl(217 30% 12%)" }}>
              <p className="text-xs text-muted-foreground/40 text-center">
                Simulation engine unlocks at Discipline stage.<br />Keep building your financial foundation.
              </p>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Row 3: Goals + Health Radar */}
      <CollapsibleSection id="goals_radar" title="Goals & Health">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <GoalProgressPanel goals={report.goal_progress} />
          <HealthRadarCard data={report.health_radar} />
        </div>
      </CollapsibleSection>

      {/* Row 4: Twin Insights */}
      <CollapsibleSection id="twin_insights" title="Twin Insights">
        <TwinInsightsCard data={report.twin_insights} variant={variant} />
      </CollapsibleSection>

      {/* Replay Highlight */}
      {variant.showReplayHighlight && report.replay_highlight && (
        <CollapsibleSection id="replay" title="Counterfactual Replay">
          <ReplayHighlightCard data={report.replay_highlight} />
        </CollapsibleSection>
      )}

      {/* AI Thought Partner */}
      <CollapsibleSection id="ai_partner" title="AI Thought Partner">
        <AIThoughtPartnerCard
          summary={report.ai_summary}
          verbosityUsed={report.ai_summary_verbosity}
          maturityStageLabel={header.maturity_stage_label}
          onVerbosityChange={handleVerbosityChange}
        />
      </CollapsibleSection>

      {/* Progression */}
      <CollapsibleSection id="progression" title="Progression">
        <ProgressionCard data={report.progression} />
      </CollapsibleSection>
    </div>
  );
}

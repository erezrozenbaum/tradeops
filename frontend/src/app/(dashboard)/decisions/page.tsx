"use client";

import { useEffect, useState, useCallback } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  GitBranch, ChevronRight, X, Bot, Cpu, BarChart2, RefreshCw,
  CheckCircle2, AlertTriangle, Zap, RotateCcw,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────

interface DecisionListItem {
  id: string;
  decision_type: string;
  triggered_at: string;
  model_used: string | null;
  recommendation_count: number | null;
  decision_hash: string | null;
  output_summary: Record<string, unknown> | null;
}

interface ReplayResult {
  original_decision_id: string;
  original_triggered_at: string;
  replayed_at: string;
  decision_type: string;
  original_output_summary: Record<string, unknown> | null;
  replayed_output_summary: Record<string, unknown> | null;
  input_tokens: number | null;
  output_tokens: number | null;
  diff_note: string;
}

interface DecisionDetail {
  id: string;
  investor_id: string;
  decision_type: string;
  triggered_at: string;
  portfolio_snapshot_id: string | null;
  risk_model_snapshot: Record<string, unknown> | null;
  holdings_summary: Record<string, unknown> | null;
  fx_rate_snapshot: Record<string, unknown> | null;
  price_snapshot: Record<string, unknown> | null;
  market_signals_snapshot: Record<string, unknown>[] | null;
  rule_results: Record<string, unknown> | null;
  model_used: string | null;
  prompt_version: string | null;
  ai_input_summary: string | null;
  ai_output_summary: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  output_summary: Record<string, unknown> | null;
  recommendation_count: number | null;
  decision_hash: string | null;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  ai_recommendation: { label: "AI Recommendation", color: "bg-violet-500/10 text-violet-600 border-violet-500/20", icon: Bot },
  coach_insight: { label: "Coach Insight", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: Zap },
  rebalance: { label: "Rebalance", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: BarChart2 },
};

function typeLabel(t: string) {
  return TYPE_META[t]?.label ?? t;
}

function typeBadgeClass(t: string) {
  return TYPE_META[t]?.color ?? "bg-muted text-muted-foreground";
}

function modelLabel(m: string | null) {
  if (!m) return null;
  if (m.includes("sonnet-4-6")) return "Sonnet 4.6";
  if (m.includes("haiku-4-5")) return "Haiku 4.5";
  if (m.includes("opus-4-7")) return "Opus 4.7";
  return m;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function JsonSection({ label, data }: { label: string; data: unknown }) {
  if (!data) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1.5">{label}</p>
      <pre className="text-xs bg-muted/40 rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-words font-mono leading-relaxed">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────

function DetailPanel({ decision, investorId, onClose }: { decision: DecisionDetail; investorId: string; onClose: () => void }) {
  const [replaying, setReplaying] = useState(false);
  const [replayResult, setReplayResult] = useState<ReplayResult | null>(null);
  const [replayError, setReplayError] = useState<string | null>(null);
  const isDeterministic = !decision.model_used;
  const hasAI = !!decision.model_used;
  const canReplay = decision.decision_type === "ai_recommendation";

  async function runReplay() {
    setReplaying(true);
    setReplayError(null);
    setReplayResult(null);
    try {
      const res = await fetch(`/api/v1/investors/${investorId}/decisions/${decision.id}/replay`, { method: "POST" });
      if (res.ok) {
        setReplayResult(await res.json());
      } else {
        const err = await res.json().catch(() => ({}));
        setReplayError(err.detail ?? "Replay failed");
      }
    } catch {
      setReplayError("Network error");
    } finally {
      setReplaying(false);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-border shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className={`text-xs border ${typeBadgeClass(decision.decision_type)}`}>
              {typeLabel(decision.decision_type)}
            </Badge>
            {decision.prompt_version && (
              <span className="text-xs font-mono text-muted-foreground">{decision.prompt_version}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{fmtDate(decision.triggered_at)}</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Confidence row */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span className="font-medium text-emerald-600 dark:text-emerald-400">Deterministic</span>
            <span className="text-muted-foreground">— risk engine, rules</span>
          </div>
          {hasAI && (
            <div className="flex items-center gap-1.5">
              <Bot className="h-3.5 w-3.5 text-violet-500" />
              <span className="font-medium text-violet-600 dark:text-violet-400">AI-assisted</span>
              <span className="text-muted-foreground">{modelLabel(decision.model_used)}</span>
            </div>
          )}
        </div>

        {/* Output summary */}
        {decision.output_summary && (
          <div className="rounded-md border border-border bg-card p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Output</p>
            {Boolean(decision.output_summary.overall_guidance) && (
              <p className="text-sm mb-2 leading-relaxed">{String(decision.output_summary.overall_guidance)}</p>
            )}
            {Array.isArray(decision.output_summary.insights) && (
              <ul className="space-y-1">
                {(decision.output_summary.insights as { title: string; severity: string }[]).map((ins, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <AlertTriangle className={`h-3 w-3 shrink-0 ${ins.severity === "danger" ? "text-rose-500" : ins.severity === "warning" ? "text-amber-500" : "text-blue-500"}`} />
                    {ins.title}
                  </li>
                ))}
              </ul>
            )}
            {Array.isArray(decision.output_summary.recommendation_tickers) && (
              <div className="flex flex-wrap gap-1 mt-2">
                {(decision.output_summary.recommendation_tickers as string[]).map(t => (
                  <span key={t} className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{t}</span>
                ))}
              </div>
            )}
            {decision.recommendation_count != null && (
              <p className="text-xs text-muted-foreground mt-2">{decision.recommendation_count} recommendation{decision.recommendation_count !== 1 ? "s" : ""} produced</p>
            )}
          </div>
        )}

        {/* Deterministic inputs */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5 text-emerald-500" />
            <p className="text-xs font-semibold">Deterministic inputs</p>
          </div>
          <JsonSection label="Risk model at decision time" data={decision.risk_model_snapshot} />
          <JsonSection label="Holdings summary" data={decision.holdings_summary} />
          <JsonSection label="Rule results" data={decision.rule_results} />
          <JsonSection label="FX rates at decision time" data={decision.fx_rate_snapshot} />
        </div>

        {/* AI context */}
        {hasAI && (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              <Bot className="h-3.5 w-3.5 text-violet-500" />
              <p className="text-xs font-semibold">AI context</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded border border-border bg-muted/30 p-2 text-center">
                <p className="text-xs text-muted-foreground mb-0.5">Model</p>
                <p className="text-xs font-mono font-medium">{modelLabel(decision.model_used)}</p>
              </div>
              <div className="rounded border border-border bg-muted/30 p-2 text-center">
                <p className="text-xs text-muted-foreground mb-0.5">Input tokens</p>
                <p className="text-sm font-semibold">{decision.input_tokens?.toLocaleString() ?? "—"}</p>
              </div>
              <div className="rounded border border-border bg-muted/30 p-2 text-center">
                <p className="text-xs text-muted-foreground mb-0.5">Output tokens</p>
                <p className="text-sm font-semibold">{decision.output_tokens?.toLocaleString() ?? "—"}</p>
              </div>
            </div>
            {decision.ai_output_summary && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">AI output (truncated)</p>
                <p className="text-xs text-muted-foreground bg-muted/40 rounded-md p-3 leading-relaxed">
                  {decision.ai_output_summary}
                </p>
              </div>
            )}
            <JsonSection label="Market signals used" data={decision.market_signals_snapshot} />
          </div>
        )}

        {/* Metadata */}
        <div className="pt-2 border-t border-border text-xs text-muted-foreground space-y-1">
          <div className="flex justify-between">
            <span>Decision ID</span>
            <span className="font-mono">{decision.id.slice(0, 8)}…</span>
          </div>
          {decision.decision_hash && (
            <div className="flex justify-between">
              <span>Decision hash</span>
              <span className="font-mono">{decision.decision_hash}</span>
            </div>
          )}
          {decision.portfolio_snapshot_id && (
            <div className="flex justify-between">
              <span>Portfolio snapshot</span>
              <span className="font-mono">{decision.portfolio_snapshot_id.slice(0, 8)}…</span>
            </div>
          )}
        </div>

        {/* Replay */}
        {canReplay && (
          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-semibold">Replay with frozen context</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Re-run AI using the exact same risk model, holdings, and signals from this decision
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={runReplay} disabled={replaying} className="h-7 text-xs shrink-0">
                {replaying ? (
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                )}
                {replaying ? "Running…" : "Replay"}
              </Button>
            </div>

            {replayError && (
              <p className="text-xs text-destructive bg-destructive/10 rounded px-3 py-2">{replayError}</p>
            )}

            {replayResult && (
              <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3">
                <p className="text-xs font-medium">Replay result — {fmtDate(replayResult.replayed_at)}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Original</p>
                    {Boolean(replayResult.original_output_summary?.recommendation_tickers) && (
                      <div className="flex flex-wrap gap-1">
                        {(replayResult.original_output_summary!.recommendation_tickers as string[]).map(t => (
                          <span key={t} className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded border border-border">{t}</span>
                        ))}
                      </div>
                    )}
                    {Boolean(replayResult.original_output_summary?.overall_guidance) && (
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-3">
                        {String(replayResult.original_output_summary!.overall_guidance)}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Replayed</p>
                    {Boolean(replayResult.replayed_output_summary?.recommendation_tickers) && (
                      <div className="flex flex-wrap gap-1">
                        {(replayResult.replayed_output_summary!.recommendation_tickers as string[]).map(t => (
                          <span key={t} className="text-xs font-mono bg-violet-500/10 text-violet-600 px-1.5 py-0.5 rounded border border-violet-500/20">{t}</span>
                        ))}
                      </div>
                    )}
                    {Boolean(replayResult.replayed_output_summary?.overall_guidance) && (
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-3">
                        {String(replayResult.replayed_output_summary!.overall_guidance)}
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground border-t border-border pt-2 mt-2">
                  {replayResult.diff_note}
                </p>
                {replayResult.input_tokens != null && (
                  <p className="text-xs text-muted-foreground">
                    Tokens used: {replayResult.input_tokens.toLocaleString()} in + {replayResult.output_tokens?.toLocaleString()} out
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function DecisionsPage() {
  const investorId = useInvestorId();
  const [decisions, setDecisions] = useState<DecisionListItem[]>([]);
  const [selected, setSelected] = useState<DecisionDetail | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadDecisions = useCallback(async () => {
    if (!investorId) return;
    setLoading(true);
    try {
      const typeParam = filter !== "all" ? `&decision_type=${filter}` : "";
      const res = await fetch(`/api/v1/investors/${investorId}/decisions?limit=50${typeParam}`);
      if (res.ok) setDecisions(await res.json());
    } finally {
      setLoading(false);
    }
  }, [investorId, filter]);

  useEffect(() => { loadDecisions(); }, [loadDecisions]);

  async function selectDecision(id: string) {
    if (!investorId) return;
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/v1/investors/${investorId}/decisions/${id}`);
      if (res.ok) setSelected(await res.json());
    } finally {
      setDetailLoading(false);
    }
  }

  const FILTERS = [
    { key: "all", label: "All" },
    { key: "ai_recommendation", label: "Recommendations" },
    { key: "coach_insight", label: "Coach" },
    { key: "rebalance", label: "Rebalance" },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <GitBranch className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Decision Provenance</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Every recommendation traced — deterministic inputs, AI context, data used
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadDecisions}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 shrink-0">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => { setFilter(f.key); setSelected(null); }}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              filter === f.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Main layout: list + detail panel */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Decision list */}
        <div className={`flex flex-col min-h-0 ${selected ? "w-80 shrink-0" : "flex-1"}`}>
          <div className="flex-1 overflow-y-auto rounded-lg border border-border bg-card">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : decisions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center px-4">
                <GitBranch className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">No decisions recorded yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Provenance is captured automatically when recommendations, coach insights, or rebalancing runs
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {decisions.map(d => {
                  const isSelected = selected?.id === d.id;
                  const Icon = TYPE_META[d.decision_type]?.icon ?? GitBranch;
                  return (
                    <button
                      key={d.id}
                      onClick={() => selectDecision(d.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors flex items-start gap-3 ${
                        isSelected ? "bg-muted/60" : ""
                      }`}
                    >
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${TYPE_META[d.decision_type] ? "text-" + TYPE_META[d.decision_type].color.split("text-")[1]?.split(" ")[0] : "text-muted-foreground"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Badge className={`text-xs border ${typeBadgeClass(d.decision_type)}`}>
                            {typeLabel(d.decision_type)}
                          </Badge>
                          {d.model_used && (
                            <span className="text-xs text-muted-foreground">
                              {modelLabel(d.model_used)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{fmtDate(d.triggered_at)}</p>
                        {d.recommendation_count != null && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {d.recommendation_count} item{d.recommendation_count !== 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="flex-1 min-h-0 rounded-lg border border-border bg-card overflow-hidden">
            {detailLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <DetailPanel decision={selected} investorId={investorId!} onClose={() => setSelected(null)} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

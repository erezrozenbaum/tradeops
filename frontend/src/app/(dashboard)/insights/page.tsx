"use client";

import { useEffect, useState, useCallback } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sparkles, RefreshCw, X, ArrowRight, AlertTriangle, Info, Zap,
} from "lucide-react";
import Link from "next/link";
import { AIDisclaimer } from "@/components/ui/ai-disclaimer";

// ── Types ──────────────────────────────────────────────────────────────────

interface CoachInsight {
  id: string;
  insight_type: string;
  severity: string;
  title: string;
  message: string;
  action_text: string | null;
  link: string | null;
  generated_at: string;
}

const SEVERITY_STYLES: Record<string, { badge: string; border: string; icon: React.ElementType; iconColor: string }> = {
  danger: {
    badge: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    border: "border-l-red-500",
    icon: AlertTriangle,
    iconColor: "text-red-500",
  },
  warning: {
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    border: "border-l-amber-500",
    icon: Zap,
    iconColor: "text-amber-500",
  },
  info: {
    badge: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
    border: "border-l-blue-500",
    icon: Info,
    iconColor: "text-blue-500",
  },
};

const INSIGHT_TYPE_LABELS: Record<string, string> = {
  emergency_fund: "Emergency Fund",
  idle_cash: "Idle Cash",
  goal_behind: "Goal",
  concentration: "Concentration",
  tier_drift: "Allocation",
  tax_loss_harvest: "Tax",
  paper_trading_milestone: "Milestone",
  high_interest_debt: "Debt",
};

// ── Insight card ──────────────────────────────────────────────────────────

function InsightCard({
  insight,
  onDismiss,
}: {
  insight: CoachInsight;
  onDismiss: (id: string) => void;
}) {
  const styles = SEVERITY_STYLES[insight.severity] ?? SEVERITY_STYLES.info;
  const Icon = styles.icon;

  return (
    <Card className={`border-l-4 ${styles.border} transition-all`}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className={`shrink-0 mt-0.5 ${styles.iconColor}`}>
            <Icon className="h-4 w-4" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-sm">{insight.title}</p>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${styles.badge}`}>
                  {INSIGHT_TYPE_LABELS[insight.insight_type] ?? insight.insight_type}
                </span>
              </div>
              <button
                onClick={() => onDismiss(insight.id)}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                title="Dismiss for 7 days"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{insight.message}</p>

            {insight.action_text && (
              <div className="mt-2.5 flex items-center gap-3">
                <p className="text-xs font-medium text-foreground">{insight.action_text}</p>
                {insight.link && (
                  <Link
                    href={insight.link}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Go <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            )}

            <p className="text-[10px] text-muted-foreground/60 mt-2">
              {new Date(insight.generated_at).toLocaleString(undefined, {
                month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
              })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const investorId = useInvestorId();
  const [insights, setInsights] = useState<CoachInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!investorId) return;
    const r = await fetch(`/api/v1/investors/${investorId}/coach`);
    if (r.ok) setInsights(await r.json());
    setLoading(false);
  }, [investorId]);

  useEffect(() => { load(); }, [load]);

  async function handleRefresh() {
    if (!investorId) return;
    setRefreshing(true);
    const r = await fetch(`/api/v1/investors/${investorId}/coach/refresh`, { method: "POST" });
    if (r.ok) setInsights(await r.json());
    setRefreshing(false);
  }

  async function handleDismiss(id: string) {
    if (!investorId) return;
    await fetch(`/api/v1/investors/${investorId}/coach/${id}`, { method: "DELETE" });
    setInsights(prev => prev.filter(i => i.id !== id));
  }

  const danger = insights.filter(i => i.severity === "danger");
  const warning = insights.filter(i => i.severity === "warning");
  const info = insights.filter(i => i.severity === "info");

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-3xl">
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-48 bg-muted rounded" />
          {[...Array(3)].map((_, i) => <div key={i} className="h-28 bg-muted rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">AI Coach</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Proactive insights based on your financial situation
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Analysing…" : "Refresh"}
        </Button>
      </div>

      <AIDisclaimer compact />

      {/* Empty state */}
      {insights.length === 0 && (
        <Card>
          <CardContent className="py-14 text-center">
            <Sparkles className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-medium">No active insights</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
              Your financial picture looks clean, or insights haven&apos;t been generated yet. Hit Refresh to run the analysis.
            </p>
            <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Analysing…" : "Run analysis"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Danger */}
      {danger.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 border text-xs">
              {danger.length} critical
            </Badge>
          </div>
          {danger.map(i => (
            <InsightCard key={i.id} insight={i} onDismiss={handleDismiss} />
          ))}
        </section>
      )}

      {/* Warning */}
      {warning.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 border text-xs">
              {warning.length} warning{warning.length > 1 ? "s" : ""}
            </Badge>
          </div>
          {warning.map(i => (
            <InsightCard key={i.id} insight={i} onDismiss={handleDismiss} />
          ))}
        </section>
      )}

      {/* Info */}
      {info.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 border text-xs">
              {info.length} suggestion{info.length > 1 ? "s" : ""}
            </Badge>
          </div>
          {info.map(i => (
            <InsightCard key={i.id} insight={i} onDismiss={handleDismiss} />
          ))}
        </section>
      )}

      {insights.length > 0 && (
        <p className="text-[11px] text-muted-foreground/60 text-center">
          Insights refresh daily at 07:45 UTC · Dismissed insights reappear after 7 days if the issue persists
        </p>
      )}
    </div>
  );
}

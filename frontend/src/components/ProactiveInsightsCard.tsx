"use client";

import { useEffect, useState } from "react";
import { Lightbulb, AlertTriangle, AlertCircle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DriftEvent {
  event_id: string;
  event_type: string;
  severity: string;
  ticker: string | null;
  name: string;
  value_pct: number | null;
  delta_pct: number | null;
  days_to_expiry: number | null;
}

interface Insight {
  event_id: string;
  insight: string;
  action: string;
}

interface InsightsData {
  has_alerts: boolean;
  drift_events: DriftEvent[];
  insights: Insight[];
  base_currency: string;
  total_portfolio_value: number;
}

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "danger") return <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />;
  return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />;
}

function EventBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    concentration: "Concentration",
    tier_drift: "Tier Drift",
    option_expiry: "Expiry",
    short_option_expiry: "Short Expiry",
  };
  const variants: Record<string, "warning" | "danger" | "muted"> = {
    concentration: "warning",
    tier_drift: "warning",
    option_expiry: "warning",
    short_option_expiry: "danger",
  };
  return (
    <Badge variant={variants[type] ?? "muted"} className="text-[10px]">
      {labels[type] ?? type}
    </Badge>
  );
}

export function ProactiveInsightsCard({ investorId }: { investorId: string }) {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const load = async (showSpin = false) => {
    if (!investorId) return;
    if (showSpin) setRefreshing(true);
    try {
      const r = await fetch(`/api/v1/investors/${investorId}/portfolio/insights`);
      if (r.ok) setData(await r.json());
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [investorId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Lightbulb className="h-4 w-4" /> Proactive Insights</CardTitle></CardHeader>
        <CardContent><div className="h-20 animate-pulse rounded bg-muted" /></CardContent>
      </Card>
    );
  }

  if (!data || !data.has_alerts) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-4 w-4 text-green-500" />
              Proactive Insights
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => load(true)} disabled={refreshing}>
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No drift or concentration issues detected. Your portfolio is within normal parameters.</p>
        </CardContent>
      </Card>
    );
  }

  const insightMap = Object.fromEntries(data.insights.map((i) => [i.event_id, i]));

  return (
    <Card className="border-amber-200 dark:border-amber-900">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Proactive Insights
            <Badge variant="warning" className="ml-1">{data.drift_events.length}</Badge>
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => load(true)} disabled={refreshing}>
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">AI-detected portfolio drift and risk events</p>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-3">
          {data.drift_events.map((event) => {
            const insight = insightMap[event.event_id];
            return (
              <div key={event.event_id} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <SeverityIcon severity={event.severity} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{event.name}</p>
                      <EventBadge type={event.event_type} />
                      {event.ticker && <span className="font-mono text-xs text-muted-foreground">{event.ticker}</span>}
                    </div>
                    {/* Quick stats */}
                    <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground">
                      {event.value_pct !== null && <span>{event.value_pct.toFixed(1)}% of portfolio</span>}
                      {event.delta_pct !== null && (
                        <span className={event.delta_pct > 0 ? "text-red-500" : "text-amber-500"}>
                          {event.delta_pct > 0 ? "+" : ""}{event.delta_pct.toFixed(1)}% vs target
                        </span>
                      )}
                      {event.days_to_expiry !== null && (
                        <span className={event.days_to_expiry <= 7 ? "text-red-500" : "text-amber-500"}>
                          Expires in {event.days_to_expiry}d
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {insight && (
                  <div className="ml-6 space-y-1.5">
                    <p className="text-sm text-muted-foreground leading-relaxed">{insight.insight}</p>
                    {insight.action && (
                      <div className="flex items-start gap-1.5 text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 rounded px-2.5 py-1.5">
                        <span className="font-medium shrink-0">Action:</span>
                        <span>{insight.action}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {data.insights.length === 0 && data.drift_events.length > 0 && (
            <p className="text-xs text-muted-foreground italic">AI narrative unavailable — configure ANTHROPIC_API_KEY for actionable suggestions.</p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

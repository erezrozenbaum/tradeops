"use client";

import { useEffect, useState } from "react";
import {
  Zap, AlertCircle, AlertTriangle, Info, TrendingUp, TrendingDown,
  ShoppingCart, Minus, Bell, PiggyBank, RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ActionItem {
  id: string;
  priority: number;
  category: string;
  action_type: string;
  title: string;
  reasoning: string;
  ticker: string | null;
  amount: number | null;
  units: number | null;
  unit_price: number | null;
  currency: string;
  source: string;
}

interface DailyActionFeed {
  investor_id: string;
  generated_at: string;
  summary: string;
  currency: string;
  urgent_count: number;
  high_count: number;
  medium_count: number;
  items: ActionItem[];
}

const ACTION_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  BUY:        { label: "BUY",        color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800", icon: <TrendingUp className="h-3 w-3" /> },
  SELL:       { label: "SELL",       color: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800", icon: <TrendingDown className="h-3 w-3" /> },
  REDUCE:     { label: "REDUCE",     color: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800", icon: <Minus className="h-3 w-3" /> },
  ACCUMULATE: { label: "ACCUMULATE", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800", icon: <ShoppingCart className="h-3 w-3" /> },
  WATCH:      { label: "WATCH",      color: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700", icon: <AlertTriangle className="h-3 w-3" /> },
  CONTRIBUTE: { label: "CONTRIBUTE", color: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800", icon: <PiggyBank className="h-3 w-3" /> },
  URGENT:     { label: "URGENT",     color: "bg-red-600/10 text-red-700 dark:text-red-400 border-red-300 dark:border-red-700", icon: <AlertCircle className="h-3 w-3" /> },
  ALERT:      { label: "ALERT",      color: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800", icon: <Bell className="h-3 w-3" /> },
  REVIEW:     { label: "REVIEW",     color: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800", icon: <Info className="h-3 w-3" /> },
};

function PriorityDot({ priority }: { priority: number }) {
  if (priority === 1) return <span className="h-2 w-2 rounded-full bg-red-500 shrink-0 mt-1.5" />;
  if (priority === 2) return <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0 mt-1.5" />;
  return <span className="h-2 w-2 rounded-full bg-blue-400 shrink-0 mt-1.5" />;
}

function ActionBadge({ type }: { type: string }) {
  const meta = ACTION_META[type] ?? ACTION_META["REVIEW"];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${meta.color}`}>
      {meta.icon}
      {meta.label}
    </span>
  );
}

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function DailyActionFeedCard({ investorId }: { investorId: string }) {
  const [feed, setFeed] = useState<DailyActionFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const load = async (spin = false) => {
    if (!investorId) return;
    if (spin) setRefreshing(true);
    try {
      const r = await fetch(`/api/v1/investors/${investorId}/action-feed`);
      if (r.ok) setFeed(await r.json());
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4" /> Today&apos;s Action Feed
          </CardTitle>
        </CardHeader>
        <CardContent><div className="h-20 animate-pulse rounded bg-muted" /></CardContent>
      </Card>
    );
  }

  if (!feed || feed.items.length === 0) {
    return (
      <Card className="border-emerald-200 dark:border-emerald-900">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4 text-emerald-500" /> Today&apos;s Action Feed
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => load(true)} disabled={refreshing}>
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {feed?.summary ?? "Portfolio looks healthy — no actions needed today."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const borderColor = feed.urgent_count > 0
    ? "border-red-200 dark:border-red-900"
    : feed.high_count > 0
    ? "border-amber-200 dark:border-amber-900"
    : "border-blue-200 dark:border-blue-900";

  const zapColor = feed.urgent_count > 0 ? "text-red-500" : feed.high_count > 0 ? "text-amber-500" : "text-blue-500";

  return (
    <Card className={borderColor}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className={`h-4 w-4 ${zapColor}`} />
              Today&apos;s Action Feed
            </CardTitle>
            {feed.urgent_count > 0 && (
              <Badge variant="danger" className="text-[10px]">{feed.urgent_count} urgent</Badge>
            )}
            {feed.high_count > 0 && (
              <Badge variant="warning" className="text-[10px]">{feed.high_count} high</Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => load(true)} disabled={refreshing}>
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">{feed.summary}</p>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-2">
          {feed.items.map((item) => (
            <div key={item.id} className="flex items-start gap-2.5 rounded-lg border border-border p-3">
              <PriorityDot priority={item.priority} />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{item.title}</span>
                  <ActionBadge type={item.action_type} />
                  {item.ticker && (
                    <span className="font-mono text-xs text-muted-foreground">{item.ticker}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.reasoning}</p>
                {(item.amount || item.units) && (
                  <div className="flex gap-3 text-xs font-medium mt-0.5">
                    {item.amount && (
                      <span className="text-foreground">
                        {fmt(item.amount, item.currency)}
                      </span>
                    )}
                    {item.units && (
                      <span className="text-muted-foreground">
                        {item.units.toFixed(2)} units
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

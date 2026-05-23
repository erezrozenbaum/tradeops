"use client";

import { useEffect, useState } from "react";
import {
  Clock, Wand2, Brain, BarChart2, ArrowUpDown, Filter,
  TrendingUp, TrendingDown, Minus
} from "lucide-react";
import { GlowCard } from "@/components/ui/glow-card";

interface TimelineEvent {
  event_id: string;
  event_type: string;
  occurred_at: string;
  title: string;
  description: string | null;
  amount: number | null;
  currency: string | null;
  ticker: string | null;
  metadata: Record<string, unknown>;
  causal_note: string | null;
}

interface TimelinePage {
  investor_id: string;
  events: TimelineEvent[];
  total: int;
  days: number;
  generated_at: string;
}

type int = number;

const EVENT_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  ai_recommendation: { icon: Wand2, color: "text-cyber-cyan", bg: "bg-cyber-cyan/10 border-cyber-cyan/20" },
  ai_recommendation_replay: { icon: Wand2, color: "text-cyber-purple", bg: "bg-cyber-purple/10 border-cyber-purple/20" },
  coach_insight: { icon: Brain, color: "text-cyber-green", bg: "bg-cyber-green/10 border-cyber-green/20" },
  rebalance: { icon: BarChart2, color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/20" },
  transaction: { icon: ArrowUpDown, color: "text-sky-400", bg: "bg-sky-400/10 border-sky-400/20" },
};

const DEFAULT_CONFIG = { icon: Clock, color: "text-muted-foreground", bg: "bg-muted/20 border-muted/30" };

const DAYS_OPTIONS = [7, 14, 30, 60, 90];

function groupByDate(events: TimelineEvent[]): Record<string, TimelineEvent[]> {
  const groups: Record<string, TimelineEvent[]> = {};
  for (const e of events) {
    const d = new Date(e.occurred_at).toLocaleDateString(undefined, {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    if (!groups[d]) groups[d] = [];
    groups[d].push(e);
  }
  return groups;
}

function EventCard({ event }: { event: TimelineEvent }) {
  const cfg = EVENT_CONFIG[event.event_type] ?? DEFAULT_CONFIG;
  const Icon = cfg.icon;

  const txType = event.metadata["transaction_type"] as string | undefined;
  const AmtIcon = txType === "buy" ? TrendingUp : txType === "sell" ? TrendingDown : Minus;
  const amtColor = txType === "buy" ? "text-cyber-green" : txType === "sell" ? "text-cyber-red" : "text-muted-foreground";

  return (
    <div className={`flex gap-3 p-3.5 rounded-lg border ${cfg.bg} transition-all hover:brightness-110`}>
      <div className={`mt-0.5 h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${cfg.bg}`}>
        <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="text-sm font-medium text-foreground truncate block">{event.title}</span>
            {event.ticker && (
              <span className="text-[10px] font-mono text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                {event.ticker}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {event.amount !== null && (
              <span className={`text-xs font-semibold flex items-center gap-0.5 ${amtColor}`}>
                <AmtIcon className="h-3 w-3" />
                {event.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })} {event.currency}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground/60">
              {new Date(event.occurred_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
        {event.description && (
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{event.description}</p>
        )}
        {event.causal_note && (
          <div className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-400/80 border-t border-amber-400/10 pt-2">
            <TrendingDown className="h-3 w-3 mt-0.5 shrink-0" />
            <span>{event.causal_note}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TimelinePage() {
  const [data, setData] = useState<TimelinePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    const id = localStorage.getItem("tradeops_investor_id");
    if (!id) { setError("No investor selected"); setLoading(false); return; }

    setLoading(true);
    fetch(`/api/v1/investors/${id}/timeline?days=${days}&limit=100`)
      .then(r => r.ok ? r.json() : r.json().then((e: { detail?: string }) => Promise.reject(e.detail || "Failed")))
      .then(setData)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [days]);

  const filtered = (data?.events ?? []).filter(e =>
    filter === "all" ? true : e.event_type === filter || (filter === "transaction" && e.event_type === "transaction")
  );

  const grouped = groupByDate(filtered);

  const filterOptions = [
    { key: "all", label: "All" },
    { key: "ai_recommendation", label: "AI Recs" },
    { key: "coach_insight", label: "Coach" },
    { key: "rebalance", label: "Rebalance" },
    { key: "transaction", label: "Transactions" },
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Clock className="h-5 w-5 text-cyber-cyan" />
          Financial Decision Timeline
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Unified chronological view of AI decisions, trades, and their downstream portfolio effects.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          {filterOptions.map(o => (
            <button
              key={o.key}
              onClick={() => setFilter(o.key)}
              className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                filter === o.key
                  ? "bg-cyber-cyan/10 text-cyber-cyan border-cyber-cyan/30"
                  : "text-muted-foreground border-cyber-rule/40 hover:border-cyber-cyan/20"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Last</span>
          {DAYS_OPTIONS.map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                days === d
                  ? "bg-cyber-cyan/10 text-cyber-cyan border-cyber-cyan/30"
                  : "text-muted-foreground border-cyber-rule/40 hover:border-cyber-cyan/20"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm animate-pulse">
          Loading timeline…
        </div>
      ) : error ? (
        <div className="p-4 text-cyber-red text-sm">{error}</div>
      ) : Object.keys(grouped).length === 0 ? (
        <GlowCard className="p-10 text-center text-muted-foreground text-sm">
          No events found in the last {days} days.
          {filter !== "all" && " Try clearing the filter."}
        </GlowCard>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([dateStr, events]) => (
            <div key={dateStr}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-cyber-rule/40" />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                  {dateStr}
                </span>
                <div className="h-px flex-1 bg-cyber-rule/40" />
              </div>
              <div className="space-y-2">
                {events.map(e => <EventCard key={e.event_id} event={e} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {data && (
        <p className="text-[11px] text-muted-foreground text-center">
          Showing {filtered.length} of {data.total} events · Generated {new Date(data.generated_at).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}

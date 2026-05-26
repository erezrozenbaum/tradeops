"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Clock, Wand2, Brain, BarChart2, ArrowUpDown, Filter,
  TrendingUp, TrendingDown, Minus, Sparkles, AlertTriangle,
  RefreshCw, Activity, GitBranch, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  LineChart, Line, ResponsiveContainer, Tooltip as RechartsTooltip,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { useInvestorId } from "@/hooks/useInvestorId";

// ─── Types ───────────────────────────────────────────────────────────────────

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
  events: TimelineEvent[];
  total: number;
  days: number;
  generated_at: string;
}

interface AIMemoryItem {
  id: string;
  summary_at: string;
  portfolio_assessment: string;
  key_metrics: {
    twin_score?: number;
    maturity_stage?: string;
    stability_score?: number;
    ef_months?: number;
    net_worth?: number;
  } | null;
}

interface TwinPoint {
  computed_at: string;
  overall_score: number;
}

interface MaturityPoint {
  computed_at: string;
  composite_score: number;
  stage: string;
}

interface NWPoint {
  snapshot_at: string;
  net_worth: number;
  currency?: string;
}

// ─── Event config ─────────────────────────────────────────────────────────────

const EVENT_CFG: Record<string, { icon: React.ElementType; color: string; dot: string; label: string }> = {
  ai_recommendation:        { icon: Wand2,          color: "text-cyan-400",   dot: "bg-cyan-400",   label: "AI Recommendation" },
  ai_recommendation_replay: { icon: GitBranch,      color: "text-purple-400", dot: "bg-purple-400", label: "Replay" },
  coach_insight:            { icon: Brain,           color: "text-emerald-400",dot: "bg-emerald-400",label: "Coach Insight" },
  rebalance:                { icon: BarChart2,       color: "text-amber-400",  dot: "bg-amber-400",  label: "Rebalance" },
  transaction:              { icon: ArrowUpDown,     color: "text-sky-400",    dot: "bg-sky-400",    label: "Transaction" },
  behavioral_risk:          { icon: AlertTriangle,   color: "text-red-400",    dot: "bg-red-400",    label: "Behavioral Risk" },
  portfolio_snapshot:       { icon: Activity,        color: "text-muted-foreground", dot: "bg-muted-foreground/60", label: "Snapshot" },
};
const DEFAULT_CFG = { icon: Clock, color: "text-muted-foreground", dot: "bg-muted-foreground/40", label: "Event" };

// ─── Score sparkline strip ────────────────────────────────────────────────────

function Sparkline({
  data, color, keyName,
}: { data: { v: number }[]; color: string; keyName: string }) {
  if (data.length < 2) {
    return <div className="h-10 flex items-center justify-center text-[10px] text-muted-foreground">No trend data</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={data}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
        <RechartsTooltip
          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
          formatter={(v: number) => [v.toFixed(1), keyName]}
          labelFormatter={() => ""}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ScoreStrip({
  twinHistory, maturityHistory, nwHistory,
}: { twinHistory: TwinPoint[]; maturityHistory: MaturityPoint[]; nwHistory: NWPoint[] }) {
  const twinData = twinHistory.map(p => ({ v: p.overall_score }));
  const matData  = maturityHistory.map(p => ({ v: p.composite_score }));
  const nwData   = nwHistory.map(p => ({ v: p.net_worth }));

  const latestTwin    = twinHistory.at(-1);
  const prevTwin      = twinHistory.at(-2);
  const twinDelta     = latestTwin && prevTwin ? latestTwin.overall_score - prevTwin.overall_score : null;

  const latestMat     = maturityHistory.at(-1);

  const latestNW      = nwHistory.at(-1);
  const prevNW        = nwHistory.at(-2);
  const nwDelta       = latestNW && prevNW ? latestNW.net_worth - prevNW.net_worth : null;

  const strips = [
    {
      label: "Twin Score",
      value: latestTwin ? latestTwin.overall_score.toFixed(1) : "—",
      delta: twinDelta,
      deltaFmt: twinDelta !== null ? `${twinDelta >= 0 ? "+" : ""}${twinDelta.toFixed(1)} pts` : null,
      data: twinData,
      color: "#22d3ee",
      keyName: "Twin Score",
    },
    {
      label: "Maturity Score",
      value: latestMat ? latestMat.composite_score.toFixed(1) : "—",
      sub: latestMat?.stage.replace(/_/g, " ") ?? "",
      data: matData,
      color: "#a78bfa",
      keyName: "Maturity",
    },
    {
      label: "Net Worth",
      value: latestNW ? formatCurrency(latestNW.net_worth, "USD") : "—",
      delta: nwDelta,
      deltaFmt: nwDelta !== null ? `${nwDelta >= 0 ? "+" : ""}${formatCurrency(Math.abs(nwDelta), "USD")}` : null,
      data: nwData,
      color: "#34d399",
      keyName: "Net Worth",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {strips.map((s) => (
        <div key={s.label} className="rounded-xl border border-border bg-card p-3 space-y-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{s.label}</p>
            {s.deltaFmt && (
              <span className={`text-[10px] font-semibold ${(s.delta ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {(s.delta ?? 0) >= 0 ? "▲" : "▼"} {s.deltaFmt}
              </span>
            )}
          </div>
          <p className="text-xl font-bold tracking-tight text-foreground">{s.value}</p>
          {s.sub && <p className="text-[10px] text-muted-foreground capitalize">{s.sub}</p>}
          <Sparkline data={s.data} color={s.color} keyName={s.keyName} />
        </div>
      ))}
    </div>
  );
}

// ─── Event card ───────────────────────────────────────────────────────────────

function EventCard({ event }: { event: TimelineEvent }) {
  const cfg = EVENT_CFG[event.event_type] ?? DEFAULT_CFG;
  const Icon = cfg.icon;
  const txType = event.metadata["transaction_type"] as string | undefined;
  const severity = event.metadata["severity"] as string | undefined;
  const isBehavioral = event.event_type === "behavioral_risk";
  const borderAccent = isBehavioral
    ? severity === "high" ? "border-l-2 border-l-red-500/60" : "border-l-2 border-l-amber-500/60"
    : "";

  return (
    <div className={`flex gap-3 group`}>
      {/* dot + stem */}
      <div className="flex flex-col items-center pt-1">
        <div className={`h-2 w-2 rounded-full shrink-0 mt-1 ${cfg.dot}`} />
        <div className="w-px flex-1 bg-border/40 mt-1" />
      </div>

      {/* content */}
      <div className={`flex-1 min-w-0 pb-4 rounded-lg bg-card border border-border/60 px-3.5 py-3 mb-1 ${borderAccent}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className={`h-3.5 w-3.5 shrink-0 ${cfg.color}`} />
            <span className="text-sm font-medium text-foreground truncate">{event.title}</span>
            {event.ticker && (
              <span className="font-mono text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
                {event.ticker}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {event.amount !== null && event.currency && (
              <span className={`text-xs font-semibold flex items-center gap-0.5 ${
                txType === "buy" ? "text-emerald-400" : txType === "sell" ? "text-red-400" : "text-muted-foreground"
              }`}>
                {txType === "buy" ? <TrendingUp className="h-3 w-3" /> : txType === "sell" ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                {event.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })} {event.currency}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground/60">
              {new Date(event.occurred_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
        {event.description && (
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{event.description}</p>
        )}
        {event.causal_note && (
          <div className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-400/80 border-t border-border/40 pt-2">
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
            <span>{event.causal_note}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AI memory card ───────────────────────────────────────────────────────────

function AIMemoryCard({ memory }: { memory: AIMemoryItem }) {
  const [expanded, setExpanded] = useState(false);
  const m = memory.key_metrics;
  const preview = memory.portfolio_assessment.slice(0, 220);
  const hasMore = memory.portfolio_assessment.length > 220;

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center pt-1">
        <div className="h-3 w-3 rounded-full shrink-0 mt-0.5 bg-primary ring-2 ring-primary/20" />
        <div className="w-px flex-1 bg-border/40 mt-1" />
      </div>
      <div className="flex-1 min-w-0 pb-4 rounded-xl bg-primary/5 border border-primary/20 px-4 py-3.5 mb-1">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-xs font-semibold text-primary">AI Financial Assessment</span>
          <span className="ml-auto text-[10px] text-muted-foreground">
            {new Date(memory.summary_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        {m && (
          <div className="flex flex-wrap gap-2 mb-2.5">
            {m.twin_score !== undefined && (
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
                Twin {m.twin_score.toFixed(1)}
              </span>
            )}
            {m.stability_score !== undefined && (
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                Stability {m.stability_score}
              </span>
            )}
            {m.ef_months !== undefined && (
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400">
                EF {m.ef_months.toFixed(1)} mo
              </span>
            )}
            {m.maturity_stage && (
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-400 capitalize">
                {m.maturity_stage.replace(/_/g, " ")}
              </span>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground leading-relaxed">
          {expanded ? memory.portfolio_assessment : preview}
          {hasMore && !expanded && "…"}
        </p>
        {hasMore && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="mt-1.5 flex items-center gap-1 text-[11px] text-primary hover:underline"
          >
            {expanded ? <><ChevronUp className="h-3 w-3" /> Show less</> : <><ChevronDown className="h-3 w-3" /> Read full assessment</>}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Unified event type ────────────────────────────────────────────────────────

type UEvent =
  | { kind: "timeline"; at: Date; data: TimelineEvent }
  | { kind: "memory";   at: Date; data: AIMemoryItem };

function groupByMonth(events: UEvent[]): [string, UEvent[]][] {
  const map = new Map<string, UEvent[]>();
  for (const e of events) {
    const key = e.at.toLocaleDateString(undefined, { year: "numeric", month: "long" });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return Array.from(map.entries());
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const MONTHS_OPTIONS: { label: string; value: number; days: number }[] = [
  { label: "1 mo",  value: 1,  days: 30  },
  { label: "3 mo",  value: 3,  days: 90  },
  { label: "6 mo",  value: 6,  days: 180 },
  { label: "1 yr",  value: 12, days: 365 },
];

const FILTER_OPTIONS = [
  { key: "all",             label: "All" },
  { key: "ai_recommendation", label: "AI Recs" },
  { key: "coach_insight",   label: "Coach" },
  { key: "rebalance",       label: "Rebalance" },
  { key: "transaction",     label: "Transactions" },
  { key: "behavioral_risk", label: "Behavioral" },
  { key: "ai_memory",       label: "Assessments" },
];

export default function TimelinePage() {
  const investorId = useInvestorId();
  const [timelineData, setTimelineData]   = useState<TimelinePage | null>(null);
  const [memories, setMemories]           = useState<AIMemoryItem[]>([]);
  const [twinHistory, setTwinHistory]     = useState<TwinPoint[]>([]);
  const [matHistory, setMatHistory]       = useState<MaturityPoint[]>([]);
  const [nwHistory, setNwHistory]         = useState<NWPoint[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [months, setMonths]               = useState(3);
  const [filter, setFilter]               = useState("all");

  function load(m: number) {
    if (!investorId) return;
    const days = MONTHS_OPTIONS.find(o => o.value === m)?.days ?? 90;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/v1/investors/${investorId}/timeline?days=${days}&limit=200`).then(r => r.ok ? r.json() : null),
      fetch(`/api/v1/investors/${investorId}/command-center/ai-memory?months=${m}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/v1/investors/${investorId}/command-center/score-history?months=${m}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/v1/investors/${investorId}/net-worth/history?months=${m}`).then(r => r.ok ? r.json() : null),
    ])
      .then(([tl, mem, scores, nw]) => {
        setTimelineData(tl ?? null);
        setMemories(mem?.items ?? []);
        setTwinHistory(scores?.twin_history ?? []);
        setMatHistory(scores?.maturity_history ?? []);
        setNwHistory(Array.isArray(nw) ? nw : []);
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(months); }, [investorId, months]);

  const unified = useMemo<UEvent[]>(() => {
    const events: UEvent[] = (timelineData?.events ?? []).map(e => ({
      kind: "timeline",
      at: new Date(e.occurred_at),
      data: e,
    }));
    const mems: UEvent[] = memories.map(m => ({
      kind: "memory",
      at: new Date(m.summary_at),
      data: m,
    }));
    return [...events, ...mems].sort((a, b) => b.at.getTime() - a.at.getTime());
  }, [timelineData, memories]);

  const filtered = useMemo(() => {
    if (filter === "all") return unified;
    if (filter === "ai_memory") return unified.filter(e => e.kind === "memory");
    return unified.filter(e => e.kind === "timeline" && e.data.event_type === filter);
  }, [unified, filter]);

  const groups = groupByMonth(filtered);

  const hasScoreData = twinHistory.length > 0 || matHistory.length > 0 || nwHistory.length > 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Your Financial Journey
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            A narrative record of decisions, insights, and how your financial health evolved.
          </p>
        </div>
        <button
          onClick={() => load(months)}
          disabled={loading}
          className="shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Score evolution strip */}
      {hasScoreData && (
        <ScoreStrip
          twinHistory={twinHistory}
          maturityHistory={matHistory}
          nwHistory={nwHistory}
        />
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground mr-1" />
          {FILTER_OPTIONS.map(o => (
            <button
              key={o.key}
              onClick={() => setFilter(o.key)}
              className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                filter === o.key
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "text-muted-foreground border-border/60 hover:border-primary/20"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          {MONTHS_OPTIONS.map(o => (
            <button
              key={o.value}
              onClick={() => setMonths(o.value)}
              className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                months === o.value
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "text-muted-foreground border-border/60 hover:border-primary/20"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          <RefreshCw className="h-4 w-4 animate-spin mr-2" />
          Loading your journey…
        </div>
      ) : error ? (
        <div className="p-4 text-red-400 text-sm">{error}</div>
      ) : groups.length === 0 ? (
        <Card>
          <div className="py-12 text-center space-y-2">
            <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto" />
            <p className="text-sm text-muted-foreground">No events in this period.</p>
            {filter !== "all" && (
              <button onClick={() => setFilter("all")} className="text-xs text-primary hover:underline">
                Clear filter
              </button>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-8">
          {groups.map(([month, events]) => (
            <div key={month}>
              {/* Month header */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                  {month}
                </span>
                <div className="h-px flex-1 bg-border/40" />
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {events.length} event{events.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Events */}
              <div>
                {events.map(e =>
                  e.kind === "memory" ? (
                    <AIMemoryCard key={`mem-${e.data.id}`} memory={e.data} />
                  ) : (
                    <EventCard key={e.data.event_id} event={e.data} />
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      {!loading && unified.length > 0 && (
        <p className="text-[11px] text-muted-foreground text-center pb-4">
          {filtered.length} events shown · {months} month{months !== 1 ? "s" : ""} of history
          {timelineData && ` · Updated ${new Date(timelineData.generated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
        </p>
      )}
    </div>
  );
}

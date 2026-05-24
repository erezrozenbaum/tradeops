"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Brain, ChevronDown, ChevronUp, Clock, Cpu } from "lucide-react";

interface KeyMetrics {
  twin_score?: number | null;
  maturity_stage?: string | null;
  stability_score?: number | null;
  ef_months?: number | null;
  net_worth?: number | null;
}

interface AIMemoryItem {
  id: string;
  summary_at: string;
  verbosity: string;
  portfolio_assessment: string;
  key_metrics: KeyMetrics | null;
}

interface AIMemoryResponse {
  items: AIMemoryItem[];
}

const STAGE_COLOR: Record<string, string> = {
  foundation: "text-amber-400",
  discipline: "text-cyber-blue",
  optimization: "text-emerald-400",
  advanced_cognition: "text-purple-400",
};

const STAGE_LABEL: Record<string, string> = {
  foundation: "Foundation",
  discipline: "Discipline",
  optimization: "Optimization",
  advanced_cognition: "Advanced Cognition",
};

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center bg-cyber-bg border border-cyber-border rounded-lg px-3 py-1.5 min-w-[80px]">
      <span className="text-[10px] text-cyber-muted uppercase tracking-wider">{label}</span>
      <span className="text-sm font-semibold text-cyber-text mt-0.5">{value}</span>
    </div>
  );
}

function MemoryCard({ item }: { item: AIMemoryItem }) {
  const [expanded, setExpanded] = useState(false);
  const m = item.key_metrics;
  const date = new Date(item.summary_at);
  const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const timeStr = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) + " UTC";

  const preview = item.portfolio_assessment.slice(0, 180).trim();
  const hasMore = item.portfolio_assessment.length > 180;

  return (
    <div className="bg-cyber-surface border border-cyber-border rounded-xl p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-cyber-blue flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-cyber-text text-sm">{dateStr}</p>
            <p className="text-xs text-cyber-muted">{timeStr} · {item.verbosity}</p>
          </div>
        </div>
        {m?.maturity_stage && (
          <span className={`text-xs font-medium ${STAGE_COLOR[m.maturity_stage] ?? "text-cyber-muted"}`}>
            {STAGE_LABEL[m.maturity_stage] ?? m.maturity_stage}
          </span>
        )}
      </div>

      {/* Key metrics */}
      {m && (
        <div className="flex flex-wrap gap-2">
          {m.twin_score != null && (
            <MetricPill label="Twin Score" value={m.twin_score.toFixed(1)} />
          )}
          {m.stability_score != null && (
            <MetricPill label="Stability" value={`${m.stability_score.toFixed(0)}/100`} />
          )}
          {m.ef_months != null && (
            <MetricPill label="EF Months" value={m.ef_months.toFixed(1)} />
          )}
          {m.net_worth != null && (
            <MetricPill
              label="Net Worth"
              value={new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(m.net_worth)}
            />
          )}
        </div>
      )}

      {/* Assessment */}
      <div className="text-sm text-cyber-text/90 leading-relaxed">
        {expanded ? item.portfolio_assessment : preview}
        {hasMore && !expanded && <span className="text-cyber-muted">…</span>}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1 text-xs text-cyber-blue hover:text-cyber-blue/80 transition-colors self-start"
        >
          {expanded ? <><ChevronUp size={13} /> Show less</> : <><ChevronDown size={13} /> Read more</>}
        </button>
      )}
    </div>
  );
}

export default function AIHistoryPage() {
  const investorId = useInvestorId();
  const [data, setData] = useState<AIMemoryResponse | null>(null);
  const [months, setMonths] = useState(3);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!investorId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/v1/investors/${investorId}/command-center/ai-memory?months=${months}`, {
      credentials: "include",
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [investorId, months]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-cyber-text flex items-center gap-2">
            <Cpu size={22} className="text-cyber-blue" />
            AI Memory Timeline
          </h1>
          <p className="text-cyber-muted text-sm mt-1">
            Your rolling AI assessment history — how your financial picture was read at each point in time
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Clock size={14} className="text-cyber-muted" />
          <span className="text-xs text-cyber-muted">Window:</span>
          {([1, 3, 6, 12] as const).map(m => (
            <button
              key={m}
              onClick={() => setMonths(m)}
              className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                months === m
                  ? "bg-cyber-blue/10 border-cyber-blue text-cyber-blue"
                  : "border-cyber-border text-cyber-muted hover:text-cyber-text"
              }`}
            >
              {m}mo
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex flex-col gap-3 animate-pulse">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-36 rounded-xl bg-cyber-surface/60" />
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400">{error}</div>
      )}

      {!loading && !error && data?.items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Brain size={36} className="text-cyber-muted mb-4" />
          <p className="font-semibold text-cyber-text">No AI assessments yet</p>
          <p className="text-sm text-cyber-muted mt-1 max-w-xs">
            Visit the Command Center to generate your first AI report. It will be stored here as part of your financial memory.
          </p>
        </div>
      )}

      {!loading && !error && data && data.items.length > 0 && (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-cyber-muted">{data.items.length} assessment{data.items.length !== 1 ? "s" : ""} in the last {months} month{months !== 1 ? "s" : ""}</p>
          {data.items.map(item => (
            <MemoryCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

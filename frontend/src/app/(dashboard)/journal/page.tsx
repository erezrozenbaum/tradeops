"use client";

import { useEffect, useState, useCallback } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import {
  BookOpen, TrendingUp, TrendingDown, CheckCircle2, AlertTriangle,
  Info, Pencil, RefreshCw, X, Check,
} from "lucide-react";
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

interface JournalEntry {
  id: string;
  ticker: string | null;
  name: string;
  action: "buy" | "sell";
  quantity: number;
  unit_price: number;
  currency: string;
  estimated_value: number;
  asset_type: string | null;
  status: "pending" | "executed" | "cancelled";
  goal_name: string | null;
  pre_flight_verdict: "proceed" | "caution" | "reconsider" | null;
  rationale: string | null;
  reflection: {
    preflight_verdict: string;
    preflight_risks: string[];
    had_rationale: boolean;
    note: string;
    reflected_at: string;
  } | null;
  executed_at: string | null;
  created_at: string;
}

function VerdictBadge({ verdict }: { verdict: string | null }) {
  if (!verdict) return null;
  const map: Record<string, { label: string; className: string }> = {
    proceed:    { label: "Proceed",    className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
    caution:    { label: "Caution",    className: "bg-amber-500/15 text-amber-400 border-amber-500/25" },
    reconsider: { label: "Reconsider", className: "bg-rose-500/15 text-rose-400 border-rose-500/25" },
  };
  const cfg = map[verdict] ?? { label: verdict, className: "bg-muted text-muted-foreground border-border" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:   "bg-blue-500/15 text-blue-400 border-blue-500/25",
    executed:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    cancelled: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${map[status] ?? "bg-muted text-muted-foreground border-border"}`}>
      {status}
    </span>
  );
}

export default function JournalPage() {
  const investorId = useInvestorId();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "with_rationale" | "without_rationale">("all");

  const fetch = useCallback(async () => {
    if (!investorId) return;
    setLoading(true);
    try {
      const data = await apiFetch<JournalEntry[]>(`/investors/${investorId}/staged-orders/journal`);
      setEntries(Array.isArray(data) ? data : []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [investorId]);

  useEffect(() => { fetch(); }, [fetch]);

  const saveRationale = async (id: string) => {
    if (!investorId) return;
    setSaving(true);
    try {
      await apiFetch(`/investors/${investorId}/staged-orders/${id}/rationale`, {
        method: "PATCH",
        body: JSON.stringify({ rationale: editValue.trim() }),
      });
      setEditingId(null);
      setEditValue("");
      await fetch();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const stats = {
    total: entries.length,
    withRationale: entries.filter(e => e.rationale).length,
    executed: entries.filter(e => e.status === "executed").length,
    avgVerdicts: {
      proceed:    entries.filter(e => e.pre_flight_verdict === "proceed").length,
      caution:    entries.filter(e => e.pre_flight_verdict === "caution").length,
      reconsider: entries.filter(e => e.pre_flight_verdict === "reconsider").length,
    },
  };

  const filtered = entries.filter(e => {
    if (filter === "with_rationale") return !!e.rationale;
    if (filter === "without_rationale") return !e.rationale;
    return true;
  });

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Trade Journal
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Decision rationale and post-execution reflection for every staged order.
          </p>
        </div>
        <button onClick={fetch} className="p-2 text-muted-foreground hover:text-foreground transition-colors" title="Refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Stats bar */}
      {!loading && entries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total orders", value: stats.total, color: "text-foreground" },
            { label: "With rationale", value: `${stats.withRationale} / ${stats.total}`, color: stats.withRationale < stats.total ? "text-amber-400" : "text-emerald-400" },
            { label: "Executed", value: stats.executed, color: "text-emerald-400" },
            { label: "Caution / Reconsider", value: stats.avgVerdicts.caution + stats.avgVerdicts.reconsider, color: stats.avgVerdicts.caution + stats.avgVerdicts.reconsider > 0 ? "text-amber-400" : "text-muted-foreground" },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-3">
                <div className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filter */}
      {!loading && entries.length > 0 && (
        <div className="flex gap-1">
          {(["all", "with_rationale", "without_rationale"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors border ${
                filter === f
                  ? "bg-primary/15 text-primary border-primary/25"
                  : "text-muted-foreground border-border hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {f === "all" ? "All" : f === "with_rationale" ? "With rationale" : "Missing rationale"}
            </button>
          ))}
        </div>
      )}

      {/* Entries */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <RefreshCw className="w-4 h-4 animate-spin" /> Loading journal…
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <BookOpen className="w-8 h-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">
              {filter !== "all"
                ? "No entries match this filter."
                : "No staged orders yet. Stage your first order in Order Builder — add a rationale to start your journal."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(entry => (
            <Card key={entry.id} className={`transition-colors ${!entry.rationale ? "border-amber-500/20" : ""}`}>
              <CardContent className="p-4 space-y-3">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className={`flex items-center gap-1.5 text-sm font-semibold ${entry.action === "buy" ? "text-emerald-400" : "text-rose-400"}`}>
                      {entry.action === "buy"
                        ? <TrendingUp className="w-3.5 h-3.5" />
                        : <TrendingDown className="w-3.5 h-3.5" />}
                      {entry.action.toUpperCase()}
                    </div>
                    <span className="font-semibold text-foreground">{entry.ticker ?? entry.name}</span>
                    {entry.ticker && entry.name !== entry.ticker && (
                      <span className="text-xs text-muted-foreground">{entry.name}</span>
                    )}
                    <StatusBadge status={entry.status} />
                    <VerdictBadge verdict={entry.pre_flight_verdict} />
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>{formatCurrency(entry.estimated_value, entry.currency)}</div>
                    <div className="mt-0.5">{new Date(entry.created_at).toLocaleDateString()}</div>
                  </div>
                </div>

                {/* Rationale */}
                {editingId === entry.id ? (
                  <div className="space-y-2">
                    <textarea
                      autoFocus
                      rows={3}
                      className="w-full px-3 py-2 rounded bg-background border border-border text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 resize-none"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      maxLength={2000}
                      placeholder="Why did you make this trade?"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveRationale(entry.id)}
                        disabled={saving || !editValue.trim()}
                        className="flex items-center gap-1 px-3 py-1.5 rounded text-xs bg-primary/15 text-primary border border-primary/25 hover:bg-primary/25 disabled:opacity-50 transition-colors"
                      >
                        <Check className="w-3 h-3" /> Save
                      </button>
                      <button
                        onClick={() => { setEditingId(null); setEditValue(""); }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded text-xs text-muted-foreground border border-border hover:bg-muted/50 transition-colors"
                      >
                        <X className="w-3 h-3" /> Cancel
                      </button>
                    </div>
                  </div>
                ) : entry.rationale ? (
                  <div className="bg-muted/40 rounded-lg px-3 py-2.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <BookOpen className="w-3 h-3" /> Rationale
                      </span>
                      {entry.status === "pending" && (
                        <button
                          onClick={() => { setEditingId(entry.id); setEditValue(entry.rationale ?? ""); }}
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-foreground/90 leading-relaxed">{entry.rationale}</p>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditingId(entry.id); setEditValue(""); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-amber-500/30 text-xs text-amber-500/70 hover:text-amber-400 hover:border-amber-500/50 hover:bg-amber-500/5 transition-colors"
                  >
                    <Info className="w-3 h-3 shrink-0" />
                    No rationale captured — add why you made this trade
                  </button>
                )}

                {/* Reflection (post-execution) */}
                {entry.reflection && (
                  <div className={`rounded-lg px-3 py-2.5 space-y-1 border ${
                    entry.reflection.had_rationale
                      ? "bg-emerald-500/5 border-emerald-500/15"
                      : "bg-amber-500/5 border-amber-500/15"
                  }`}>
                    <div className="flex items-center gap-1.5">
                      {entry.reflection.had_rationale
                        ? <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        : <AlertTriangle className="w-3 h-3 text-amber-400" />}
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Reflection</span>
                      {entry.executed_at && (
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          Executed {new Date(entry.executed_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{entry.reflection.note}</p>
                    {entry.reflection.preflight_risks.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {entry.reflection.preflight_risks.map(r => (
                          <span key={r} className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded px-1.5 py-0.5">{r}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Goal link */}
                {entry.goal_name && (
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <span className="opacity-50">→</span> Linked to goal: <strong className="text-foreground">{entry.goal_name}</strong>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

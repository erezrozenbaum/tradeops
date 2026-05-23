"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, RefreshCw, AlertCircle, CheckCircle2, ShieldAlert, ScanSearch,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RiskEvent {
  id: string;
  event_type: string;
  event_label: string;
  severity: string;
  status: string;
  detected_at: string;
  resolved_at: string | null;
  description: string;
  evidence: Record<string, unknown>;
  recommendation: string;
}

interface RiskListResponse {
  investor_id: string;
  events: RiskEvent[];
  active_count: number;
  resolved_count: number;
  generated_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_BADGE: Record<string, { variant: "danger" | "warning" | "muted" | "success"; label: string }> = {
  critical: { variant: "danger", label: "Critical" },
  high:     { variant: "danger", label: "High" },
  medium:   { variant: "warning", label: "Medium" },
  low:      { variant: "muted", label: "Low" },
};

const STATUS_BADGE: Record<string, { variant: "success" | "muted"; label: string }> = {
  resolved:     { variant: "success", label: "Resolved" },
  acknowledged: { variant: "muted", label: "Acknowledged" },
};

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({ event, onResolve }: { event: RiskEvent; onResolve: (id: string) => void }) {
  const [resolving, setResolving] = useState(false);
  const sev = SEVERITY_BADGE[event.severity] ?? { variant: "muted" as const, label: event.severity };
  const isActive = event.status === "active";

  async function handleResolve() {
    setResolving(true);
    onResolve(event.id);
  }

  return (
    <div className={`p-4 rounded-lg border ${isActive ? "border-border bg-card" : "border-border/50 bg-muted/10"} space-y-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <ShieldAlert className={`h-4 w-4 shrink-0 mt-0.5 ${
            event.severity === "high" || event.severity === "critical" ? "text-red-400" :
            event.severity === "medium" ? "text-yellow-400" : "text-muted-foreground"
          }`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{event.event_label}</span>
              <Badge variant={sev.variant}>{sev.label}</Badge>
              {!isActive && STATUS_BADGE[event.status] && (
                <Badge variant={STATUS_BADGE[event.status].variant}>
                  {STATUS_BADGE[event.status].label}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Detected {new Date(event.detected_at).toLocaleDateString()}
              {event.resolved_at && ` · Resolved ${new Date(event.resolved_at).toLocaleDateString()}`}
            </p>
          </div>
        </div>
        {isActive && (
          <Button variant="outline" size="sm" onClick={handleResolve} disabled={resolving} className="shrink-0">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Resolve
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">{event.description}</p>

      {/* Evidence */}
      {Object.keys(event.evidence).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries(event.evidence).map(([k, v]) => {
            if (Array.isArray(v) || typeof v === "object") return null;
            const label = k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
            return (
              <div key={k} className="bg-muted/20 rounded px-2.5 py-1.5 text-xs">
                <span className="text-muted-foreground">{label}: </span>
                <span className="font-medium tabular-nums">{String(v)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Recommendation */}
      <div className="flex items-start gap-2 p-3 rounded-md bg-primary/5 border border-primary/10">
        <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
        <p className="text-xs text-muted-foreground leading-relaxed">{event.recommendation}</p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type TabKey = "active" | "resolved" | "all";

export default function BehavioralRiskPage() {
  const investorId = useInvestorId();
  const [data, setData] = useState<RiskListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("active");

  async function load() {
    if (!investorId) return;
    try {
      const res = await fetch(`/api/v1/investors/${investorId}/behavioral-risk`);
      if (!res.ok) throw new Error("Failed to load behavioral risk events");
      setData(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function runScan() {
    if (!investorId) return;
    setScanning(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/investors/${investorId}/behavioral-risk/detect`, { method: "POST" });
      if (!res.ok) throw new Error("Scan failed");
      setData(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  async function resolveEvent(eventId: string) {
    if (!investorId) return;
    try {
      await fetch(`/api/v1/investors/${investorId}/behavioral-risk/${eventId}/resolve`, { method: "POST" });
      await load();
    } catch {
      // silent — UI already disabled the button
    }
  }

  useEffect(() => { load(); }, [investorId]);

  if (!investorId || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const allEvents = data?.events ?? [];
  const displayed = tab === "active"
    ? allEvents.filter(e => e.status === "active")
    : tab === "resolved"
    ? allEvents.filter(e => e.status !== "active")
    : allEvents;

  const TABS: { key: TabKey; label: string; count: number }[] = [
    { key: "active", label: "Active", count: data?.active_count ?? 0 },
    { key: "resolved", label: "Resolved", count: data?.resolved_count ?? 0 },
    { key: "all", label: "All", count: allEvents.length },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-yellow-400" />
            Behavioral Risk Warnings
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Deterministic detection of high-risk behavioral patterns — updated daily.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={runScan} disabled={scanning}>
          <ScanSearch className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} />
          {scanning ? "Scanning…" : "Run Scan"}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-500 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Summary stats */}
      {data && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Active Warnings", value: data.active_count, color: data.active_count > 0 ? "text-red-400" : "text-green-400" },
            { label: "Resolved", value: data.resolved_count, color: "text-muted-foreground" },
            { label: "Total Detected", value: allEvents.length, color: "text-muted-foreground" },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="pt-4 pb-3 text-center">
                <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${
              tab === t.key
                ? "text-foreground border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label} {t.count > 0 && <span className="ml-1 opacity-60">({t.count})</span>}
          </button>
        ))}
      </div>

      {/* Events list */}
      {displayed.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-400 opacity-60" />
            <div>
              <p className="text-sm font-medium">
                {tab === "active" ? "No active risk warnings" : "No events in this category"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {tab === "active"
                  ? "Run a scan to check for the latest behavioral patterns."
                  : "Events will appear here once detected."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {displayed.map(e => (
            <EventCard key={e.id} event={e} onResolve={resolveEvent} />
          ))}
        </div>
      )}
    </div>
  );
}

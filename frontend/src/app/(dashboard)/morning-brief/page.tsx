"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import {
  Sun, TrendingUp, TrendingDown, Target, Bell, CalendarClock,
  AlertTriangle, RefreshCw, CheckCircle2, WifiOff, BookOpen,
  ShieldAlert, TrendingDown as StopIcon,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PortfolioSummary {
  value: number;
  currency: string;
  overnight_delta: number | null;
  overnight_delta_pct: number | null;
  snapshot_at: string;
  pnl: number;
  pnl_pct: number;
}

interface GoalsSummary {
  total: number;
  on_track: number;
  at_risk: number;
  monthly_needed: number;
}

interface TriggeredAlert {
  ticker: string;
  alert_type: string;
  target_price: number;
  triggered_price: number | null;
  currency: string;
  triggered_at: string;
}

interface NextPlan {
  id: string;
  name: string;
  frequency: string;
  next_run_at: string | null;
}

interface BehavioralEvent {
  event_type: string;
  severity: string;
  description: string;
  recommendation: string;
  detected_at: string;
}

interface BrokerSyncWarning {
  account_name: string;
  provider: string | null;
  sync_status: "stale" | "outdated";
  last_synced_at: string | null;
}

interface ThesisAlert {
  order_id: string;
  ticker: string | null;
  name: string;
  status: "RISK_BREACHED" | "TAKE_PROFIT_REACHED" | "TIMELINE_EXPIRED" | "INSUFFICIENT_DATA";
  insight: string;
  days_held: number;
  entry_price: number;
  current_price: number | null;
  currency: string;
  executed_at: string;
  thesis_params: {
    horizon_days?: number;
    stop_loss_pct?: number;
    take_profit_pct?: number;
  };
}

interface MorningBrief {
  generated_at: string;
  portfolio: PortfolioSummary | null;
  goals: GoalsSummary | null;
  triggered_alerts: TriggeredAlert[];
  next_plan: NextPlan | null;
  behavioral_events: BehavioralEvent[];
  broker_sync_warnings: BrokerSyncWarning[];
  thesis_alerts: ThesisAlert[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function severityColor(s: string) {
  if (s === "high") return "text-red-500 bg-red-500/10 border-red-500/20";
  if (s === "medium") return "text-amber-500 bg-amber-500/10 border-amber-500/20";
  return "text-blue-500 bg-blue-500/10 border-blue-500/20";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function MorningBriefPage() {
  const investorId = useInvestorId();
  const [brief, setBrief] = useState<MorningBrief | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!investorId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/v1/investors/${investorId}/morning-brief`);
      if (r.ok) setBrief(await r.json());
    } finally {
      setLoading(false);
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

  const p = brief?.portfolio;
  const g = brief?.goals;
  const currency = p?.currency ?? "USD";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl space-y-5 lg:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Sun className="h-5 w-5 text-amber-400" />
            Morning Brief
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {brief ? `Generated ${fmtDate(brief.generated_at)}` : "Your financial snapshot"}
          </p>
        </div>
        <button
          onClick={load}
          className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Portfolio */}
      <Card>
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          {p?.overnight_delta != null && p.overnight_delta >= 0
            ? <TrendingUp className="h-4 w-4 text-green-500" />
            : <TrendingDown className="h-4 w-4 text-red-500" />}
          <p className="text-sm font-medium">Portfolio</p>
        </div>
        <CardContent className="p-5">
          {p ? (
            <div className="space-y-3">
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-3xl font-bold tabular-nums">
                  {formatCurrency(p.value, currency)}
                </span>
                {p.overnight_delta != null && (
                  <span className={`text-sm font-medium ${p.overnight_delta >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {p.overnight_delta >= 0 ? "+" : ""}
                    {formatCurrency(p.overnight_delta, currency)}
                    {p.overnight_delta_pct != null && ` (${p.overnight_delta_pct >= 0 ? "+" : ""}${p.overnight_delta_pct.toFixed(2)}%)`}
                  </span>
                )}
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>
                  Unrealized P&L:{" "}
                  <span className={`font-medium ${p.pnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {p.pnl >= 0 ? "+" : ""}{formatCurrency(p.pnl, currency)} ({p.pnl_pct.toFixed(2)}%)
                  </span>
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No portfolio snapshot available yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Goals health */}
      <Card>
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium">Goals Health</p>
        </div>
        <CardContent className="p-5">
          {g ? (
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{g.total}</p>
                <p className="text-xs text-muted-foreground mt-1">Total goals</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-500">{g.on_track}</p>
                <p className="text-xs text-muted-foreground mt-1">On track</p>
              </div>
              <div>
                <p className={`text-2xl font-bold ${g.at_risk > 0 ? "text-red-500" : "text-muted-foreground"}`}>
                  {g.at_risk}
                </p>
                <p className="text-xs text-muted-foreground mt-1">At risk</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No goals configured yet.</p>
          )}
          {g && g.monthly_needed > 0 && (
            <p className="text-xs text-muted-foreground border-t border-border mt-4 pt-3">
              Monthly contribution needed across all goals:{" "}
              <span className="font-medium text-foreground">
                {formatCurrency(g.monthly_needed, currency)}
              </span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Triggered alerts */}
      {brief && brief.triggered_alerts.length > 0 && (
        <Card>
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-500" />
            <p className="text-sm font-medium">Triggered Price Alerts</p>
            <span className="ml-auto text-xs text-muted-foreground">{brief.triggered_alerts.length} alert{brief.triggered_alerts.length > 1 ? "s" : ""}</span>
          </div>
          <div className="divide-y divide-border">
            {brief.triggered_alerts.map((a, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <span className="font-mono font-semibold text-sm">{a.ticker}</span>
                  <span className={`ml-2 text-xs ${a.alert_type === "above" ? "text-green-500" : "text-red-500"}`}>
                    {a.alert_type === "above" ? "▲ Above" : "▼ Below"} {a.currency} {a.target_price.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{fmtDate(a.triggered_at)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Next plan */}
      {brief?.next_plan && (
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <CalendarClock className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-medium">Next Recurring Plan</p>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{brief.next_plan.name}</span>
                {" "}({brief.next_plan.frequency})
                {brief.next_plan.next_run_at && (
                  <> — runs {fmtDate(brief.next_plan.next_run_at)}</>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Broker sync warnings */}
      {brief && brief.broker_sync_warnings && brief.broker_sync_warnings.length > 0 && (
        <Card>
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <WifiOff className="h-4 w-4 text-amber-500" />
            <p className="text-sm font-medium">Broker Sync Warnings</p>
            <span className="ml-auto text-xs text-muted-foreground">
              {brief.broker_sync_warnings.length} account{brief.broker_sync_warnings.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="divide-y divide-border">
            {brief.broker_sync_warnings.map((w, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-sm font-medium truncate block">{w.account_name}</span>
                  {w.provider && (
                    <span className="text-xs text-muted-foreground">{w.provider}</span>
                  )}
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase border ${
                    w.sync_status === "outdated"
                      ? "text-red-500 bg-red-500/10 border-red-500/20"
                      : "text-amber-500 bg-amber-500/10 border-amber-500/20"
                  }`}>
                    {w.sync_status}
                  </span>
                  {w.last_synced_at && (
                    <span className="text-[10px] text-muted-foreground">
                      Last: {fmtDate(w.last_synced_at)}
                    </span>
                  )}
                  {!w.last_synced_at && (
                    <span className="text-[10px] text-muted-foreground">Never synced</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 py-3 border-t border-border bg-muted/30">
            <p className="text-xs text-muted-foreground">
              Sync your accounts before staging new orders to ensure portfolio data is current.
            </p>
          </div>
        </Card>
      )}

      {/* Thesis expiry alerts */}
      {brief && brief.thesis_alerts && brief.thesis_alerts.length > 0 && (
        <Card>
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-rose-500" />
            <p className="text-sm font-medium">Thesis Expiry Alerts</p>
            <span className="ml-auto text-xs text-muted-foreground">
              {brief.thesis_alerts.length} alert{brief.thesis_alerts.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="divide-y divide-border">
            {brief.thesis_alerts.map((a, i) => {
              const isRisk = a.status === "RISK_BREACHED";
              const isProfit = a.status === "TAKE_PROFIT_REACHED";
              const isExpired = a.status === "TIMELINE_EXPIRED";
              const statusColor = isRisk
                ? "text-red-500 bg-red-500/10 border-red-500/20"
                : isProfit
                ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                : isExpired
                ? "text-amber-500 bg-amber-500/10 border-amber-500/20"
                : "text-muted-foreground bg-muted/10 border-border";
              const statusLabel = isRisk
                ? "Stop-Loss Breached"
                : isProfit
                ? "Take-Profit Reached"
                : isExpired
                ? "Horizon Expired"
                : "Insufficient Data";
              return (
                <div key={i} className="px-5 py-3 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase border ${statusColor}`}>
                      {statusLabel}
                    </span>
                    {a.ticker && (
                      <span className="text-sm font-mono font-semibold">{a.ticker}</span>
                    )}
                    <span className="text-sm text-muted-foreground">{a.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{a.days_held}d held</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{a.insight}</p>
                  <div className="flex gap-3 text-[11px] text-muted-foreground/70 flex-wrap">
                    <span>Entry: {a.currency} {a.entry_price.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                    {a.current_price != null && (
                      <span className={a.current_price >= a.entry_price ? "text-emerald-400" : "text-red-400"}>
                        Now: {a.currency} {a.current_price.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        {" "}({a.current_price >= a.entry_price ? "+" : ""}{((a.current_price - a.entry_price) / a.entry_price * 100).toFixed(1)}%)
                      </span>
                    )}
                    {a.thesis_params.horizon_days && (
                      <span>Target: {a.thesis_params.horizon_days}d</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-5 py-3 border-t border-border bg-muted/30">
            <p className="text-xs text-muted-foreground">
              These positions have breached their documented thesis parameters. Review each position and either execute the original exit strategy or document an updated rationale.
            </p>
          </div>
        </Card>
      )}

      {/* Behavioral risk events */}
      {brief && brief.behavioral_events.length > 0 && (
        <Card>
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <p className="text-sm font-medium">Active Behavioral Signals</p>
          </div>
          <div className="divide-y divide-border">
            {brief.behavioral_events.map((e, i) => (
              <div key={i} className="px-5 py-3 space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase border ${severityColor(e.severity)}`}>
                    {e.severity}
                  </span>
                  <span className="text-xs font-medium">{e.event_type.replace(/_/g, " ")}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{fmtDate(e.detected_at)}</span>
                </div>
                <p className="text-xs text-muted-foreground">{e.description}</p>
                <p className="text-xs text-foreground/80 italic">{e.recommendation}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* All clear */}
      {brief && !p && !g && brief.triggered_alerts.length === 0 && brief.behavioral_events.length === 0 && (brief.broker_sync_warnings ?? []).length === 0 && (brief.thesis_alerts ?? []).length === 0 && (
        <Card>
          <CardContent className="py-14 text-center">
            <CheckCircle2 className="h-10 w-10 mx-auto text-green-500/40 mb-3" />
            <p className="font-medium">All clear</p>
            <p className="text-sm text-muted-foreground mt-1">No alerts, no risk events. Set up your profile and goals to see a full brief.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

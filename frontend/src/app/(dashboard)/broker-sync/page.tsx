"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  Clock,
  Database,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";

interface AccountStatus {
  id: string;
  name: string;
  provider: string | null;
  account_type: string | null;
  currency: string | null;
  auto_sync_enabled: boolean;
  sync_broker_type: string | null;
  last_synced_at: string | null;
  holding_count: number;
  sync_status: "fresh" | "stale" | "outdated" | "never";
}

interface DriftRow {
  ticker: string | null;
  name: string | null;
  staged_action: string;
  staged_value: number | null;
  staged_currency: string | null;
  current_holding_qty: number | null;
  current_holding_value: number | null;
  order_id: string;
  created_at: string | null;
}

interface SyncStatusData {
  accounts: AccountStatus[];
  pending_order_drift: DriftRow[];
  total_pending_orders: number;
  last_price_refresh: string | null;
}

const STATUS_CONFIG = {
  fresh: {
    label: "Fresh",
    className: "bg-green-500/10 text-green-600 border-green-200",
    dot: "bg-green-500",
  },
  stale: {
    label: "Stale",
    className: "bg-amber-500/10 text-amber-600 border-amber-200",
    dot: "bg-amber-400",
  },
  outdated: {
    label: "Outdated",
    className: "bg-red-500/10 text-red-600 border-red-200",
    dot: "bg-red-500",
  },
  never: {
    label: "Never synced",
    className: "bg-zinc-500/10 text-zinc-400 border-zinc-700",
    dot: "bg-zinc-500",
  },
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtMoney(val: number | null, currency: string | null) {
  if (val == null) return "—";
  return `${currency ?? ""} ${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function ActionIcon({ action }: { action: string }) {
  const a = action?.toLowerCase();
  if (a === "buy") return <TrendingUp className="h-3.5 w-3.5 text-green-500" />;
  if (a === "sell") return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

export default function BrokerSyncPage() {
  const investorId = useInvestorId();
  const [data, setData] = useState<SyncStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!investorId) return;
    setLoading(true);
    fetch(`/api/v1/investors/${investorId}/broker-sync/status`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => { setData(d); setError(null); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [investorId]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Broker Sync Status</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Account sync health, pending order drift, and price refresh status
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm border border-cyber-rule/60 text-muted-foreground hover:text-foreground hover:bg-cyber-rule/40 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {loading && !data && (
        <div className="flex items-center gap-2 text-muted-foreground py-10 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading sync status…</span>
        </div>
      )}

      {error && (
        <Card className="border-red-500/30">
          <CardContent className="py-6 text-center text-sm text-red-500">
            Failed to load sync status: {error}
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          {/* Meta row */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Last price refresh: <span className="text-foreground">{fmtDate(data.last_price_refresh)}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5" />
              {data.accounts.length} account{data.accounts.length !== 1 ? "s" : ""}
            </span>
            {data.total_pending_orders > 0 && (
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-amber-500">{data.total_pending_orders} pending order{data.total_pending_orders !== 1 ? "s" : ""}</span>
              </span>
            )}
          </div>

          {/* Account cards */}
          {data.accounts.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
                No accounts found. Add an account and sync it to see status here.
              </CardContent>
            </Card>
          ) : (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Accounts</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.accounts.map(acc => {
                  const sc = STATUS_CONFIG[acc.sync_status] ?? STATUS_CONFIG.never;
                  return (
                    <Card key={acc.id} className="hover:border-cyber-cyan/20 transition-colors">
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{acc.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {acc.provider ?? acc.account_type ?? "Unknown"}{acc.currency ? ` · ${acc.currency}` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 ml-2 shrink-0">
                            <div className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                            <Badge className={`text-[10px] px-1.5 py-0 border ${sc.className}`}>
                              {sc.label}
                            </Badge>
                          </div>
                        </div>

                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div className="flex justify-between">
                            <span>Holdings</span>
                            <span className="text-foreground font-medium">{acc.holding_count}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Last synced</span>
                            <span className="text-foreground">{fmtDate(acc.last_synced_at)}</span>
                          </div>
                          {acc.sync_broker_type && (
                            <div className="flex justify-between">
                              <span>Broker</span>
                              <span className="text-foreground">{acc.sync_broker_type.toUpperCase()}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span>Auto sync</span>
                            <span className={acc.auto_sync_enabled ? "text-green-500" : "text-muted-foreground"}>
                              {acc.auto_sync_enabled ? "Enabled" : "Off"}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pending order drift */}
          {data.pending_order_drift.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Pending Order Drift
              </p>
              <Card>
                <CardContent className="pt-0 pb-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-cyber-rule/40">
                          <th className="py-3 pr-4 text-left text-xs font-semibold text-muted-foreground">Asset</th>
                          <th className="py-3 pr-4 text-left text-xs font-semibold text-muted-foreground">Action</th>
                          <th className="py-3 pr-4 text-right text-xs font-semibold text-muted-foreground">Staged Value</th>
                          <th className="py-3 pr-4 text-right text-xs font-semibold text-muted-foreground">Current Qty</th>
                          <th className="py-3 text-right text-xs font-semibold text-muted-foreground">Current Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.pending_order_drift.map(row => (
                          <tr key={row.order_id} className="border-b border-cyber-rule/20 last:border-0">
                            <td className="py-2.5 pr-4">
                              <p className="font-medium">{row.ticker ?? "—"}</p>
                              {row.name && <p className="text-xs text-muted-foreground truncate max-w-[140px]">{row.name}</p>}
                            </td>
                            <td className="py-2.5 pr-4">
                              <div className="flex items-center gap-1.5">
                                <ActionIcon action={row.staged_action} />
                                <span className="capitalize text-xs">{row.staged_action}</span>
                              </div>
                            </td>
                            <td className="py-2.5 pr-4 text-right text-xs">
                              {fmtMoney(row.staged_value, row.staged_currency)}
                            </td>
                            <td className="py-2.5 pr-4 text-right text-xs">
                              {row.current_holding_qty != null ? row.current_holding_qty.toLocaleString() : "—"}
                            </td>
                            <td className="py-2.5 text-right text-xs">
                              {fmtMoney(row.current_holding_value, row.staged_currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {data.pending_order_drift.length === 0 && data.total_pending_orders === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500/40" />
                No pending orders — no drift to show.
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

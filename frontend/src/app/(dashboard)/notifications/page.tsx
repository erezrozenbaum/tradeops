"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  ArrowRight,
  Bell as BellIcon,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  Loader2,
} from "lucide-react";

interface AppNotification {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  link: string | null;
}

interface PriceAlert {
  id: string;
  ticker: string;
  asset_name: string | null;
  alert_type: "above" | "below";
  target_price: number;
  currency: string;
  is_active: boolean;
  triggered_at: string | null;
  triggered_price: number | null;
  created_at: string;
}

const SEVERITY_CONFIG = {
  danger: {
    icon: AlertCircle,
    badge: "bg-red-500/10 text-red-600 border-red-200",
    border: "border-l-red-500",
    iconClass: "text-red-500",
  },
  warning: {
    icon: AlertTriangle,
    badge: "bg-amber-500/10 text-amber-600 border-amber-200",
    border: "border-l-amber-400",
    iconClass: "text-amber-500",
  },
  info: {
    icon: Info,
    badge: "bg-blue-500/10 text-blue-600 border-blue-200",
    border: "border-l-blue-400",
    iconClass: "text-blue-500",
  },
};

const TYPE_LABELS: Record<string, string> = {
  goal: "Goals",
  portfolio: "Portfolio",
  market: "Market",
  setup: "Setup",
  safety: "Safety",
  behavioral: "Behavior",
  insight: "Insight",
  alert: "Alert",
};

export default function NotificationsPage() {
  const investorId = useInvestorId();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  // Price alerts state
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [form, setForm] = useState({
    ticker: "",
    asset_name: "",
    alert_type: "above",
    target_price: "",
    currency: "USD",
  });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!investorId) return;
    fetch(`/api/v1/investors/${investorId}/notifications`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setNotifications(data); setLoading(false); });
    loadAlerts();
  }, [investorId]);

  function loadAlerts() {
    if (!investorId) return;
    setAlertsLoading(true);
    fetch(`/api/v1/investors/${investorId}/alerts`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setAlerts(data); setAlertsLoading(false); })
      .catch(() => setAlertsLoading(false));
  }

  async function handleCreateAlert(e: React.FormEvent) {
    e.preventDefault();
    if (!investorId || !form.ticker || !form.target_price) return;
    setCreating(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/v1/investors/${investorId}/price-alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: form.ticker.toUpperCase().trim(),
          asset_name: form.asset_name || null,
          alert_type: form.alert_type,
          target_price: parseFloat(form.target_price),
          currency: form.currency,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "Failed to create alert");
      }
      setForm({ ticker: "", asset_name: "", alert_type: "above", target_price: "", currency: "USD" });
      loadAlerts();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Error");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(alertId: string) {
    if (!investorId) return;
    setDeletingId(alertId);
    try {
      await fetch(`/api/v1/investors/${investorId}/price-alerts/${alertId}`, { method: "DELETE" });
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } finally {
      setDeletingId(null);
    }
  }

  const warnings = notifications.filter(n => n.severity !== "info");
  const infos = notifications.filter(n => n.severity === "info");
  const activeAlerts = alerts.filter(a => a.is_active);
  const triggeredAlerts = alerts.filter(a => !a.is_active && a.triggered_at);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl space-y-5 lg:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? "Loading…" : notifications.length === 0 ? "All clear" : `${notifications.length} item${notifications.length !== 1 ? "s" : ""} need your attention`}
          </p>
        </div>
        {notifications.length > 0 && (
          <Badge className="bg-primary/10 text-primary border-primary/20">
            {notifications.length}
          </Badge>
        )}
      </div>

      {!loading && notifications.length === 0 && (
        <Card>
          <CardContent className="py-14 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500/50 mb-3" />
            <p className="font-semibold">Everything looks good</p>
            <p className="text-sm text-muted-foreground mt-1">
              No alerts right now. We check your goals, portfolio, and market data daily.
            </p>
          </CardContent>
        </Card>
      )}

      {warnings.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Alerts</p>
          {warnings.map(n => {
            const cfg = SEVERITY_CONFIG[n.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.info;
            const Icon = cfg.icon;
            return (
              <Card key={n.id} className={`border-l-4 ${cfg.border}`}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${cfg.iconClass}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-medium text-sm">{n.title}</p>
                        <Badge variant="muted" className={`text-[10px] px-1.5 py-0 ${cfg.badge}`}>
                          {TYPE_LABELS[n.type] ?? n.type}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{n.message}</p>
                      {n.link && (
                        <Link
                          href={n.link}
                          className="inline-flex items-center gap-1 text-xs text-primary mt-2 hover:underline"
                        >
                          View <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {infos.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Suggestions</p>
          {infos.map(n => {
            const cfg = SEVERITY_CONFIG.info;
            const Icon = cfg.icon;
            return (
              <Card key={n.id} className={`border-l-4 ${cfg.border}`}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${cfg.iconClass}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-medium text-sm">{n.title}</p>
                        <Badge variant="muted" className={`text-[10px] px-1.5 py-0 ${cfg.badge}`}>
                          {TYPE_LABELS[n.type] ?? n.type}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{n.message}</p>
                      {n.link && (
                        <Link
                          href={n.link}
                          className="inline-flex items-center gap-1 text-xs text-primary mt-2 hover:underline"
                        >
                          View <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Price Alerts Section */}
      <div className="space-y-3 pt-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Price Alerts</p>

        {/* Create form */}
        <Card>
          <CardHeader className="pb-3 pt-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BellIcon className="h-4 w-4 text-cyber-cyan" />
              New Price Alert
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <form onSubmit={handleCreateAlert} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Ticker *</label>
                  <input
                    className="w-full rounded-md border border-cyber-rule/60 bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-cyber-cyan/50"
                    placeholder="AAPL"
                    value={form.ticker}
                    onChange={e => setForm(f => ({ ...f, ticker: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Asset name</label>
                  <input
                    className="w-full rounded-md border border-cyber-rule/60 bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-cyber-cyan/50"
                    placeholder="Apple Inc."
                    value={form.asset_name}
                    onChange={e => setForm(f => ({ ...f, asset_name: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Condition</label>
                  <select
                    className="w-full rounded-md border border-cyber-rule/60 bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-cyber-cyan/50"
                    value={form.alert_type}
                    onChange={e => setForm(f => ({ ...f, alert_type: e.target.value }))}
                  >
                    <option value="above">Above</option>
                    <option value="below">Below</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Target price *</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="w-full rounded-md border border-cyber-rule/60 bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-cyber-cyan/50"
                    placeholder="150.00"
                    value={form.target_price}
                    onChange={e => setForm(f => ({ ...f, target_price: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Currency</label>
                  <input
                    className="w-full rounded-md border border-cyber-rule/60 bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-cyber-cyan/50"
                    placeholder="USD"
                    value={form.currency}
                    onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))}
                    maxLength={5}
                  />
                </div>
              </div>
              {formError && (
                <p className="text-xs text-red-500">{formError}</p>
              )}
              <button
                type="submit"
                disabled={creating}
                className="flex items-center gap-2 px-4 py-1.5 rounded-md text-sm bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/30 hover:bg-cyber-cyan/20 transition-colors disabled:opacity-50"
              >
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Add Alert
              </button>
            </form>
          </CardContent>
        </Card>

        {/* Active alerts */}
        {alertsLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading alerts…
          </div>
        ) : activeAlerts.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Active ({activeAlerts.length})</p>
            {activeAlerts.map(alert => (
              <Card key={alert.id} className="border-cyber-cyan/10">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {alert.alert_type === "above"
                        ? <TrendingUp className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        : <TrendingDown className="h-3.5 w-3.5 text-red-500 shrink-0" />
                      }
                      <div className="min-w-0">
                        <span className="font-medium text-sm">{alert.ticker}</span>
                        {alert.asset_name && (
                          <span className="text-xs text-muted-foreground ml-1.5 truncate">{alert.asset_name}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {alert.alert_type === "above" ? "≥" : "≤"} {alert.currency} {alert.target_price.toLocaleString()}
                      </span>
                      <Badge className="bg-green-500/10 text-green-600 border-green-200 text-[10px] px-1.5 py-0">Active</Badge>
                      <button
                        onClick={() => handleDelete(alert.id)}
                        disabled={deletingId === alert.id}
                        className="text-muted-foreground/50 hover:text-red-500 transition-colors"
                        title="Delete alert"
                      >
                        {deletingId === alert.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />
                        }
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-2">No active price alerts.</p>
        )}

        {/* Triggered alerts */}
        {triggeredAlerts.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Triggered (last 30 days)</p>
            {triggeredAlerts.map(alert => (
              <Card key={alert.id} className="border-amber-500/10 opacity-70">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {alert.alert_type === "above"
                        ? <TrendingUp className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        : <TrendingDown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      }
                      <div className="min-w-0">
                        <span className="font-medium text-sm">{alert.ticker}</span>
                        {alert.triggered_price != null && (
                          <span className="text-xs text-muted-foreground ml-1.5">
                            hit {alert.currency} {alert.triggered_price.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 text-[10px] px-1.5 py-0">Triggered</Badge>
                      <button
                        onClick={() => handleDelete(alert.id)}
                        disabled={deletingId === alert.id}
                        className="text-muted-foreground/50 hover:text-red-500 transition-colors"
                        title="Dismiss"
                      >
                        {deletingId === alert.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />
                        }
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

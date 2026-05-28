"use client";

import { useEffect, useState, useCallback } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { Plus, Trash2, Eye, Clock, Bell, BellOff, X, AlertTriangle, ShoppingCart } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface WatchlistItem {
  id: string;
  ticker: string;
  name: string;
  asset_type: string;
  notes: string | null;
  added_at: string;
  current_price: number | null;
  price_currency: string | null;
  price_age_hours: number | null;
}

interface PriceAlert {
  id: string;
  ticker: string;
  alert_type: string;
  target_price: number;
  currency: string;
  is_active: boolean;
  triggered_at: string | null;
  triggered_price: number | null;
}

const ASSET_TYPE_LABELS: Record<string, string> = {
  stock: "Stock", bond: "Bond", etf: "ETF", crypto: "Crypto",
  fund: "Fund", real_estate: "Real Estate", other: "Other",
};

const ASSET_TYPE_OPTIONS = [
  { value: "stock", label: "Stock" }, { value: "etf", label: "ETF" },
  { value: "crypto", label: "Crypto" }, { value: "bond", label: "Bond" },
  { value: "fund", label: "Fund" }, { value: "real_estate", label: "Real Estate" },
  { value: "other", label: "Other" },
];

const EMPTY_FORM = { ticker: "", name: "", asset_type: "stock", notes: "" };

interface SparklinePoint { date: string; price: number; }

function Sparkline({ points }: { points: SparklinePoint[] }) {
  if (points.length < 2) return <span className="text-xs text-muted-foreground/40">—</span>;
  const prices = points.map(p => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const W = 80, H = 28;
  const coords = prices.map((p, i) =>
    `${(i / (prices.length - 1)) * W},${H - ((p - min) / range) * (H - 2) - 1}`
  ).join(" ");
  const isUp = prices[prices.length - 1] >= prices[0];
  const pct = ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100;
  return (
    <div className="flex items-center gap-2">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0">
        <polyline points={coords} fill="none" stroke={isUp ? "#22c55e" : "#ef4444"} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <span className={`text-xs font-medium tabular-nums ${isUp ? "text-green-500" : "text-red-500"}`}>
        {isUp ? "+" : ""}{pct.toFixed(1)}%
      </span>
    </div>
  );
}

// ── Price alert modal ──────────────────────────────────────────────────────

function AlertModal({
  item,
  alerts,
  investorId,
  onClose,
  onRefresh,
}: {
  item: WatchlistItem;
  alerts: PriceAlert[];
  investorId: string;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [alertType, setAlertType] = useState<"above" | "below">("above");
  const [targetPrice, setTargetPrice] = useState(
    item.current_price ? item.current_price.toFixed(2) : ""
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function createAlert() {
    const price = parseFloat(targetPrice);
    if (isNaN(price) || price <= 0) { setErr("Enter a valid price"); return; }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/v1/investors/${investorId}/alerts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: item.ticker,
          asset_name: item.name,
          alert_type: alertType,
          target_price: price,
          currency: item.price_currency ?? "USD",
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail ?? "Failed");
      onRefresh();
      setTargetPrice("");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteAlert(alertId: string) {
    await fetch(`/api/v1/investors/${investorId}/alerts/${alertId}`, { method: "DELETE" });
    onRefresh();
  }

  const itemAlerts = alerts.filter((a) => a.ticker === item.ticker);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-sm shadow-xl">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{item.ticker} Price Alerts</p>
              <p className="text-xs text-muted-foreground">{item.name}</p>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {item.current_price != null && (
            <p className="text-xs text-muted-foreground">
              Current price: <span className="font-medium text-foreground">
                {item.price_currency} {item.current_price.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </span>
            </p>
          )}

          {/* Existing alerts */}
          {itemAlerts.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Active alerts</p>
              {itemAlerts.map((a) => (
                <div key={a.id} className={`flex items-center justify-between rounded-md px-3 py-2 text-xs ${
                  a.triggered_at ? "bg-amber-500/10 border border-amber-500/30" : "bg-muted"
                }`}>
                  <span>
                    <span className={a.alert_type === "above" ? "text-green-500" : "text-red-500"}>
                      {a.alert_type === "above" ? "▲ Above" : "▼ Below"}
                    </span>{" "}
                    <span className="font-medium">{a.currency} {a.target_price.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    {a.triggered_at && (
                      <Badge variant="warning" className="text-[10px]">
                        Triggered
                      </Badge>
                    )}
                    <button onClick={() => deleteAlert(a.id)}
                      className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* New alert */}
          <div className="space-y-2 pt-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add alert</p>
            <div className="flex rounded-lg border border-border overflow-hidden">
              {(["above", "below"] as const).map((t) => (
                <button key={t}
                  onClick={() => setAlertType(t)}
                  className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                    alertType === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t === "above" ? "▲ Above" : "▼ Below"}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input className="h-8 text-xs" type="number" placeholder="Target price"
                value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} />
              <Button size="sm" className="h-8" onClick={createAlert} disabled={saving}>
                {saving ? "…" : "Set"}
              </Button>
            </div>
            {err && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {err}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function WatchlistPage() {
  const investorId = useInvestorId();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [sparklines, setSparklines] = useState<Record<string, SparklinePoint[]>>({});
  const [stageBuy, setStageBuy] = useState<Record<string, { amount: string; open: boolean; staging: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [alertModal, setAlertModal] = useState<WatchlistItem | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    if (!investorId) return;
    const r = await fetch(`/api/v1/investors/${investorId}/alerts`);
    if (r.ok) setAlerts(await r.json());
  }, [investorId]);

  const loadSparklines = useCallback(async () => {
    if (!investorId) return;
    const r = await fetch(`/api/v1/investors/${investorId}/watchlist/sparklines`);
    if (r.ok) {
      const data: { ticker: string; points: SparklinePoint[] }[] = await r.json();
      const map: Record<string, SparklinePoint[]> = {};
      for (const d of data) map[d.ticker] = d.points;
      setSparklines(map);
    }
  }, [investorId]);

  const load = useCallback(async () => {
    if (!investorId) return;
    setLoading(true);
    const r = await fetch(`/api/v1/investors/${investorId}/watchlist`);
    if (r.ok) setItems(await r.json());
    await loadAlerts();
    setLoading(false);
    loadSparklines();
  }, [investorId, loadAlerts, loadSparklines]);

  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!form.ticker.trim() || !form.name.trim()) return;
    setSaving(true);
    setError(null);
    const r = await fetch(`/api/v1/investors/${investorId}/watchlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticker: form.ticker.trim().toUpperCase(),
        name: form.name.trim(),
        asset_type: form.asset_type,
        notes: form.notes.trim() || null,
      }),
    });
    if (r.ok) { setForm(EMPTY_FORM); setShowForm(false); load(); }
    else if (r.status === 409) setError("This ticker is already on your watchlist.");
    else setError("Failed to add item.");
    setSaving(false);
  }

  async function remove(id: string) {
    await fetch(`/api/v1/investors/${investorId}/watchlist/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function openStageBuy(itemId: string) {
    setStageBuy(prev => ({ ...prev, [itemId]: { amount: "", open: true, staging: false } }));
  }

  function closeStageBuy(itemId: string) {
    setStageBuy(prev => { const n = { ...prev }; delete n[itemId]; return n; });
  }

  async function doStageBuy(item: WatchlistItem, amount: string) {
    const price = parseFloat(amount);
    if (isNaN(price) || price <= 0) return;
    setStageBuy(prev => ({ ...prev, [item.id]: { ...prev[item.id], staging: true } }));
    try {
      await fetch(`/api/v1/investors/${investorId}/staged-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: item.ticker,
          name: item.name,
          action: "buy",
          quantity: 1.0,
          unit_price: price,
          currency: item.price_currency ?? "USD",
          asset_type: item.asset_type,
          notes: `Staged from watchlist: ${item.ticker}`,
        }),
      });
      closeStageBuy(item.id);
    } catch {
      setStageBuy(prev => ({ ...prev, [item.id]: { ...prev[item.id], staging: false } }));
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl space-y-5 lg:space-y-6">
      {/* Price alert modal */}
      {alertModal && investorId && (
        <AlertModal
          item={alertModal}
          alerts={alerts}
          investorId={investorId}
          onClose={() => setAlertModal(null)}
          onRefresh={loadAlerts}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Watchlist</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track instruments · Set price alerts
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setError(null); }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add instrument
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <Card>
          <CardContent className="pt-5 space-y-4">
            <p className="text-sm font-medium">Add to watchlist</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Ticker symbol *</label>
                <input placeholder="e.g. AAPL, TEVA.TA" value={form.ticker}
                  onChange={e => setForm({ ...form, ticker: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm uppercase" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Name *</label>
                <input placeholder="e.g. Apple Inc." value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Asset type</label>
                <select value={form.asset_type}
                  onChange={e => setForm({ ...form, asset_type: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                  {ASSET_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
                <input placeholder="Optional reason or target price" value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" />
              </div>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={add} disabled={saving}
                className="px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60">
                {saving ? "Adding…" : "Add"}
              </button>
              <button onClick={() => { setShowForm(false); setError(null); setForm(EMPTY_FORM); }}
                className="px-4 py-1.5 rounded-md border border-input text-sm text-muted-foreground hover:bg-muted">
                Cancel
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center py-14">
            <Eye className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="font-medium">Your watchlist is empty</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add tickers you want to monitor — prices update daily.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Items */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map(item => {
            const itemAlerts = alerts.filter((a) => a.ticker === item.ticker);
            const activeAlerts = itemAlerts.filter((a) => a.is_active);
            const triggeredAlerts = itemAlerts.filter((a) => !a.is_active && a.triggered_at);
            return (
              <Card key={item.id}>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between py-4 gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="flex flex-col min-w-0 gap-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-semibold text-sm">{item.ticker}</span>
                          <Badge variant="muted" className="text-xs">
                            {ASSET_TYPE_LABELS[item.asset_type] ?? item.asset_type}
                          </Badge>
                          {activeAlerts.length > 0 && (
                            <Badge className="text-[10px] bg-blue-500/10 text-blue-500 border-blue-500/30 border">
                              <Bell className="h-2.5 w-2.5 mr-1" />
                              {activeAlerts.length} alert{activeAlerts.length > 1 ? "s" : ""}
                            </Badge>
                          )}
                          {triggeredAlerts.length > 0 && (
                            <Badge className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/30 border">
                              <Bell className="h-2.5 w-2.5 mr-1" />
                              Triggered!
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground truncate">{item.name}</span>
                        {item.notes && (
                          <span className="text-xs text-muted-foreground/70 italic truncate">{item.notes}</span>
                        )}
                        {sparklines[item.ticker] && (
                          <Sparkline points={sparklines[item.ticker]} />
                        )}
                        {/* Stage Buy inline */}
                        {(() => {
                          const bs = stageBuy[item.id];
                          return bs?.open ? (
                            <div className="flex items-center gap-2 mt-1">
                              <input
                                type="number"
                                placeholder="Amount"
                                value={bs.amount}
                                onChange={e => setStageBuy(prev => ({ ...prev, [item.id]: { ...prev[item.id], amount: e.target.value } }))}
                                className="w-24 h-7 rounded border border-input bg-transparent px-2 text-xs"
                              />
                              <span className="text-xs text-muted-foreground">{item.price_currency ?? "USD"}</span>
                              <button
                                onClick={() => doStageBuy(item, bs.amount)}
                                disabled={bs.staging || !bs.amount}
                                className="px-2.5 py-1 rounded bg-primary text-primary-foreground text-xs font-medium disabled:opacity-60"
                              >
                                {bs.staging ? "…" : "Stage"}
                              </button>
                              <button onClick={() => closeStageBuy(item.id)} className="text-xs text-muted-foreground hover:text-foreground">
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => openStageBuy(item.id)}
                              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-0.5 w-fit"
                            >
                              <ShoppingCart className="h-3 w-3" /> Stage Buy
                            </button>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      {item.current_price != null ? (
                        <div className="text-right">
                          <p className="font-semibold text-sm">
                            {formatCurrency(item.current_price, item.price_currency ?? "USD")}
                          </p>
                          {item.price_age_hours != null && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                              <Clock className="h-3 w-3" />
                              {item.price_age_hours < 1 ? "< 1h ago" : `${Math.round(item.price_age_hours)}h ago`}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No price data</p>
                      )}

                      {/* Price alert button */}
                      <button
                        onClick={() => setAlertModal(item)}
                        title="Set price alert"
                        className={`transition-colors ${
                          activeAlerts.length > 0 || triggeredAlerts.length > 0
                            ? "text-blue-500 hover:text-blue-600"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {activeAlerts.length > 0 ? (
                          <Bell className="h-4 w-4" />
                        ) : (
                          <BellOff className="h-4 w-4" />
                        )}
                      </button>

                      <button
                        onClick={() => remove(item.id)}
                        className="text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

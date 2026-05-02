"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Plus, Trash2, Eye, Clock } from "lucide-react";

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

const ASSET_TYPE_LABELS: Record<string, string> = {
  stock: "Stock", bond: "Bond", etf: "ETF", crypto: "Crypto",
  fund: "Fund", real_estate: "Real Estate", other: "Other",
};

const ASSET_TYPE_OPTIONS = [
  { value: "stock", label: "Stock" },
  { value: "etf", label: "ETF" },
  { value: "crypto", label: "Crypto" },
  { value: "bond", label: "Bond" },
  { value: "fund", label: "Fund" },
  { value: "real_estate", label: "Real Estate" },
  { value: "other", label: "Other" },
];

const EMPTY_FORM = { ticker: "", name: "", asset_type: "stock", notes: "" };

export default function WatchlistPage() {
  const investorId = useInvestorId();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!investorId) return;
    load();
  }, [investorId]);

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/v1/investors/${investorId}/watchlist`);
    if (r.ok) setItems(await r.json());
    setLoading(false);
  }

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
    if (r.ok) {
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } else if (r.status === 409) {
      setError("This ticker is already on your watchlist.");
    } else {
      setError("Failed to add item.");
    }
    setSaving(false);
  }

  async function remove(id: string) {
    await fetch(`/api/v1/investors/${investorId}/watchlist/${id}`, { method: "DELETE" });
    setItems(prev => prev.filter(i => i.id !== id));
  }

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Watchlist</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track instruments you want to invest in
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
                <input
                  placeholder="e.g. AAPL, TEVA.TA"
                  value={form.ticker}
                  onChange={e => setForm({ ...form, ticker: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm uppercase"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Name *</label>
                <input
                  placeholder="e.g. Apple Inc."
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Asset type</label>
                <select
                  value={form.asset_type}
                  onChange={e => setForm({ ...form, asset_type: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  {ASSET_TYPE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
                <input
                  placeholder="Optional reason or target price"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                />
              </div>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                onClick={add}
                disabled={saving}
                className="px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
              >
                {saving ? "Adding…" : "Add"}
              </button>
              <button
                onClick={() => { setShowForm(false); setError(null); setForm(EMPTY_FORM); }}
                className="px-4 py-1.5 rounded-md border border-input text-sm text-muted-foreground hover:bg-muted"
              >
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
          {items.map(item => (
            <Card key={item.id}>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between py-4 gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-sm">{item.ticker}</span>
                        <Badge variant="muted" className="text-xs">
                          {ASSET_TYPE_LABELS[item.asset_type] ?? item.asset_type}
                        </Badge>
                      </div>
                      <span className="text-sm text-muted-foreground truncate">{item.name}</span>
                      {item.notes && (
                        <span className="text-xs text-muted-foreground/70 italic truncate">{item.notes}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-6 shrink-0">
                    {item.current_price != null ? (
                      <div className="text-right">
                        <p className="font-semibold text-sm">
                          {formatCurrency(item.current_price, item.price_currency ?? "USD")}
                        </p>
                        {item.price_age_hours != null && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                            <Clock className="h-3 w-3" />
                            {item.price_age_hours < 1
                              ? "< 1h ago"
                              : `${Math.round(item.price_age_hours)}h ago`}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No price data</p>
                    )}
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
          ))}
        </div>
      )}
    </div>
  );
}

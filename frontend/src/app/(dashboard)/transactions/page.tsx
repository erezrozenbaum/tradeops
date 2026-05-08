"use client";

import { useEffect, useState, useCallback } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
  ArrowUpCircle, ArrowDownCircle, DollarSign, FileText,
  Plus, Trash2, X, AlertTriangle, ClipboardList,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

interface Transaction {
  id: string;
  investor_id: string;
  account_id: string;
  holding_id: string | null;
  transaction_type: string;
  ticker: string | null;
  asset_name: string | null;
  quantity: number | null;
  price_per_unit: number | null;
  total_amount: number;
  fees: number;
  currency: string;
  transaction_date: string;
  notes: string | null;
  created_at: string;
}

interface Account {
  id: string;
  provider_name: string;
  account_name: string | null;
}

const TX_TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  buy:      { label: "Buy",      color: "text-green-500",  icon: ArrowDownCircle },
  sell:     { label: "Sell",     color: "text-red-500",    icon: ArrowUpCircle },
  dividend: { label: "Dividend", color: "text-blue-500",   icon: DollarSign },
  fee:      { label: "Fee",      color: "text-orange-500", icon: FileText },
  split:    { label: "Split",    color: "text-purple-500", icon: FileText },
  bonus:    { label: "Bonus",    color: "text-teal-500",   icon: DollarSign },
};

const TX_TYPES = Object.entries(TX_TYPE_CONFIG).map(([v, c]) => ({ value: v, label: c.label }));

// ── Add transaction form ───────────────────────────────────────────────────

interface AddFormProps {
  investorId: string;
  accounts: Account[];
  onCreated: () => void;
  onCancel: () => void;
}

function AddTransactionForm({ investorId, accounts, onCreated, onCancel }: AddFormProps) {
  const [form, setForm] = useState({
    account_id: accounts[0]?.id ?? "",
    transaction_type: "buy",
    ticker: "",
    asset_name: "",
    quantity: "",
    price_per_unit: "",
    total_amount: "",
    fees: "0",
    currency: "USD",
    transaction_date: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Auto-compute total_amount from quantity × price if both filled
  useEffect(() => {
    const qty = parseFloat(form.quantity);
    const price = parseFloat(form.price_per_unit);
    if (!isNaN(qty) && !isNaN(price)) {
      setForm((f) => ({ ...f, total_amount: (qty * price).toFixed(2) }));
    }
  }, [form.quantity, form.price_per_unit]);

  async function submit() {
    if (!form.account_id || !form.total_amount || !form.transaction_date) {
      setErr("Account, total amount, and date are required.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/v1/investors/${investorId}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: form.account_id,
          transaction_type: form.transaction_type,
          ticker: form.ticker || null,
          asset_name: form.asset_name || null,
          quantity: form.quantity ? parseFloat(form.quantity) : null,
          price_per_unit: form.price_per_unit ? parseFloat(form.price_per_unit) : null,
          total_amount: parseFloat(form.total_amount),
          fees: parseFloat(form.fees) || 0,
          currency: form.currency,
          transaction_date: form.transaction_date,
          notes: form.notes || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "Failed to save");
      }
      onCreated();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">New Transaction</CardTitle>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {err && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> {err}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Account *</label>
            <Select value={form.account_id} onChange={(e) => set("account_id", e.target.value)} className="h-8 text-xs">
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.account_name || a.provider_name}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Type *</label>
            <Select value={form.transaction_type} onChange={(e) => set("transaction_type", e.target.value)} className="h-8 text-xs">
              {TX_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Ticker</label>
            <Input className="h-8 text-xs uppercase" placeholder="e.g. AAPL"
              value={form.ticker} onChange={(e) => set("ticker", e.target.value.toUpperCase())} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Asset name</label>
            <Input className="h-8 text-xs" placeholder="e.g. Apple Inc."
              value={form.asset_name} onChange={(e) => set("asset_name", e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Quantity</label>
            <Input className="h-8 text-xs" type="number" placeholder="0"
              value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Price per unit</label>
            <Input className="h-8 text-xs" type="number" placeholder="0.00"
              value={form.price_per_unit} onChange={(e) => set("price_per_unit", e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Total amount *</label>
            <Input className="h-8 text-xs" type="number" placeholder="0.00"
              value={form.total_amount} onChange={(e) => set("total_amount", e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Fees</label>
            <Input className="h-8 text-xs" type="number" placeholder="0"
              value={form.fees} onChange={(e) => set("fees", e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Currency</label>
            <Input className="h-8 text-xs uppercase" placeholder="USD"
              value={form.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Date *</label>
            <Input className="h-8 text-xs" type="date"
              value={form.transaction_date} onChange={(e) => set("transaction_date", e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
          <Input className="h-8 text-xs" placeholder="Optional notes"
            value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Add transaction"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  const investorId = useInvestorId();
  const [txList, setTxList] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [filterTicker, setFilterTicker] = useState("");

  const load = useCallback(async () => {
    if (!investorId) return;
    setLoading(true);
    try {
      const [txRes, accRes] = await Promise.all([
        fetch(`/api/v1/investors/${investorId}/transactions?limit=200`),
        fetch(`/api/v1/investors/${investorId}/accounts`),
      ]);
      if (txRes.ok) setTxList(await txRes.json());
      if (accRes.ok) setAccounts(await accRes.json());
    } finally {
      setLoading(false);
    }
  }, [investorId]);

  useEffect(() => { load(); }, [load]);

  async function deleteTx(id: string) {
    if (!confirm("Delete this transaction?")) return;
    await fetch(`/api/v1/investors/${investorId}/transactions/${id}`, { method: "DELETE" });
    setTxList((prev) => prev.filter((t) => t.id !== id));
  }

  const filtered = txList.filter((t) => {
    if (filterType !== "all" && t.transaction_type !== filterType) return false;
    if (filterTicker && !(t.ticker ?? "").toLowerCase().includes(filterTicker.toLowerCase())) return false;
    return true;
  });

  // Summary totals
  const totalBought = txList.filter((t) => t.transaction_type === "buy")
    .reduce((s, t) => s + t.total_amount + t.fees, 0);
  const totalSold = txList.filter((t) => t.transaction_type === "sell")
    .reduce((s, t) => s + t.total_amount - t.fees, 0);
  const totalFees = txList.reduce((s, t) => s + t.fees, 0);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-6 w-6" />
            Transaction Log
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Complete record of all buy, sell, dividend, and fee events
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)} size="sm" disabled={showAdd}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add transaction
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Invested</p>
            <p className="text-xl font-bold text-green-500 mt-1">{totalBought.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Sold</p>
            <p className="text-xl font-bold text-red-500 mt-1">{totalSold.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Fees Paid</p>
            <p className="text-xl font-bold mt-1">{totalFees.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </CardContent>
        </Card>
      </div>

      {/* Add form */}
      {showAdd && investorId && (
        <AddTransactionForm
          investorId={investorId}
          accounts={accounts}
          onCreated={() => { setShowAdd(false); load(); }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Input
          className="h-8 text-xs w-40"
          placeholder="Filter by ticker…"
          value={filterTicker}
          onChange={(e) => setFilterTicker(e.target.value)}
        />
        <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="h-8 text-xs w-36">
          <option value="all">All types</option>
          {TX_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} transactions</span>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-14 flex flex-col items-center gap-2 text-center">
            <ClipboardList className="h-10 w-10 text-muted-foreground/30" />
            <p className="font-medium text-muted-foreground">No transactions yet</p>
            <p className="text-sm text-muted-foreground/70 max-w-xs">
              Record your buys, sells, dividends, and fees to build a complete trade history.
            </p>
            <Button size="sm" className="mt-2" onClick={() => setShowAdd(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add first transaction
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Ticker</th>
                  <th className="text-right px-4 py-3 font-medium">Qty</th>
                  <th className="text-right px-4 py-3 font-medium">Price</th>
                  <th className="text-right px-4 py-3 font-medium">Total</th>
                  <th className="text-right px-4 py-3 font-medium">Fees</th>
                  <th className="text-left px-4 py-3 font-medium">Notes</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx) => {
                  const cfg = TX_TYPE_CONFIG[tx.transaction_type] ?? TX_TYPE_CONFIG.buy;
                  const Icon = cfg.icon;
                  return (
                    <tr key={tx.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {tx.transaction_date}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1.5 ${cfg.color}`}>
                          <Icon className="h-3.5 w-3.5" />
                          <span className="font-medium text-xs">{cfg.label}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {tx.ticker ?? <span className="text-muted-foreground">—</span>}
                        {tx.asset_name && (
                          <p className="text-xs text-muted-foreground">{tx.asset_name}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {tx.quantity != null ? tx.quantity.toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {tx.price_per_unit != null
                          ? tx.price_per_unit.toLocaleString(undefined, { maximumFractionDigits: 4 })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {tx.currency} {tx.total_amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                        {tx.fees > 0 ? `${tx.currency} ${tx.fees.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[140px] truncate">
                        {tx.notes ?? ""}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => deleteTx(tx.id)}
                          className="text-muted-foreground/40 hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

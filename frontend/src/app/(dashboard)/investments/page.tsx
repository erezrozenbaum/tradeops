"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { Plus, Trash2, Edit2, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight, Briefcase, RefreshCw } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface Holding {
  id: string;
  account_id: string;
  ticker: string | null;
  isin: string | null;
  name: string;
  asset_type: string;
  quantity: number;
  avg_buy_price: number;
  currency: string;
  fees: number;
  purchase_date: string | null;
  current_value: number | null;
  notes: string | null;
}

interface Account {
  id: string;
  provider_name: string;
  account_type: string;
  account_name: string | null;
  currency: string;
  notes: string | null;
  holdings: Holding[];
}

interface HoldingAnalysis {
  id: string;
  name: string;
  ticker: string | null;
  asset_type: string;
  cost_basis: number;
  current_value_base: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  currency: string;
  price_source: string;
  live_price: number | null;
  live_price_currency: string | null;
}

interface AccountAnalysis {
  id: string;
  provider_name: string;
  account_type: string;
  account_name: string | null;
  total_cost_basis: number;
  total_current_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  holdings: HoldingAnalysis[];
}

interface PortfolioSummary {
  base_currency: string;
  total_cost_basis: number;
  total_current_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  asset_allocation: Record<string, number>;
  currency_exposure: Record<string, number>;
  accounts: AccountAnalysis[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const ACCOUNT_TYPES = [
  { value: "pension", label: "Pension" },
  { value: "keren_hishtalmut", label: "Keren Hishtalmut" },
  { value: "brokerage", label: "Brokerage" },
  { value: "crypto", label: "Crypto" },
  { value: "etf_fund", label: "ETF / Fund" },
  { value: "bank", label: "Bank" },
  { value: "other", label: "Other" },
];

const ASSET_TYPES = [
  { value: "stock", label: "Stock" },
  { value: "bond", label: "Bond" },
  { value: "etf", label: "ETF" },
  { value: "crypto", label: "Crypto" },
  { value: "fund", label: "Fund" },
  { value: "real_estate", label: "Real Estate" },
  { value: "other", label: "Other" },
];

const EMPTY_ACCOUNT = { provider_name: "", account_type: "brokerage", account_name: "", currency: "ILS", notes: "" };
const EMPTY_HOLDING = { ticker: "", isin: "", name: "", asset_type: "stock", quantity: "", avg_buy_price: "", currency: "ILS", fees: "", purchase_date: "", current_value: "", notes: "" };

// ── Helpers ──────────────────────────────────────────────────────────────────

function PnlBadge({ pnl, pct }: { pnl: number; pct: number }) {
  if (pnl > 0) return <span className="flex items-center gap-1 text-green-600 text-sm font-medium"><TrendingUp className="h-3.5 w-3.5" />+{formatPercent(pct / 100)}</span>;
  if (pnl < 0) return <span className="flex items-center gap-1 text-red-500 text-sm font-medium"><TrendingDown className="h-3.5 w-3.5" />{formatPercent(pct / 100)}</span>;
  return <span className="flex items-center gap-1 text-muted-foreground text-sm"><Minus className="h-3.5 w-3.5" />0%</span>;
}

function accountTypeLabel(v: string) { return ACCOUNT_TYPES.find(t => t.value === v)?.label ?? v; }
function assetTypeLabel(v: string) { return ASSET_TYPES.find(t => t.value === v)?.label ?? v; }

// ── Page ─────────────────────────────────────────────────────────────────────

export default function InvestmentsPage() {
  const investorId = useInvestorId();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());

  // Account form
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [accountForm, setAccountForm] = useState(EMPTY_ACCOUNT);
  const [savingAccount, setSavingAccount] = useState(false);

  // Holding form
  const [addingHoldingForAccount, setAddingHoldingForAccount] = useState<string | null>(null);
  const [holdingForm, setHoldingForm] = useState(EMPTY_HOLDING);
  const [savingHolding, setSavingHolding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!investorId) return;
    loadAll();
  }, [investorId]);

  async function loadAll() {
    setLoading(true);
    const [accts, port] = await Promise.all([
      fetch(`/api/v1/investors/${investorId}/accounts`).then(r => r.ok ? r.json() : []),
      fetch(`/api/v1/investors/${investorId}/portfolio`).then(r => r.ok ? r.json() : null),
    ]);
    setAccounts(accts);
    setPortfolio(port);
    setLoading(false);
  }

  function toggleAccount(id: string) {
    setExpandedAccounts(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function createAccount() {
    setSavingAccount(true);
    try {
      const res = await fetch(`/api/v1/investors/${investorId}/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_name: accountForm.provider_name,
          account_type: accountForm.account_type,
          account_name: accountForm.account_name || null,
          currency: accountForm.currency,
          notes: accountForm.notes || null,
        }),
      });
      if (res.ok) {
        setShowAccountForm(false);
        setAccountForm(EMPTY_ACCOUNT);
        loadAll();
      }
    } finally {
      setSavingAccount(false);
    }
  }

  async function deleteAccount(accountId: string) {
    if (!confirm("Delete this account and all its holdings?")) return;
    await fetch(`/api/v1/investors/${investorId}/accounts/${accountId}`, { method: "DELETE" });
    loadAll();
  }

  async function addHolding(accountId: string) {
    setSavingHolding(true);
    try {
      const res = await fetch(`/api/v1/investors/${investorId}/accounts/${accountId}/holdings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: holdingForm.ticker || null,
          isin: holdingForm.isin || null,
          name: holdingForm.name,
          asset_type: holdingForm.asset_type,
          quantity: parseFloat(holdingForm.quantity),
          avg_buy_price: parseFloat(holdingForm.avg_buy_price),
          currency: holdingForm.currency,
          fees: holdingForm.fees ? parseFloat(holdingForm.fees) : 0,
          purchase_date: holdingForm.purchase_date || null,
          current_value: holdingForm.current_value ? parseFloat(holdingForm.current_value) : null,
          notes: holdingForm.notes || null,
        }),
      });
      if (res.ok) {
        setAddingHoldingForAccount(null);
        setHoldingForm(EMPTY_HOLDING);
        loadAll();
      }
    } finally {
      setSavingHolding(false);
    }
  }

  async function refreshPrices() {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/v1/investors/${investorId}/portfolio/refresh-prices`, { method: "POST" });
      if (res.ok) {
        const updated = await res.json();
        setPortfolio(updated);
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function deleteHolding(accountId: string, holdingId: string) {
    if (!confirm("Remove this holding?")) return;
    await fetch(`/api/v1/investors/${investorId}/accounts/${accountId}/holdings/${holdingId}`, { method: "DELETE" });
    loadAll();
  }

  if (!investorId || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const currency = portfolio?.base_currency ?? "ILS";

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Investments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track your existing holdings across all accounts</p>
        </div>
        <div className="flex gap-2">
          {accounts.length > 0 && (
            <Button variant="outline" onClick={refreshPrices} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing…" : "Refresh prices"}
            </Button>
          )}
          <Button onClick={() => setShowAccountForm(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add account
          </Button>
        </div>
      </div>

      {/* Portfolio summary */}
      {portfolio && (portfolio.total_current_value > 0 || accounts.length > 0) && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total value</p>
              <p className="text-xl font-semibold">{formatCurrency(portfolio.total_current_value, currency)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Cost basis</p>
              <p className="text-xl font-semibold">{formatCurrency(portfolio.total_cost_basis, currency)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Unrealized P&L</p>
              <p className={`text-xl font-semibold ${portfolio.unrealized_pnl >= 0 ? "text-green-600" : "text-red-500"}`}>
                {portfolio.unrealized_pnl >= 0 ? "+" : ""}{formatCurrency(portfolio.unrealized_pnl, currency)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {portfolio.unrealized_pnl_pct >= 0 ? "+" : ""}{portfolio.unrealized_pnl_pct.toFixed(2)}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Asset allocation</p>
              <div className="space-y-1">
                {Object.entries(portfolio.asset_allocation).map(([type, pct]) => (
                  <div key={type} className="flex justify-between text-xs">
                    <span className="text-muted-foreground capitalize">{type}</span>
                    <span className="font-medium">{pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add account form */}
      {showAccountForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New investment account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Provider</label>
                <Input
                  placeholder="e.g. Meitav, IBI, Interactive Brokers"
                  value={accountForm.provider_name}
                  onChange={e => setAccountForm({ ...accountForm, provider_name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Account type</label>
                <Select value={accountForm.account_type} onChange={e => setAccountForm({ ...accountForm, account_type: e.target.value })}>
                  {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Display name (optional)</label>
                <Input
                  placeholder="e.g. My pension fund"
                  value={accountForm.account_name}
                  onChange={e => setAccountForm({ ...accountForm, account_name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Currency</label>
                <Input
                  placeholder="ILS"
                  maxLength={3}
                  value={accountForm.currency}
                  onChange={e => setAccountForm({ ...accountForm, currency: e.target.value.toUpperCase() })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={createAccount} disabled={!accountForm.provider_name || savingAccount}>
                {savingAccount ? "Saving…" : "Create account"}
              </Button>
              <Button variant="outline" onClick={() => { setShowAccountForm(false); setAccountForm(EMPTY_ACCOUNT); }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {accounts.length === 0 && !showAccountForm && (
        <Card>
          <CardContent className="py-16 text-center">
            <Briefcase className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">No investment accounts yet</p>
            <p className="text-xs text-muted-foreground mt-1 mb-5">
              Add your existing accounts to track your portfolio performance.
            </p>
            <Button onClick={() => setShowAccountForm(true)}>Add account</Button>
          </CardContent>
        </Card>
      )}

      {/* Account cards */}
      {accounts.map(account => {
        const analysis = portfolio?.accounts.find(a => a.id === account.id);
        const expanded = expandedAccounts.has(account.id);

        return (
          <Card key={account.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <button
                  className="flex items-center gap-3 text-left"
                  onClick={() => toggleAccount(account.id)}
                >
                  {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <div>
                    <p className="font-medium text-sm">{account.account_name ?? account.provider_name}</p>
                    <p className="text-xs text-muted-foreground">{account.provider_name} · <Badge variant="outline" className="text-[10px] py-0">{accountTypeLabel(account.account_type)}</Badge></p>
                  </div>
                </button>
                <div className="flex items-center gap-4">
                  {analysis && (
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(analysis.total_current_value, currency)}</p>
                      <PnlBadge pnl={analysis.unrealized_pnl} pct={analysis.unrealized_pnl_pct} />
                    </div>
                  )}
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setAddingHoldingForAccount(account.id); setExpandedAccounts(prev => new Set([...prev, account.id])); }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add holding
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteAccount(account.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>

            {expanded && (
              <CardContent className="pt-0 space-y-3">
                {/* Add holding form */}
                {addingHoldingForAccount === account.id && (
                  <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add holding</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Name *</label>
                        <Input placeholder="e.g. S&P 500 ETF" value={holdingForm.name} onChange={e => setHoldingForm({ ...holdingForm, name: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Ticker</label>
                        <Input placeholder="SPY" value={holdingForm.ticker} onChange={e => setHoldingForm({ ...holdingForm, ticker: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">ISIN</label>
                        <Input placeholder="US78462F1030" value={holdingForm.isin} onChange={e => setHoldingForm({ ...holdingForm, isin: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Asset type</label>
                        <Select value={holdingForm.asset_type} onChange={e => setHoldingForm({ ...holdingForm, asset_type: e.target.value })}>
                          {ASSET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Quantity *</label>
                        <Input type="number" placeholder="10" value={holdingForm.quantity} onChange={e => setHoldingForm({ ...holdingForm, quantity: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Avg buy price *</label>
                        <Input type="number" placeholder="450.00" value={holdingForm.avg_buy_price} onChange={e => setHoldingForm({ ...holdingForm, avg_buy_price: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Currency</label>
                        <Input maxLength={3} value={holdingForm.currency} onChange={e => setHoldingForm({ ...holdingForm, currency: e.target.value.toUpperCase() })} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Current value (optional)</label>
                        <Input type="number" placeholder="Auto-calculated if blank" value={holdingForm.current_value} onChange={e => setHoldingForm({ ...holdingForm, current_value: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Purchase date</label>
                        <Input type="date" value={holdingForm.purchase_date} onChange={e => setHoldingForm({ ...holdingForm, purchase_date: e.target.value })} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => addHolding(account.id)}
                        disabled={!holdingForm.name || !holdingForm.quantity || !holdingForm.avg_buy_price || savingHolding}
                      >
                        {savingHolding ? "Saving…" : "Add holding"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setAddingHoldingForAccount(null); setHoldingForm(EMPTY_HOLDING); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Holdings table */}
                {account.holdings.length === 0 && addingHoldingForAccount !== account.id && (
                  <p className="text-xs text-muted-foreground py-3 text-center">No holdings yet — click "Add holding" to get started.</p>
                )}
                {account.holdings.length > 0 && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="text-left pb-2 font-medium">Name</th>
                        <th className="text-left pb-2 font-medium">Type</th>
                        <th className="text-right pb-2 font-medium">Qty</th>
                        <th className="text-right pb-2 font-medium">Avg price</th>
                        <th className="text-right pb-2 font-medium">Current value</th>
                        <th className="text-right pb-2 font-medium">P&L</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {account.holdings.map(h => {
                        const ha = analysis?.holdings.find(x => x.id === h.id);
                        return (
                          <tr key={h.id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-2.5 pr-3">
                              <p className="font-medium">{h.name}</p>
                              <div className="flex items-center gap-1.5">
                                {(h.ticker || h.isin) && (
                                  <p className="text-xs text-muted-foreground">{h.ticker ?? h.isin}</p>
                                )}
                                {ha?.price_source === "live" && (
                                  <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/30 px-1.5 py-0 text-[10px] font-medium text-green-700 dark:text-green-400">Live</span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 pr-3">
                              <Badge variant="outline" className="text-[10px] py-0">{assetTypeLabel(h.asset_type)}</Badge>
                            </td>
                            <td className="py-2.5 text-right tabular-nums">{h.quantity}</td>
                            <td className="py-2.5 text-right tabular-nums">
                              <p className="tabular-nums">{formatCurrency(h.avg_buy_price, h.currency)}</p>
                              {ha?.price_source === "live" && ha.live_price != null && (
                                <p className="text-xs text-green-600 tabular-nums">{formatCurrency(ha.live_price, ha.live_price_currency ?? h.currency)}</p>
                              )}
                            </td>
                            <td className="py-2.5 text-right tabular-nums">
                              {ha ? formatCurrency(ha.current_value_base, currency) : formatCurrency(h.quantity * h.avg_buy_price, h.currency)}
                            </td>
                            <td className="py-2.5 text-right">
                              {ha ? <PnlBadge pnl={ha.unrealized_pnl} pct={ha.unrealized_pnl_pct} /> : "—"}
                            </td>
                            <td className="py-2.5 text-right">
                              <Button variant="ghost" size="sm" onClick={() => deleteHolding(account.id, h.id)}>
                                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useInvestorId } from "@/hooks/useInvestorId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPercent } from "@/lib/utils";
import {
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  ArrowUpCircle,
  ArrowDownCircle,
  Wallet,
  BarChart2,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Template {
  id: string;
  name: string;
}

interface Position {
  id: string;
  symbol: string;
  name: string | null;
  quantity: number;
  avg_cost_per_share: number;
  currency: string;
}

interface Order {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price_per_share: number;
  total_value: number;
  executed_at: string;
}

interface Portfolio {
  id: string;
  template: { name: string } | null;
  initial_capital: number;
  cash_balance: number;
  current_value: number;
  total_return_pct: number;
  currency: string;
  status: string;
  started_at: string;
  positions: Position[];
  orders: Order[];
}

interface PortfolioSummary {
  id: string;
  template: { name: string } | null;
  initial_capital: number;
  cash_balance: number;
  current_value: number;
  total_return_pct: number;
  currency: string;
  status: string;
  started_at: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CURRENCIES = ["ILS", "USD", "EUR", "GBP", "JPY", "CHF", "AUD", "CAD"];

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function PaperTradingPage() {
  const investorId = useInvestorId();

  const [portfolios, setPortfolios] = useState<PortfolioSummary[]>([]);
  const [selected, setSelected] = useState<Portfolio | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New portfolio form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newCash, setNewCash] = useState("10000");
  const [newCurrency, setNewCurrency] = useState("ILS");
  const [newTemplateId, setNewTemplateId] = useState("");
  const [creating, setCreating] = useState(false);

  // Trade form
  const [showTradeForm, setShowTradeForm] = useState(false);
  const [tradeSide, setTradeSide] = useState<"buy" | "sell">("buy");
  const [tradeSymbol, setTradeSymbol] = useState("");
  const [tradeQty, setTradeQty] = useState("");
  const [tradePrice, setTradePrice] = useState("");
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [trading, setTrading] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);

  // Actions
  const [deleting, setDeleting] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!investorId) return;
    Promise.all([
      fetch(`/api/v1/investors/${investorId}/paper-portfolios`).then((r) =>
        r.ok ? r.json() : []
      ),
      fetch(`/api/v1/strategies/templates`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([p, t]) => {
        setPortfolios(p);
        setTemplates(t);
        if (t.length > 0) setNewTemplateId(t[0].id);
        if (p.length > 0) loadDetail(p[0].id);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [investorId]);

  async function loadDetail(id: string) {
    if (!investorId) return;
    const res = await fetch(`/api/v1/investors/${investorId}/paper-portfolios/${id}`);
    if (res.ok) setSelected(await res.json());
  }

  async function createPortfolio() {
    if (!investorId) return;
    const cash = parseFloat(newCash);
    if (isNaN(cash) || cash <= 0) {
      setError("Enter a valid starting cash amount.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        initial_cash: cash,
        currency: newCurrency,
      };
      if (newTemplateId) body.strategy_template_id = newTemplateId;

      const res = await fetch(`/api/v1/investors/${investorId}/paper-portfolios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json();
        throw new Error(b.detail ?? "Failed to create portfolio");
      }
      const p = await res.json();
      setPortfolios((prev) => [p, ...prev]);
      setSelected(p);
      setShowNewForm(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setCreating(false);
    }
  }

  async function fetchLivePrice() {
    if (!tradeSymbol.trim()) return;
    setLoadingPrice(true);
    try {
      const res = await fetch(`/api/v1/market/quote/${tradeSymbol.trim().toUpperCase()}`);
      if (res.ok) {
        const data = await res.json();
        setTradePrice(String(data.price));
      }
    } finally {
      setLoadingPrice(false);
    }
  }

  async function placeTrade() {
    if (!investorId || !selected) return;
    const qty = parseFloat(tradeQty);
    const price = tradePrice ? parseFloat(tradePrice) : undefined;
    if (isNaN(qty) || qty <= 0) {
      setTradeError("Enter a valid quantity.");
      return;
    }
    setTrading(true);
    setTradeError(null);
    try {
      const body: Record<string, unknown> = {
        symbol: tradeSymbol.trim().toUpperCase(),
        side: tradeSide,
        quantity: qty,
      };
      if (price && !isNaN(price)) body.price_per_share = price;

      const res = await fetch(
        `/api/v1/investors/${investorId}/paper-portfolios/${selected.id}/orders`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const b = await res.json();
        throw new Error(b.detail ?? "Order failed");
      }
      const updated: Portfolio = await res.json();
      setSelected(updated);
      setPortfolios((prev) =>
        prev.map((p) =>
          p.id === updated.id
            ? {
                ...p,
                cash_balance: updated.cash_balance,
                current_value: updated.current_value,
                total_return_pct: updated.total_return_pct,
              }
            : p
        )
      );
      setShowTradeForm(false);
      setTradeSymbol("");
      setTradeQty("");
      setTradePrice("");
    } catch (e: unknown) {
      setTradeError(e instanceof Error ? e.message : "Order failed");
    } finally {
      setTrading(false);
    }
  }

  async function deletePortfolio() {
    if (!investorId || !selected) return;
    setDeleting(true);
    try {
      await fetch(`/api/v1/investors/${investorId}/paper-portfolios/${selected.id}`, {
        method: "DELETE",
      });
      setPortfolios((prev) => prev.filter((p) => p.id !== selected.id));
      setSelected(null);
    } finally {
      setDeleting(false);
    }
  }

  async function closePortfolio() {
    if (!investorId || !selected) return;
    setClosing(true);
    try {
      const res = await fetch(
        `/api/v1/investors/${investorId}/paper-portfolios/${selected.id}/close`,
        { method: "POST" }
      );
      if (res.ok) {
        const updated: Portfolio = await res.json();
        setSelected(updated);
        setPortfolios((prev) =>
          prev.map((p) => (p.id === updated.id ? { ...p, status: "completed" } : p))
        );
      }
    } finally {
      setClosing(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  if (!investorId || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Paper Trading</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Practice investing with virtual money — no real capital at risk.
          </p>
        </div>
        <Button onClick={() => setShowNewForm((v) => !v)}>
          <Plus className="h-4 w-4" />
          New Portfolio
        </Button>
      </div>

      {/* Global error */}
      {error && (
        <div className="flex items-center gap-3 text-red-500 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* New portfolio form */}
      {showNewForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Portfolio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Starting Cash</label>
                <input
                  type="number"
                  min="1"
                  value={newCash}
                  onChange={(e) => setNewCash(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="10000"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Currency</label>
                <select
                  value={newCurrency}
                  onChange={(e) => setNewCurrency(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              {templates.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Strategy (optional)
                  </label>
                  <select
                    value={newTemplateId}
                    onChange={(e) => setNewTemplateId(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">None</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={createPortfolio} disabled={creating}>
                  {creating ? "Creating…" : "Start"}
                </Button>
                <Button variant="outline" onClick={() => setShowNewForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Portfolio list */}
        <div className="lg:col-span-2 space-y-2">
          {portfolios.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BarChart2 className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No portfolios yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click &ldquo;New Portfolio&rdquo; to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            portfolios.map((p) => {
              const isPos = p.total_return_pct >= 0;
              return (
                <button
                  key={p.id}
                  onClick={() => loadDetail(p.id)}
                  className={`w-full text-left rounded-lg border p-4 transition-colors ${
                    selected?.id === p.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-sm font-medium">
                      {p.template?.name ?? "Free Portfolio"}
                    </p>
                    <Badge
                      variant={p.status === "active" ? "success" : "muted"}
                      className="capitalize"
                    >
                      {p.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatCurrency(p.current_value, p.currency)}</span>
                    <span className={isPos ? "text-green-500 font-medium" : "text-red-500 font-medium"}>
                      {isPos ? "+" : ""}{formatPercent(p.total_return_pct)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Cash: {formatCurrency(p.cash_balance, p.currency)}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-3 space-y-4">
          {selected ? (
            <>
              {/* Summary cards */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <div>
                    <CardTitle className="text-base">
                      {selected.template?.name ?? "Free Portfolio"}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Started {new Date(selected.started_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selected.status === "active" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => {
                            setShowTradeForm((v) => !v);
                            setTradeError(null);
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Trade
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={closePortfolio}
                          disabled={closing}
                        >
                          {closing ? "…" : "Close"}
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      onClick={deletePortfolio}
                      disabled={deleting}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <StatCard
                      label="Total Value"
                      value={formatCurrency(selected.current_value, selected.currency)}
                      sub={
                        <span
                          className={
                            selected.total_return_pct >= 0 ? "text-green-500" : "text-red-500"
                          }
                        >
                          {selected.total_return_pct >= 0 ? "+" : ""}
                          {formatPercent(selected.total_return_pct)}
                        </span>
                      }
                      icon={<BarChart2 className="h-4 w-4 text-muted-foreground" />}
                    />
                    <StatCard
                      label="Cash Available"
                      value={formatCurrency(selected.cash_balance, selected.currency)}
                      sub={
                        <span className="text-muted-foreground text-xs">
                          {((selected.cash_balance / selected.initial_capital) * 100).toFixed(1)}% of start
                        </span>
                      }
                      icon={<Wallet className="h-4 w-4 text-muted-foreground" />}
                    />
                    <StatCard
                      label="Invested"
                      value={formatCurrency(
                        selected.current_value - selected.cash_balance,
                        selected.currency
                      )}
                      sub={
                        <span className="text-muted-foreground text-xs">
                          {selected.positions.length} position{selected.positions.length !== 1 ? "s" : ""}
                        </span>
                      }
                      icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
                    />
                    <StatCard
                      label="Starting Cash"
                      value={formatCurrency(selected.initial_capital, selected.currency)}
                      icon={<Wallet className="h-4 w-4 text-muted-foreground" />}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Trade form */}
              {showTradeForm && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTradeSide("buy")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                          tradeSide === "buy"
                            ? "bg-green-500/10 text-green-600 border border-green-500/30"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <ArrowUpCircle className="h-3.5 w-3.5" />
                        Buy
                      </button>
                      <button
                        onClick={() => setTradeSide("sell")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                          tradeSide === "sell"
                            ? "bg-red-500/10 text-red-600 border border-red-500/30"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <ArrowDownCircle className="h-3.5 w-3.5" />
                        Sell
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {tradeError && (
                      <div className="flex items-center gap-2 text-red-500 text-xs">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        {tradeError}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-3 items-end">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Symbol</label>
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={tradeSymbol}
                            onChange={(e) => setTradeSymbol(e.target.value.toUpperCase())}
                            placeholder="AAPL"
                            className="h-9 w-24 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring uppercase"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={fetchLivePrice}
                            disabled={loadingPrice || !tradeSymbol.trim()}
                          >
                            {loadingPrice ? "…" : "Get price"}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Quantity</label>
                        <input
                          type="number"
                          min="0.000001"
                          step="any"
                          value={tradeQty}
                          onChange={(e) => setTradeQty(e.target.value)}
                          placeholder="10"
                          className="h-9 w-24 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                          Price per share (optional — auto-fetched if blank)
                        </label>
                        <input
                          type="number"
                          min="0.000001"
                          step="any"
                          value={tradePrice}
                          onChange={(e) => setTradePrice(e.target.value)}
                          placeholder="auto"
                          className="h-9 w-28 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      {tradeSymbol && tradeQty && tradePrice && (
                        <div className="text-xs text-muted-foreground self-end pb-2">
                          ≈ {formatCurrency(
                            parseFloat(tradeQty || "0") * parseFloat(tradePrice || "0"),
                            selected.currency
                          )}
                        </div>
                      )}
                      <Button
                        onClick={placeTrade}
                        disabled={trading || !tradeSymbol.trim() || !tradeQty}
                        className={
                          tradeSide === "buy"
                            ? "bg-green-600 hover:bg-green-700"
                            : "bg-red-600 hover:bg-red-700"
                        }
                      >
                        {trading
                          ? "Placing…"
                          : tradeSide === "buy"
                          ? "Buy"
                          : "Sell"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Positions */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">
                    Open Positions ({selected.positions.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selected.positions.length === 0 ? (
                    <div className="py-8 text-center">
                      <TrendingUp className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No positions yet</p>
                      {selected.status === "active" && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Click &ldquo;Trade&rdquo; → Buy to add your first holding.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-muted-foreground border-b border-border">
                            <th className="text-left pb-2 font-medium">Symbol</th>
                            <th className="text-right pb-2 font-medium">Qty</th>
                            <th className="text-right pb-2 font-medium">Avg Cost</th>
                            <th className="text-right pb-2 font-medium">Value</th>
                            {selected.status === "active" && (
                              <th className="pb-2" />
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {selected.positions.map((pos) => (
                            <tr key={pos.id}>
                              <td className="py-2.5 font-medium">{pos.symbol}</td>
                              <td className="py-2.5 text-right text-muted-foreground">
                                {pos.quantity % 1 === 0
                                  ? pos.quantity.toFixed(0)
                                  : pos.quantity.toFixed(4)}
                              </td>
                              <td className="py-2.5 text-right text-muted-foreground">
                                {pos.avg_cost_per_share.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 4,
                                })}
                              </td>
                              <td className="py-2.5 text-right">
                                {formatCurrency(
                                  pos.quantity * pos.avg_cost_per_share,
                                  pos.currency
                                )}
                              </td>
                              {selected.status === "active" && (
                                <td className="py-2.5 text-right">
                                  <button
                                    onClick={() => {
                                      setTradeSide("sell");
                                      setTradeSymbol(pos.symbol);
                                      setTradeQty(String(pos.quantity));
                                      setTradePrice("");
                                      setShowTradeForm(true);
                                    }}
                                    className="text-xs text-red-500 hover:text-red-400 font-medium"
                                  >
                                    Sell
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Order history */}
              {selected.orders.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">
                      Order History ({selected.orders.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-muted-foreground border-b border-border">
                            <th className="text-left pb-2 font-medium">Symbol</th>
                            <th className="text-left pb-2 font-medium">Side</th>
                            <th className="text-right pb-2 font-medium">Qty</th>
                            <th className="text-right pb-2 font-medium">Price</th>
                            <th className="text-right pb-2 font-medium">Total</th>
                            <th className="text-right pb-2 font-medium">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {[...selected.orders].reverse().map((o) => (
                            <tr key={o.id}>
                              <td className="py-2 font-medium">{o.symbol}</td>
                              <td className="py-2">
                                <span
                                  className={
                                    o.side === "buy"
                                      ? "text-green-500 font-medium uppercase text-xs"
                                      : "text-red-500 font-medium uppercase text-xs"
                                  }
                                >
                                  {o.side}
                                </span>
                              </td>
                              <td className="py-2 text-right text-muted-foreground">
                                {o.quantity % 1 === 0 ? o.quantity.toFixed(0) : o.quantity.toFixed(4)}
                              </td>
                              <td className="py-2 text-right text-muted-foreground">
                                {o.price_per_share.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 4,
                                })}
                              </td>
                              <td className="py-2 text-right">
                                {formatCurrency(o.total_value, selected.currency)}
                              </td>
                              <td className="py-2 text-right text-xs text-muted-foreground">
                                {new Date(o.executed_at).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-64 gap-3">
                <BarChart2 className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Select a portfolio or create a new one
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="text-sm font-semibold">{value}</p>
      {sub && <div className="text-xs">{sub}</div>}
    </div>
  );
}

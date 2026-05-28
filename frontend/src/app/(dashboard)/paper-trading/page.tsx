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
  Pencil,
  RefreshCw,
  ExternalLink,
  X,
  CheckCircle,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Template {
  id: string;
  name: string;
}

interface Tick {
  id: string;
  tick_number: number;
  portfolio_value_before: number;
  portfolio_value_after: number;
  monthly_return_pct: number;
  simulated_at: string;
}

interface Position {
  id: string;
  symbol: string;
  name: string | null;
  quantity: number;
  avg_cost_per_share: number;
  currency: string;
  created_at: string;
  updated_at: string;
  current_price: number | null;
  unrealized_pnl: number | null;
  unrealized_pnl_pct: number | null;
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
  name: string | null;
  template: { name: string } | null;
  initial_capital: number;
  cash_balance: number;
  current_value: number;
  total_return_pct: number;
  currency: string;
  status: string;
  started_at: string;
  last_tick_at: string | null;
  ticks: Tick[];
  positions: Position[];
  orders: Order[];
}

interface PortfolioSummary {
  id: string;
  name: string | null;
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function portfolioDisplayName(p: { name: string | null; template: { name: string } | null }): string {
  return p.name || p.template?.name || "Free Portfolio";
}

function PnLBadge({ pnl, pct }: { pnl: number; pct: number }) {
  const pos = pnl >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded ${
        pos ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-500"
      }`}
    >
      {pos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {pos ? "+" : ""}
      {formatPercent(pct)}
    </span>
  );
}

function TicksChart({ ticks, currency }: { ticks: Tick[]; currency: string }) {
  if (ticks.length === 0) return null;
  const values = ticks.map((t) => t.portfolio_value_after);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 320;
  const H = 60;
  const pad = 4;
  const points = values
    .map((v, i) => {
      const x = pad + (i / Math.max(values.length - 1, 1)) * (W - pad * 2);
      const y = H - pad - ((v - min) / range) * (H - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");
  const isPos = values[values.length - 1] >= values[0];

  return (
    <div className="mt-3">
      <p className="text-xs text-muted-foreground mb-1.5">
        Simulation history — {ticks.length} tick{ticks.length !== 1 ? "s" : ""}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-14">
        <polyline
          points={points}
          fill="none"
          stroke={isPos ? "#22c55e" : "#ef4444"}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {values.map((v, i) => {
          const x = pad + (i / Math.max(values.length - 1, 1)) * (W - pad * 2);
          const y = H - pad - ((v - min) / range) * (H - pad * 2);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="3"
              fill={isPos ? "#22c55e" : "#ef4444"}
            />
          );
        })}
      </svg>
      <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
        <span>Tick 1: {formatCurrency(ticks[0].portfolio_value_before, currency)}</span>
        <span>Tick {ticks.length}: {formatCurrency(values[values.length - 1], currency)}</span>
      </div>
    </div>
  );
}

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
  const [newName, setNewName] = useState("");
  const [newCash, setNewCash] = useState("10000");
  const [newCurrency, setNewCurrency] = useState("ILS");
  const [newTemplateId, setNewTemplateId] = useState("");
  const [creating, setCreating] = useState(false);

  // Rename modal
  const [showRename, setShowRename] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  // Close / end confirmation
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [closing, setClosing] = useState(false);

  // Trade form
  const [showTradeForm, setShowTradeForm] = useState(false);
  const [tradeSide, setTradeSide] = useState<"buy" | "sell">("buy");
  const [tradeSymbol, setTradeSymbol] = useState("");
  const [tradeQty, setTradeQty] = useState("");
  const [tradePrice, setTradePrice] = useState("");
  const [tradeAssetCurrency, setTradeAssetCurrency] = useState("");
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [trading, setTrading] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);

  // Reprice / promote
  const [repricing, setRepricing] = useState(false);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [promoteSuccess, setPromoteSuccess] = useState<string | null>(null);

  // Delete
  const [deleting, setDeleting] = useState(false);

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
      if (newName.trim()) body.name = newName.trim();
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
      const p: Portfolio = await res.json();
      const summary: PortfolioSummary = {
        id: p.id, name: p.name, template: p.template,
        initial_capital: p.initial_capital, cash_balance: p.cash_balance,
        current_value: p.current_value, total_return_pct: p.total_return_pct,
        currency: p.currency, status: p.status, started_at: p.started_at,
      };
      setPortfolios((prev) => [summary, ...prev]);
      setSelected(p);
      setShowNewForm(false);
      setNewName("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setCreating(false);
    }
  }

  async function renamePortfolio() {
    if (!investorId || !selected) return;
    setRenaming(true);
    try {
      const res = await fetch(
        `/api/v1/investors/${investorId}/paper-portfolios/${selected.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: renameValue.trim() || null }),
        }
      );
      if (res.ok) {
        const updated = await res.json();
        setSelected((s) => s ? { ...s, name: updated.name } : s);
        setPortfolios((prev) =>
          prev.map((p) => p.id === updated.id ? { ...p, name: updated.name } : p)
        );
        setShowRename(false);
      }
    } finally {
      setRenaming(false);
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
        setTradeAssetCurrency(data.currency ?? "");
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
            ? { ...p, cash_balance: updated.cash_balance, current_value: updated.current_value, total_return_pct: updated.total_return_pct }
            : p
        )
      );
      setShowTradeForm(false);
      setTradeSymbol("");
      setTradeQty("");
      setTradePrice("");
      setTradeAssetCurrency("");
    } catch (e: unknown) {
      setTradeError(e instanceof Error ? e.message : "Order failed");
    } finally {
      setTrading(false);
    }
  }

  async function repriceAll() {
    if (!investorId || !selected) return;
    setRepricing(true);
    try {
      const res = await fetch(
        `/api/v1/investors/${investorId}/paper-portfolios/${selected.id}/reprice`,
        { method: "POST" }
      );
      if (res.ok) {
        const updated: Portfolio = await res.json();
        setSelected(updated);
        setPortfolios((prev) =>
          prev.map((p) =>
            p.id === updated.id
              ? { ...p, current_value: updated.current_value, total_return_pct: updated.total_return_pct }
              : p
          )
        );
      }
    } finally {
      setRepricing(false);
    }
  }

  async function promotePosition(positionId: string) {
    if (!investorId || !selected) return;
    setPromotingId(positionId);
    setPromoteSuccess(null);
    try {
      const res = await fetch(
        `/api/v1/investors/${investorId}/paper-portfolios/${selected.id}/positions/${positionId}/promote`,
        { method: "POST" }
      );
      if (res.ok) {
        const data = await res.json();
        setPromoteSuccess(`${data.symbol} staged as real order — go to Order Builder to review.`);
      }
    } finally {
      setPromotingId(null);
    }
  }

  async function endPaperTest() {
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
        setShowEndConfirm(false);
      }
    } finally {
      setClosing(false);
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

      {/* Promote success banner */}
      {promoteSuccess && (
        <div className="flex items-center gap-3 text-green-600 text-sm bg-green-500/10 rounded-lg px-4 py-3 border border-green-500/20">
          <CheckCircle className="h-4 w-4 shrink-0" />
          {promoteSuccess}
          <button onClick={() => setPromoteSuccess(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* New portfolio form */}
      {showNewForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Paper Portfolio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Name (optional)</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="e.g. Tech Test 2026"
                />
              </div>
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
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              {templates.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Strategy (optional)</label>
                  <select
                    value={newTemplateId}
                    onChange={(e) => setNewTemplateId(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">None</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={createPortfolio} disabled={creating}>
                  {creating ? "Creating…" : "Start"}
                </Button>
                <Button variant="outline" onClick={() => { setShowNewForm(false); setNewName(""); }}>
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
                  <div className="flex items-start justify-between mb-1.5">
                    <p className="text-sm font-medium">{portfolioDisplayName(p)}</p>
                    <Badge variant={p.status === "active" ? "success" : "muted"} className="capitalize">
                      {p.status === "completed" ? "Ended" : p.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatCurrency(p.current_value, p.currency)}</span>
                    <span className={isPos ? "text-green-500 font-medium" : "text-red-500 font-medium"}>
                      {isPos ? "+" : ""}{formatPercent(p.total_return_pct)}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
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
              {/* Summary card */}
              <Card>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base truncate">
                        {portfolioDisplayName(selected)}
                      </CardTitle>
                      <button
                        onClick={() => { setRenameValue(selected.name ?? ""); setShowRename(true); }}
                        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        title="Rename portfolio"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Started {new Date(selected.started_at).toLocaleDateString()}
                      {selected.last_tick_at && (
                        <> · Last tick {new Date(selected.last_tick_at).toLocaleDateString()}</>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {selected.status === "active" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={repriceAll}
                          disabled={repricing}
                          title="Fetch live market prices for all positions"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${repricing ? "animate-spin" : ""}`} />
                          {repricing ? "…" : "Reprice"}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => { setShowTradeForm((v) => !v); setTradeError(null); }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Trade
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowEndConfirm(true)}
                          className="text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
                        >
                          End Test
                        </Button>
                      </>
                    )}
                    {selected.status === "completed" && (
                      <Badge variant="muted" className="text-xs">Ended</Badge>
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
                        <span className={selected.total_return_pct >= 0 ? "text-green-500" : "text-red-500"}>
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
                      value={formatCurrency(selected.current_value - selected.cash_balance, selected.currency)}
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

                  {/* Tick chart */}
                  {selected.ticks.length > 0 && (
                    <TicksChart ticks={selected.ticks} currency={selected.currency} />
                  )}
                </CardContent>
              </Card>

              {/* End Test confirmation */}
              {showEndConfirm && (
                <Card className="border-amber-500/30 bg-amber-500/5">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">End this paper test?</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          This marks the portfolio as complete. Your positions and order history are
                          preserved — you can still review everything. No real money is affected.
                          If you want to move a position to real investing, use the{" "}
                          <strong>Stage Real Order</strong> button on each position first.
                        </p>
                        <div className="flex gap-2 mt-3">
                          <Button size="sm" onClick={endPaperTest} disabled={closing}
                            className="bg-amber-600 hover:bg-amber-700 text-white">
                            {closing ? "Ending…" : "Yes, end test"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setShowEndConfirm(false)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Rename modal */}
              {showRename && (
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <p className="text-sm font-medium mb-2">Rename portfolio</p>
                    <div className="flex gap-2 items-center">
                      <input
                        autoFocus
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") renamePortfolio(); if (e.key === "Escape") setShowRename(false); }}
                        placeholder="Portfolio name (leave blank to clear)"
                        className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <Button size="sm" onClick={renamePortfolio} disabled={renaming}>
                        {renaming ? "Saving…" : "Save"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowRename(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

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
                            onChange={(e) => { setTradeSymbol(e.target.value.toUpperCase()); setTradeAssetCurrency(""); }}
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
                          {tradeAssetCurrency && tradeAssetCurrency !== selected.currency
                            ? `Price (${tradeAssetCurrency} → ${selected.currency})`
                            : "Price per share (optional — auto-fetched)"}
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
                          {tradeAssetCurrency && tradeAssetCurrency !== selected.currency ? (
                            <>
                              ≈ {(parseFloat(tradeQty || "0") * parseFloat(tradePrice || "0")).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                              {tradeAssetCurrency}{" "}
                              <span className="text-yellow-500">(backend converts)</span>
                            </>
                          ) : (
                            <>≈ {formatCurrency(parseFloat(tradeQty || "0") * parseFloat(tradePrice || "0"), selected.currency)}</>
                          )}
                        </div>
                      )}
                      <Button
                        onClick={placeTrade}
                        disabled={trading || !tradeSymbol.trim() || !tradeQty}
                        className={tradeSide === "buy" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
                      >
                        {trading ? "Placing…" : tradeSide === "buy" ? "Buy" : "Sell"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Positions */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      Open Positions ({selected.positions.length})
                    </CardTitle>
                    {selected.status === "active" && selected.positions.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        Hit &ldquo;Reprice&rdquo; to refresh live P&amp;L
                      </span>
                    )}
                  </div>
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
                    <div className="space-y-3">
                      {selected.positions.map((pos) => {
                        const hasPnl = pos.unrealized_pnl !== null && pos.unrealized_pnl_pct !== null;
                        return (
                          <div
                            key={pos.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-border bg-muted/20"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold">{pos.symbol}</span>
                                {pos.name && (
                                  <span className="text-xs text-muted-foreground truncate max-w-32">
                                    {pos.name}
                                  </span>
                                )}
                                {hasPnl && (
                                  <PnLBadge pnl={pos.unrealized_pnl!} pct={pos.unrealized_pnl_pct!} />
                                )}
                              </div>
                              <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                                <span>
                                  {pos.quantity % 1 === 0 ? pos.quantity.toFixed(0) : pos.quantity.toFixed(4)} shares
                                </span>
                                <span>
                                  Avg cost: {pos.avg_cost_per_share.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                </span>
                                {pos.current_price !== null && (
                                  <span className="font-medium text-foreground">
                                    Now: {pos.current_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                  </span>
                                )}
                                <span>
                                  Bought: {new Date(pos.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              {pos.unrealized_pnl !== null && (
                                <div className="mt-0.5 text-xs">
                                  <span className={pos.unrealized_pnl >= 0 ? "text-green-600" : "text-red-500"}>
                                    Unrealized P&amp;L:{" "}
                                    {pos.unrealized_pnl >= 0 ? "+" : ""}
                                    {pos.unrealized_pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                                    {pos.currency}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {selected.status === "active" && (
                                <>
                                  <button
                                    onClick={() => promotePosition(pos.id)}
                                    disabled={promotingId === pos.id}
                                    className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-400 font-medium border border-blue-500/30 rounded px-2 py-1 hover:bg-blue-500/10 transition-colors"
                                    title="Stage as a real money order in Order Builder"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    {promotingId === pos.id ? "Staging…" : "Stage Real Order"}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setTradeSide("sell");
                                      setTradeSymbol(pos.symbol);
                                      setTradeQty(String(pos.quantity));
                                      setTradePrice("");
                                      setShowTradeForm(true);
                                    }}
                                    className="text-xs text-red-500 hover:text-red-400 font-medium border border-red-500/30 rounded px-2 py-1 hover:bg-red-500/10 transition-colors"
                                  >
                                    Sell
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
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
                                <span className={o.side === "buy" ? "text-green-500 font-medium uppercase text-xs" : "text-red-500 font-medium uppercase text-xs"}>
                                  {o.side}
                                </span>
                              </td>
                              <td className="py-2 text-right text-muted-foreground">
                                {o.quantity % 1 === 0 ? o.quantity.toFixed(0) : o.quantity.toFixed(4)}
                              </td>
                              <td className="py-2 text-right text-muted-foreground">
                                {o.price_per_share.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
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

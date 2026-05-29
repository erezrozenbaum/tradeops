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
  ChevronDown,
  ChevronUp,
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

interface PricePoint {
  date: string;
  price: number;
  return_pct: number;
}

interface PriceHistory {
  symbol: string;
  entry_date: string;
  entry_price: number;
  period: string;
  currency: string;
  points: PricePoint[];
  current_price: number | null;
  total_return_pct: number | null;
}

type PeriodKey = "1m" | "3m" | "6m";

function PositionHistoryChart({
  history,
  onPeriodChange,
  period,
  loading,
}: {
  history: PriceHistory | null;
  onPeriodChange: (p: PeriodKey) => void;
  period: PeriodKey;
  loading: boolean;
}) {
  const periods: PeriodKey[] = ["1m", "3m", "6m"];
  const W = 340;
  const H = 72;
  const pad = 4;

  if (loading) {
    return (
      <div className="mt-3 h-20 flex items-center justify-center">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!history || history.points.length === 0) {
    return (
      <div className="mt-3 text-xs text-muted-foreground py-4 text-center">
        No market data available for this period
      </div>
    );
  }

  const prices = history.points.map((p) => p.price);
  const min = Math.min(...prices, history.entry_price);
  const max = Math.max(...prices, history.entry_price);
  const range = max - min || 1;

  const toY = (v: number) => H - pad - ((v - min) / range) * (H - pad * 2);
  const toX = (i: number) => pad + (i / Math.max(prices.length - 1, 1)) * (W - pad * 2);

  const points = prices.map((v, i) => `${toX(i)},${toY(v)}`).join(" ");
  const entryY = toY(history.entry_price);
  const isPos = (history.total_return_pct ?? 0) >= 0;
  const strokeColor = isPos ? "#22c55e" : "#ef4444";

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs text-muted-foreground">
          Bought @ {history.entry_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}{" "}
          on {new Date(history.entry_date).toLocaleDateString()}
          {history.total_return_pct !== null && (
            <span className={`ml-2 font-medium ${isPos ? "text-green-500" : "text-red-500"}`}>
              {isPos ? "+" : ""}{history.total_return_pct.toFixed(2)}% since entry
            </span>
          )}
        </p>
        <div className="flex gap-1">
          {periods.map((p) => (
            <button
              key={p}
              onClick={() => onPeriodChange(p)}
              className={`text-xs px-2 py-0.5 rounded transition-colors ${
                period === p
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16">
        {/* Entry price line */}
        <line
          x1={pad}
          y1={entryY}
          x2={W - pad}
          y2={entryY}
          stroke="#94a3b8"
          strokeWidth="1"
          strokeDasharray="4 3"
          opacity="0.6"
        />
        {/* Price path */}
        <polyline
          points={points}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Entry dot */}
        <circle cx={toX(0)} cy={toY(prices[0])} r="3" fill={strokeColor} />
        {/* Current dot */}
        <circle cx={toX(prices.length - 1)} cy={toY(prices[prices.length - 1])} r="3" fill={strokeColor} />
      </svg>
      <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
        <span>{history.points[0]?.date}</span>
        <span>
          Now: {history.current_price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
        </span>
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
  const [promoteModal, setPromoteModal] = useState<{ positionId: string; symbol: string } | null>(null);
  const [promoteRationale, setPromoteRationale] = useState("");

  // Position price history
  const [expandedPositionId, setExpandedPositionId] = useState<string | null>(null);
  const [historyPeriod, setHistoryPeriod] = useState<PeriodKey>("3m");
  const [historyData, setHistoryData] = useState<Record<string, PriceHistory>>({});
  const [historyLoading, setHistoryLoading] = useState<string | null>(null);

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

  async function fetchPositionHistory(positionId: string, period: PeriodKey) {
    if (!investorId || !selected) return;
    const key = `${positionId}-${period}`;
    if (historyData[key]) return; // cached
    setHistoryLoading(positionId);
    try {
      const res = await fetch(
        `/api/v1/investors/${investorId}/paper-portfolios/${selected.id}/positions/${positionId}/price-history?period=${period}`
      );
      if (res.ok) {
        const data: PriceHistory = await res.json();
        setHistoryData((prev) => ({ ...prev, [key]: data }));
      }
    } finally {
      setHistoryLoading(null);
    }
  }

  function togglePositionHistory(positionId: string) {
    if (expandedPositionId === positionId) {
      setExpandedPositionId(null);
    } else {
      setExpandedPositionId(positionId);
      fetchPositionHistory(positionId, historyPeriod);
    }
  }

  function changeHistoryPeriod(positionId: string, period: PeriodKey) {
    setHistoryPeriod(period);
    fetchPositionHistory(positionId, period);
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

  async function promotePosition(positionId: string, rationale?: string) {
    if (!investorId || !selected) return;
    setPromotingId(positionId);
    setPromoteSuccess(null);
    setPromoteModal(null);
    setPromoteRationale("");
    try {
      const res = await fetch(
        `/api/v1/investors/${investorId}/paper-portfolios/${selected.id}/positions/${positionId}/promote`,
        {
          method: "POST",
          headers: rationale ? { "Content-Type": "application/json" } : undefined,
          body: rationale ? JSON.stringify({ rationale }) : undefined,
        }
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

      {/* Promote rationale modal */}
      {promoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-base">Stage Real Order — {promoteModal.symbol}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">Capture your decision rationale before committing real money</p>
              </div>
              <button onClick={() => { setPromoteModal(null); setPromoteRationale(""); }} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Why are you making this trade?</label>
              <textarea
                autoFocus
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 resize-none"
                placeholder="e.g. Strong Q4 earnings, adding to growth tier — paper test confirmed my thesis"
                value={promoteRationale}
                onChange={e => setPromoteRationale(e.target.value)}
                maxLength={2000}
              />
              <p className="text-[11px] text-muted-foreground/60">Saved to Trade Journal. Leave blank to skip.</p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => promotePosition(promoteModal.positionId, promoteRationale.trim() || undefined)}
                disabled={!!promotingId}
                className="flex-1 py-2 rounded-lg text-sm font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25 transition-colors disabled:opacity-50"
              >
                {promotingId ? "Staging…" : "Stage Real Order"}
              </button>
              <button
                onClick={() => { setPromoteModal(null); setPromoteRationale(""); }}
                className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground border border-border hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
                    {selected.status === "active" && (
                      <>
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
                        <label className="text-xs font-medium text-muted-foreground">
                          Symbol
                          <span className="ml-1.5 font-normal text-muted-foreground/60">stocks, ETFs, crypto</span>
                        </label>
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={tradeSymbol}
                            onChange={(e) => { setTradeSymbol(e.target.value.toUpperCase()); setTradeAssetCurrency(""); }}
                            placeholder="AAPL / BTC / ETH"
                            className="h-9 w-36 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring uppercase"
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
                    {selected.positions.length > 0 && (
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
                      {selected.status === "active" ? (
                        <p className="text-xs text-muted-foreground mt-1">
                          Click &ldquo;Trade&rdquo; → Buy to add your first holding.
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1">
                          This test has ended — create a new portfolio to continue trading.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selected.positions.map((pos) => {
                        const hasPnl = pos.unrealized_pnl !== null && pos.unrealized_pnl_pct !== null;
                        const isExpanded = expandedPositionId === pos.id;
                        const histKey = `${pos.id}-${historyPeriod}`;
                        const history = historyData[histKey] ?? null;
                        const isLoadingHistory = historyLoading === pos.id;
                        return (
                          <div
                            key={pos.id}
                            className="rounded-lg border border-border bg-muted/20"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-semibold">{pos.symbol}</span>
                                  {pos.name && (
                                    <span className="text-xs text-muted-foreground truncate max-w-32">
                                      {pos.name}
                                    </span>
                                  )}
                                  {hasPnl ? (
                                    <PnLBadge pnl={pos.unrealized_pnl!} pct={pos.unrealized_pnl_pct!} />
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground/50 border border-dashed border-border rounded px-1.5 py-0.5">
                                      no price — hit Reprice
                                    </span>
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
                                  <span>Bought: {new Date(pos.created_at).toLocaleDateString()}</span>
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
                              <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                                <button
                                  onClick={() => togglePositionHistory(pos.id)}
                                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 hover:bg-muted/50 transition-colors"
                                  title="Show real market price history since entry"
                                >
                                  {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                  Chart
                                </button>
                                {selected.status === "active" && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setTradeSide("buy");
                                        setTradeSymbol(pos.symbol);
                                        setTradeQty("");
                                        setTradePrice("");
                                        setShowTradeForm(true);
                                      }}
                                      className="text-xs text-green-500 hover:text-green-400 font-medium border border-green-500/30 rounded px-2 py-1 hover:bg-green-500/10 transition-colors"
                                      title="Buy more of this position"
                                    >
                                      + Buy more
                                    </button>
                                    <button
                                      onClick={() => setPromoteModal({ positionId: pos.id, symbol: pos.symbol })}
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
                            {isExpanded && (
                              <div className="px-3 pb-3 border-t border-border pt-2">
                                <PositionHistoryChart
                                  history={history}
                                  period={historyPeriod}
                                  loading={isLoadingHistory}
                                  onPeriodChange={(p) => changeHistoryPeriod(pos.id, p)}
                                />
                              </div>
                            )}
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
